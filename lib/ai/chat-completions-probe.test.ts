import http from "node:http";
import { describe, expect, test } from "bun:test";
import { probeChatCompletionsConnection } from "@/lib/ai/chat-completions-probe";

describe("probeChatCompletionsConnection", () => {
  test("accepts normal JSON chat completions responses", async () => {
    const seenBodies: unknown[] = [];
    const upstream = http.createServer((req, res) => {
      collectRequestBody(req).then((body) => {
        seenBodies.push(JSON.parse(body));
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            id: "chatcmpl-test",
            object: "chat.completion",
            choices: [{ index: 0, message: { role: "assistant", content: "pong" } }],
          }),
        );
      });
    });

    await listen(upstream);
    const baseUrl = serverBaseUrl(upstream);

    await expect(
      probeChatCompletionsConnection({
        baseUrl,
        apiKey: "test-key",
        model: "test-model",
      }),
    ).resolves.toBeUndefined();
    expect(seenBodies).toEqual([
      {
        model: "test-model",
        messages: [{ role: "user", content: "Reply with exactly: pong" }],
        max_tokens: 64,
        stream: false,
      },
    ]);

    await close(upstream);
  });

  test("accepts providers that return SSE despite stream false", async () => {
    const upstream = http.createServer((_req, res) => {
      res.writeHead(200, { "Content-Type": "text/event-stream" });
      res.end(
        [
          'data: {"id":"chatcmpl-test","object":"chat.completion.chunk","choices":[{"index":0,"delta":{"role":"assistant","content":"","reasoning_content":"thinking"}}]}',
          'data: {"id":"chatcmpl-test","object":"chat.completion.chunk","choices":[{"index":0,"delta":{"content":"pong"}}]}',
          "data: [DONE]",
          "",
        ].join("\n"),
      );
    });

    await listen(upstream);

    await expect(
      probeChatCompletionsConnection({
        baseUrl: serverBaseUrl(upstream),
        apiKey: "test-key",
        model: "qwen3.7-plus",
      }),
    ).resolves.toBeUndefined();

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
