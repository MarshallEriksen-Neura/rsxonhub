import { streamText, stepCountIs, type UIMessage } from "ai";
import { auth } from "@/auth";
import { chatModel } from "@/lib/ai";
import { retrieveContext, type CitedArticle } from "@/lib/ai/rag";
import { chatTools } from "@/lib/ai/tools";

export type ChatMessageMetadata = {
  citedArticles?: CitedArticle[];
};

type ChatUIMessage = UIMessage<ChatMessageMetadata>;

export async function POST(req: Request) {
  const session = await auth();
  if (!session) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { messages } = await req.json();
  if (!Array.isArray(messages) || messages.length === 0) {
    return new Response("Bad Request", { status: 400 });
  }

  const lastUserMessage = [...messages]
    .reverse()
    .find((m: { role: string }) => m.role === "user");
  const query: string = lastUserMessage?.content ?? "";

  const [model, { systemPrompt, citedArticles }] = await Promise.all([
    chatModel(),
    retrieveContext(query),
  ]);

  const result = streamText({ model, system: systemPrompt, messages, tools: chatTools, stopWhen: stepCountIs(5) });

  return result.toUIMessageStreamResponse<ChatUIMessage>({
    // Inject citedArticles into the assistant message metadata on finish
    messageMetadata: ({ part }) =>
      part.type === "finish"
        ? ({ citedArticles } satisfies ChatMessageMetadata)
        : undefined,
  });
}
