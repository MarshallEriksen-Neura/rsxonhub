import http from "node:http";
import { describe, expect, test } from "bun:test";
import { requestChatCompletionsText } from "@/lib/ai/chat-json";

describe("requestChatCompletionsText", () => {
  test("reads text from JSON chat completions responses", async () => {
    const seenBodies: unknown[] = [];
    const upstream = http.createServer((req, res) => {
      collectRequestBody(req).then((body) => {
        seenBodies.push(JSON.parse(body));
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            choices: [{ message: { content: "{\"summary\":\"ok\"}" } }],
            usage: { prompt_tokens: 2, completion_tokens: 3 },
          }),
        );
      });
    });

    await listen(upstream);
    const result = await requestChatCompletionsText({
      baseUrl: serverBaseUrl(upstream),
      apiKey: "test-key",
      model: "test-model",
      system: "Return JSON.",
      prompt: "Summarize.",
      temperature: 0.7,
      topP: 1,
      maxTokens: 128,
    });

    expect(result).toEqual({ text: "{\"summary\":\"ok\"}", tokenCost: 5 });
    expect(seenBodies).toEqual([
      {
        model: "test-model",
        messages: [
          { role: "system", content: "Return JSON." },
          { role: "user", content: "Summarize." },
        ],
        temperature: 0.7,
        top_p: 1,
        max_tokens: 128,
        stream: false,
      },
    ]);

    await close(upstream);
  });

  test("reads text from SSE chat completions responses", async () => {
    const upstream = http.createServer((_req, res) => {
      res.writeHead(200, { "Content-Type": "text/event-stream" });
      res.end(
        [
          'data: {"choices":[{"delta":{"content":"{\\"summary\\":"}}]}',
          'data: {"choices":[{"delta":{"content":"\\"ok\\"}"}}]}',
          "data: [DONE]",
          "",
        ].join("\n"),
      );
    });

    await listen(upstream);
    const result = await requestChatCompletionsText({
      baseUrl: serverBaseUrl(upstream),
      apiKey: "test-key",
      model: "test-model",
      system: "Return JSON.",
      prompt: "Summarize.",
      maxTokens: 128,
    });

    expect(result).toEqual({ text: "{\"summary\":\"ok\"}", tokenCost: null });

    await close(upstream);
  });
});

function collectRequestBody(req: http.IncomingMessage) {
  return new Promise<string>((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer | string) => {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

function serverBaseUrl(server: http.Server) {
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Unable to bind upstream test server");
  }
  return `http://127.0.0.1:${address.port}/v1`;
}

function listen(server: http.Server) {
  return new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
}

function close(server: http.Server) {
  return new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
}
