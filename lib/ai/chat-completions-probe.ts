import { createAIRequestFetch } from "@/lib/ai/proxy-fetch";

type ProbeChatCompletionsConnectionOptions = {
  baseUrl: string;
  apiKey: string;
  model: string;
};

export async function probeChatCompletionsConnection({
  baseUrl,
  apiKey,
  model,
}: ProbeChatCompletionsConnectionOptions) {
  const response = await createAIRequestFetch({
    nvidiaChatTemplateKwargs: {
      thinking: true,
      reasoning_effort: "high",
    },
  })(chatCompletionsUrl(baseUrl), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: [{ role: "user", content: "Reply with exactly: pong" }],
      max_tokens: 64,
      stream: false,
    }),
  });

  if (!response.ok) {
    throw new Error(`AI provider request failed with status ${response.status}`);
  }

  const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
  const body = await response.text();

  if (contentType.includes("text/event-stream")) {
    assertUsableChatCompletionsStream(body);
    return;
  }

  assertUsableChatCompletionsJson(body);
}

function chatCompletionsUrl(baseUrl: string) {
  return `${baseUrl.replace(/\/+$/, "")}/chat/completions`;
}

function assertUsableChatCompletionsJson(body: string) {
  const payload = JSON.parse(body) as unknown;
  if (!isRecord(payload)) {
    throw new Error("AI provider returned an invalid chat completions payload.");
  }

  if (Array.isArray(payload.choices)) {
    return;
  }

  const errorMessage = providerErrorMessage(payload);
  throw new Error(
    errorMessage
      ? `AI provider request failed: ${errorMessage}`
      : "AI provider returned an invalid chat completions payload.",
  );
}

function assertUsableChatCompletionsStream(body: string) {
  for (const line of body.split(/\r?\n/)) {
    if (!line.startsWith("data:")) continue;

    const data = line.slice("data:".length).trim();
    if (!data) continue;
    if (data === "[DONE]") return;

    const payload = JSON.parse(data) as unknown;
    if (isRecord(payload) && Array.isArray(payload.choices)) {
      return;
    }
  }

  throw new Error("AI provider returned an invalid chat completions stream.");
}

function providerErrorMessage(payload: Record<string, unknown>) {
  const error = payload.error;
  if (typeof error === "string") return error;
  if (isRecord(error) && typeof error.message === "string") {
    return error.message;
  }
  return null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
