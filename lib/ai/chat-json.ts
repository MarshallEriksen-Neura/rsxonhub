import { createOpenAI } from "@ai-sdk/openai";
import { generateText } from "ai";
import type { ChatRuntimeConfig } from "@/lib/ai/config";
import { createAIRequestFetch } from "@/lib/ai/proxy-fetch";

type GenerateChatJsonTextInput = {
  config: ChatRuntimeConfig;
  system: string;
  prompt: string;
  temperature?: number;
  topP?: number;
  maxOutputTokens?: number;
};

type ChatJsonTextResult = {
  text: string;
  tokenCost: number | null;
};

const nvidiaChatTemplateKwargs = {
  thinking: true,
  reasoning_effort: "high" as const,
};

export async function generateChatJsonText({
  config,
  system,
  prompt,
  temperature,
  topP,
  maxOutputTokens = 1024,
}: GenerateChatJsonTextInput): Promise<ChatJsonTextResult> {
  if (config.chatApiMode === "responses") {
    const provider = createOpenAI({
      baseURL: config.baseUrl,
      apiKey: config.apiKey,
      fetch: createAIRequestFetch({ nvidiaChatTemplateKwargs }),
    });
    const result = await generateText({
      model: provider.responses(config.model),
      system,
      prompt,
      temperature,
      topP,
      maxOutputTokens,
    });

    return {
      text: result.text,
      tokenCost: usageTokenCost(result.usage),
    };
  }

  return requestChatCompletionsText({
    baseUrl: config.baseUrl,
    apiKey: config.apiKey,
    model: config.model,
    system,
    prompt,
    temperature,
    topP,
    maxTokens: maxOutputTokens,
  });
}

export async function requestChatCompletionsText({
  baseUrl,
  apiKey,
  model,
  system,
  prompt,
  temperature,
  topP,
  maxTokens,
}: {
  baseUrl: string;
  apiKey: string;
  model: string;
  system: string;
  prompt: string;
  temperature?: number;
  topP?: number;
  maxTokens: number;
}): Promise<ChatJsonTextResult> {
  const response = await createAIRequestFetch({ nvidiaChatTemplateKwargs })(
    `${baseUrl.replace(/\/+$/, "")}/chat/completions`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: system },
          { role: "user", content: prompt },
        ],
        temperature,
        top_p: topP,
        max_tokens: maxTokens,
        stream: false,
      }),
    },
  );

  const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
  const body = await response.text();

  if (!response.ok) {
    throw new Error(providerErrorMessage(body) ?? `AI provider request failed with status ${response.status}`);
  }

  if (contentType.includes("text/event-stream") || body.trimStart().startsWith("data:")) {
    return { text: chatCompletionsStreamText(body), tokenCost: null };
  }

  return chatCompletionsJsonText(body);
}

function chatCompletionsJsonText(body: string): ChatJsonTextResult {
  const payload = JSON.parse(body) as unknown;
  if (!isRecord(payload) || !Array.isArray(payload.choices)) {
    throw new Error("AI provider returned an invalid chat completions payload.");
  }

  const text = payload.choices
    .map((choice) => {
      if (!isRecord(choice)) return "";
      const message = choice.message;
      if (!isRecord(message)) return "";
      return typeof message.content === "string" ? message.content : "";
    })
    .join("")
    .trim();

  if (!text) {
    throw new Error("AI provider returned an empty chat completion.");
  }

  return {
    text,
    tokenCost: usageTokenCost(payload.usage),
  };
}

function chatCompletionsStreamText(body: string) {
  let text = "";

  for (const line of body.split(/\r?\n/)) {
    if (!line.startsWith("data:")) continue;

    const data = line.slice("data:".length).trim();
    if (!data || data === "[DONE]") continue;

    const payload = JSON.parse(data) as unknown;
    if (!isRecord(payload) || !Array.isArray(payload.choices)) continue;

    for (const choice of payload.choices) {
      if (!isRecord(choice)) continue;
      const delta = choice.delta;
      if (isRecord(delta) && typeof delta.content === "string") {
        text += delta.content;
      }
      const message = choice.message;
      if (isRecord(message) && typeof message.content === "string") {
        text += message.content;
      }
    }
  }

  const trimmed = text.trim();
  if (!trimmed) {
    throw new Error("AI provider returned an empty chat completions stream.");
  }
  return trimmed;
}

function providerErrorMessage(body: string) {
  try {
    const payload = JSON.parse(body) as unknown;
    if (!isRecord(payload)) return null;
    const error = payload.error;
    if (typeof error === "string") return error;
    if (isRecord(error) && typeof error.message === "string") {
      return error.message;
    }
  } catch {
    return null;
  }
  return null;
}

function usageTokenCost(value: unknown) {
  if (!isRecord(value)) return null;
  const inputTokens = numberValue(value.inputTokens) ?? numberValue(value.prompt_tokens) ?? 0;
  const outputTokens = numberValue(value.outputTokens) ?? numberValue(value.completion_tokens) ?? 0;
  const totalTokens = numberValue(value.totalTokens) ?? numberValue(value.total_tokens);
  return totalTokens ?? inputTokens + outputTokens;
}

function numberValue(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
