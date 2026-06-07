import http from "node:http";
import { afterEach, describe, expect, test } from "bun:test";
import { aiRequestFetch, createAIRequestFetch } from "@/lib/ai/proxy-fetch";

const originalProxy = process.env.AI_PROXY_URL;
const originalTimeout = process.env.AI_REQUEST_TIMEOUT_MS;

afterEach(() => {
  restoreEnv("AI_PROXY_URL", originalProxy);
  restoreEnv("AI_REQUEST_TIMEOUT_MS", originalTimeout);
});

describe("AI proxy fetch", () => {
  test("uses AI_PROXY_URL for AI requests", async () => {
    const seenRequests: Array<{
      url: string;
      authorization: string | undefined;
      body: string;
    }> = [];
    const proxy = http.createServer((req, res) => {
      const chunks: Buffer[] = [];
      req.on("data", (chunk: Buffer | string) => {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      });
      req.on("end", () => {
        seenRequests.push({
          url: req.url ?? "",
          authorization: req.headers.authorization,
          body: Buffer.concat(chunks).toString("utf8"),
        });
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: true }));
      });
    });

    await listen(proxy);
    const address = proxy.address();
    if (!address || typeof address === "string") {
      throw new Error("Unable to bind proxy test server");
    }

    process.env.AI_PROXY_URL = `http://127.0.0.1:${address.port}`;

    const response = await aiRequestFetch("http://ai.example/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: "Bearer test-key",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ model: "test-model" }),
    });

    expect(response.ok).toBe(true);
    await expect(response.json()).resolves.toEqual({ ok: true });
    expect(seenRequests).toEqual([
      {
        url: "http://ai.example:80/v1/chat/completions",
        authorization: "Bearer test-key",
        body: JSON.stringify({ model: "test-model" }),
      },
    ]);

    await close(proxy);
  });

  test("accepts proxy credentials with malformed percent escapes", async () => {
    const seenProxyAuthorizations: Array<string | undefined> = [];
    const proxy = http.createServer((req, res) => {
      seenProxyAuthorizations.push(req.headers["proxy-authorization"]);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: true }));
    });

    await listen(proxy);
    const address = proxy.address();
    if (!address || typeof address === "string") {
      throw new Error("Unable to bind proxy test server");
    }

    process.env.AI_PROXY_URL = `http://user:p%@127.0.0.1:${address.port}`;

    const response = await aiRequestFetch("http://ai.example/v1/chat/completions");

    expect(response.ok).toBe(true);
    expect(seenProxyAuthorizations).toEqual([
      `Basic ${Buffer.from("user:p%").toString("base64")}`,
    ]);

    await close(proxy);
  });

  test("decodes valid percent-encoded proxy credentials", async () => {
    const seenProxyAuthorizations: Array<string | undefined> = [];
    const proxy = http.createServer((req, res) => {
      seenProxyAuthorizations.push(req.headers["proxy-authorization"]);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: true }));
    });

    await listen(proxy);
    const address = proxy.address();
    if (!address || typeof address === "string") {
      throw new Error("Unable to bind proxy test server");
    }

    process.env.AI_PROXY_URL = `http://u%3Aer:p%3A@127.0.0.1:${address.port}`;

    const response = await aiRequestFetch("http://ai.example/v1/chat/completions");

    expect(response.ok).toBe(true);
    expect(seenProxyAuthorizations).toEqual([
      `Basic ${Buffer.from("u:er:p:").toString("base64")}`,
    ]);

    await close(proxy);
  });

  test("adds NVIDIA embedding request fields before proxying", async () => {
    const seenBodies: unknown[] = [];
    const proxy = http.createServer((req, res) => {
      const chunks: Buffer[] = [];
      req.on("data", (chunk: Buffer | string) => {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      });
      req.on("end", () => {
        seenBodies.push(JSON.parse(Buffer.concat(chunks).toString("utf8")));
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ data: [{ embedding: [0.1, 0.2] }] }));
      });
    });

    await listen(proxy);
    const address = proxy.address();
    if (!address || typeof address === "string") {
      throw new Error("Unable to bind proxy test server");
    }

    process.env.AI_PROXY_URL = `http://127.0.0.1:${address.port}`;

    const fetchWithEmbeddingOptions = createAIRequestFetch({
      nvidiaEmbeddingInputType: "query",
    });
    const response = await fetchWithEmbeddingOptions(
      "http://integrate.api.nvidia.com/v1/embeddings",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "nvidia/nv-embed-v1",
          input: ["test"],
          encoding_format: "float",
        }),
      },
    );

    expect(response.ok).toBe(true);
    expect(seenBodies).toEqual([
      {
        model: "nvidia/nv-embed-v1",
        input: ["test"],
        encoding_format: "float",
        input_type: "query",
        truncate: "NONE",
      },
    ]);

    await close(proxy);
  });

  test("adds NVIDIA chat template kwargs before proxying", async () => {
    const seenBodies: unknown[] = [];
    const proxy = http.createServer((req, res) => {
      const chunks: Buffer[] = [];
      req.on("data", (chunk: Buffer | string) => {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      });
      req.on("end", () => {
        seenBodies.push(JSON.parse(Buffer.concat(chunks).toString("utf8")));
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ choices: [{ message: { content: "ok" } }] }));
      });
    });

    await listen(proxy);
    const address = proxy.address();
    if (!address || typeof address === "string") {
      throw new Error("Unable to bind proxy test server");
    }

    process.env.AI_PROXY_URL = `http://127.0.0.1:${address.port}`;

    const fetchWithChatOptions = createAIRequestFetch({
      nvidiaChatTemplateKwargs: {
        thinking: true,
        reasoning_effort: "high",
      },
    });
    const response = await fetchWithChatOptions(
      "http://integrate.api.nvidia.com/v1/chat/completions",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "deepseek-ai/deepseek-v4-flash",
          messages: [{ role: "user", content: "hello" }],
          temperature: 1,
          top_p: 0.95,
          extra_body: {
            chat_template_kwargs: {
              existing: true,
            },
          },
        }),
      },
    );

    expect(response.ok).toBe(true);
    expect(seenBodies).toEqual([
      {
        model: "deepseek-ai/deepseek-v4-flash",
        messages: [{ role: "user", content: "hello" }],
        temperature: 1,
        top_p: 0.95,
        extra_body: {
          chat_template_kwargs: {
            existing: true,
            thinking: true,
            reasoning_effort: "high",
          },
        },
      },
    ]);

    await close(proxy);
  });

  test("does not add NVIDIA chat template kwargs to other providers", async () => {
    const seenBodies: unknown[] = [];
    const proxy = http.createServer((req, res) => {
      const chunks: Buffer[] = [];
      req.on("data", (chunk: Buffer | string) => {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      });
      req.on("end", () => {
        seenBodies.push(JSON.parse(Buffer.concat(chunks).toString("utf8")));
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ choices: [{ message: { content: "ok" } }] }));
      });
    });

    await listen(proxy);
    const address = proxy.address();
    if (!address || typeof address === "string") {
      throw new Error("Unable to bind proxy test server");
    }

    process.env.AI_PROXY_URL = `http://127.0.0.1:${address.port}`;

    const fetchWithChatOptions = createAIRequestFetch({
      nvidiaChatTemplateKwargs: {
        thinking: true,
        reasoning_effort: "high",
      },
    });
    const body = {
      model: "other-model",
      messages: [{ role: "user", content: "hello" }],
    };
    const response = await fetchWithChatOptions(
      "http://api.example.com/v1/chat/completions",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      },
    );

    expect(response.ok).toBe(true);
    expect(seenBodies).toEqual([body]);

    await close(proxy);
  });

  test("rejects non-JSON AI response content-types with diagnostic context", async () => {
    const upstream = http.createServer((_req, res) => {
      res.writeHead(200, { "Content-Type": "text/x-component" });
      res.end('0:{"a":"$@1","f":"","q":"","i":true,"b":"development"}\n');
    });

    await listen(upstream);
    const address = upstream.address();
    if (!address || typeof address === "string") {
      throw new Error("Unable to bind upstream test server");
    }

    await expect(
      aiRequestFetch(`http://127.0.0.1:${address.port}/v1/chat/completions`),
    ).rejects.toThrow(
      'AI provider returned an invalid JSON response; url=http://127.0.0.1:',
    );
    await expect(
      aiRequestFetch(`http://127.0.0.1:${address.port}/v1/chat/completions`),
    ).rejects.toThrow('content-type=text/x-component');

    await close(upstream);
  });

  test("rejects invalid JSON AI response bodies before the SDK parser", async () => {
    const upstream = http.createServer((_req, res) => {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        '0:{"a":"$@1","f":"","q":"","i":true,"b":"development"}\n1:D"$2"\n',
      );
    });

    await listen(upstream);
    const address = upstream.address();
    if (!address || typeof address === "string") {
      throw new Error("Unable to bind upstream test server");
    }

    await expect(
      aiRequestFetch(`http://127.0.0.1:${address.port}/v1/chat/completions`),
    ).rejects.toThrow(
      'AI provider returned an invalid JSON response; url=http://127.0.0.1:',
    );
    await expect(
      aiRequestFetch(`http://127.0.0.1:${address.port}/v1/chat/completions`),
    ).rejects.toThrow('body-preview=0:{"a":"$@1"');

    await close(upstream);
  });

  test("times out direct AI requests", async () => {
    const upstream = http.createServer(() => {
      // Keep the response open so the client-side timeout owns completion.
    });

    await listen(upstream);
    const address = upstream.address();
    if (!address || typeof address === "string") {
      throw new Error("Unable to bind upstream test server");
    }

    process.env.AI_REQUEST_TIMEOUT_MS = "20";

    await expect(
      aiRequestFetch(`http://127.0.0.1:${address.port}/v1/chat/completions`),
    ).rejects.toThrow(
      `AI request timed out after 20ms via direct connection to 127.0.0.1`,
    );

    await close(upstream);
  });

  test("rejects non-http proxy URLs", async () => {
    process.env.AI_PROXY_URL = "socks5://127.0.0.1:7890";

    await expect(aiRequestFetch("http://ai.example/v1/models")).rejects.toThrow(
      "AI_PROXY_URL must use http.",
    );
  });
});

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

function restoreEnv(name: string, value: string | undefined) {
  if (value === undefined) {
    delete process.env[name];
  } else {
    process.env[name] = value;
  }
}
