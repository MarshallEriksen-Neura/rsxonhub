import http from "node:http";
import https from "node:https";
import net from "node:net";
import tls from "node:tls";

const DEFAULT_AI_REQUEST_TIMEOUT_MS = 60_000;

type NvidiaEmbeddingInputType = "passage" | "query";

type AIRequestFetchOptions = {
  nvidiaEmbeddingInputType?: NvidiaEmbeddingInputType;
};

export function aiProxyUrl() {
  return process.env.AI_PROXY_URL?.trim() || null;
}

export async function aiRequestFetch(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  return createAIRequestFetch()(input, init);
}

export function createAIRequestFetch(options: AIRequestFetchOptions = {}) {
  return async (
    input: RequestInfo | URL,
    init?: RequestInit,
  ): Promise<Response> => {
    const request = await buildAIRequest(input, init, options);
    const proxyUrl = aiProxyUrl();
    if (!proxyUrl) {
      return fetchDirect(request);
    }

    return fetchViaHttpProxy(request, parseHttpProxyUrl(proxyUrl));
  };
}

async function fetchDirect(request: Request) {
  const target = parseHttpUrl(request.url, "AI request URL");
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(timeoutError(target, null)),
    aiRequestTimeoutMs(),
  );
  const abort = () => controller.abort(request.signal.reason);

  if (request.signal.aborted) {
    abort();
  } else {
    request.signal.addEventListener("abort", abort, { once: true });
  }

  try {
    return await fetch(new Request(request, { signal: controller.signal }));
  } catch (error) {
    if (controller.signal.aborted && controller.signal.reason instanceof Error) {
      throw controller.signal.reason;
    }
    throw error;
  } finally {
    clearTimeout(timeout);
    request.signal.removeEventListener("abort", abort);
  }
}

async function buildAIRequest(
  input: RequestInfo | URL,
  init: RequestInit | undefined,
  options: AIRequestFetchOptions,
) {
  const request = new Request(input, init);
  const target = parseHttpUrl(request.url, "AI request URL");
  const body = await requestBodyBuffer(request);
  const patchedBody = patchNvidiaEmbeddingRequestBody(target, body, options);

  if (patchedBody === body && body === null) {
    return request;
  }

  const headers = new Headers(request.headers);
  if (patchedBody !== body) {
    headers.set("content-type", "application/json");
  }
  if (patchedBody) {
    headers.set("content-length", String(patchedBody.byteLength));
  }

  return new Request(request.url, {
    method: request.method,
    headers,
    body: requestBodyInit(patchedBody),
    redirect: request.redirect,
    signal: request.signal,
  });
}

async function fetchViaHttpProxy(request: Request, proxy: URL) {
  const target = parseHttpUrl(request.url, "AI request URL");
  const body = await requestBodyBuffer(request);
  const headers = headersObject(request.headers);

  const payload =
    target.protocol === "http:"
      ? await requestHttpViaProxy({ target, proxy, request, headers, body })
      : await requestHttpsViaProxy({ target, proxy, request, headers, body });

  return new Response(arrayBufferBody(payload.body), {
    status: payload.statusCode,
    statusText: payload.statusMessage,
    headers: payload.headers,
  });
}

function patchNvidiaEmbeddingRequestBody(
  target: URL,
  body: Buffer | null,
  options: AIRequestFetchOptions,
) {
  if (!options.nvidiaEmbeddingInputType || !body || !isNvidiaEmbeddingRequest(target)) {
    return body;
  }

  const payload = JSON.parse(body.toString("utf8")) as Record<string, unknown>;
  return Buffer.from(
    JSON.stringify({
      ...payload,
      input_type: options.nvidiaEmbeddingInputType,
      truncate: "NONE",
    }),
  );
}

function isNvidiaEmbeddingRequest(target: URL) {
  return (
    target.hostname.toLowerCase() === "integrate.api.nvidia.com" &&
    target.pathname.endsWith("/embeddings")
  );
}

function requestHttpViaProxy(options: ProxyRequestOptions) {
  const { target, proxy, request, headers, body } = options;

  return new Promise<ProxyResponsePayload>((resolve, reject) => {
    const req = http.request(
      {
        hostname: proxy.hostname,
        port: proxy.port || 80,
        method: request.method,
        path: target.toString(),
        headers: {
          ...headers,
          Host: target.host,
          ...proxyAuthorizationHeader(proxy),
        },
        timeout: aiRequestTimeoutMs(),
      },
      (res) => collectProxyResponse(res, resolve, reject),
    );

    req.on("timeout", () => req.destroy(timeoutError(target, proxy)));
    req.on("error", reject);
    writeRequestBody(req, body);
  });
}

function requestHttpsViaProxy(options: ProxyRequestOptions) {
  const { target, proxy, request, headers, body } = options;

  return new Promise<ProxyResponsePayload>((resolve, reject) => {
    const socket = net.connect(Number(proxy.port || 80), proxy.hostname);
    const onError = (error: Error) => {
      socket.destroy();
      reject(error);
    };

    socket.setTimeout(aiRequestTimeoutMs(), () => onError(timeoutError(target, proxy)));
    socket.once("error", onError);
    socket.once("connect", () => {
      const targetPort = target.port || 443;
      const connectHeaders = [
        `CONNECT ${target.hostname}:${targetPort} HTTP/1.1`,
        `Host: ${target.hostname}:${targetPort}`,
        ...Object.entries(proxyAuthorizationHeader(proxy)).map(
          ([key, value]) => `${key}: ${value}`,
        ),
        "",
        "",
      ];
      socket.write(connectHeaders.join("\r\n"));
    });

    readProxyConnectResponse(socket)
      .then((remaining) => {
        const tlsSocket = tls.connect({
          socket,
          servername: target.hostname,
        });

        const req = https.request(
          {
            createConnection: () => tlsSocket,
            hostname: target.hostname,
            method: request.method,
            path: `${target.pathname}${target.search}`,
            headers,
            timeout: aiRequestTimeoutMs(),
          },
          (res) => collectProxyResponse(res, resolve, reject),
        );

        req.on("timeout", () => req.destroy(timeoutError(target, proxy)));
        req.on("error", reject);
        writeRequestBody(req, body);

        if (remaining.length > 0) {
          tlsSocket.unshift(remaining);
        }
      })
      .catch(onError);
  });
}

function readProxyConnectResponse(socket: net.Socket) {
  return new Promise<Buffer>((resolve, reject) => {
    let buffer = Buffer.alloc(0);

    function onData(chunk: Buffer) {
      buffer = Buffer.concat([buffer, chunk]);
      const headerEnd = buffer.indexOf("\r\n\r\n");
      if (headerEnd === -1) return;

      socket.off("data", onData);
      const header = buffer.subarray(0, headerEnd).toString("ascii");
      const status = Number(header.match(/^HTTP\/\d\.\d\s+(\d+)/)?.[1]);
      if (status !== 200) {
        reject(new Error(`AI proxy CONNECT failed with status ${status || "unknown"}`));
        return;
      }
      resolve(buffer.subarray(headerEnd + 4));
    }

    socket.on("data", onData);
  });
}

function collectProxyResponse(
  res: http.IncomingMessage,
  resolve: (payload: ProxyResponsePayload) => void,
  reject: (error: Error) => void,
) {
  const chunks: Buffer[] = [];

  res.on("data", (chunk: Buffer | string) => {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  });
  res.on("end", () => {
    resolve({
      statusCode: res.statusCode ?? 0,
      statusMessage: res.statusMessage,
      headers: responseHeaders(res.headers),
      body: new Uint8Array(Buffer.concat(chunks)),
    });
  });
  res.on("error", reject);
}

function writeRequestBody(
  req: http.ClientRequest,
  body: Buffer | null,
) {
  if (body && body.length > 0) {
    req.write(body);
  }
  req.end();
}

async function requestBodyBuffer(request: Request) {
  if (request.method === "GET" || request.method === "HEAD") {
    return null;
  }

  const body = await request.arrayBuffer();
  return Buffer.from(body);
}

function headersObject(headers: Headers) {
  const result: Record<string, string> = {};
  headers.forEach((value, key) => {
    result[key] = value;
  });
  return result;
}

function responseHeaders(headers: http.IncomingHttpHeaders) {
  const result = new Headers();
  for (const [key, value] of Object.entries(headers)) {
    if (value === undefined) continue;
    if (Array.isArray(value)) {
      for (const item of value) result.append(key, item);
    } else {
      result.set(key, value);
    }
  }
  return result;
}

function parseHttpUrl(value: string, label: string) {
  const parsed = new URL(value);
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error(`${label} must use http or https.`);
  }
  return parsed;
}

function parseHttpProxyUrl(value: string) {
  const parsed = new URL(value);
  if (parsed.protocol !== "http:") {
    throw new Error("AI_PROXY_URL must use http.");
  }
  return parsed;
}

function proxyAuthorizationHeader(proxy: URL) {
  if (!proxy.username && !proxy.password) return {};
  return {
    "Proxy-Authorization": `Basic ${Buffer.from(
      `${decodeURIComponent(proxy.username)}:${decodeURIComponent(proxy.password)}`,
    ).toString("base64")}`,
  };
}

function aiRequestTimeoutMs() {
  const raw = Number(process.env.AI_REQUEST_TIMEOUT_MS);
  return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_AI_REQUEST_TIMEOUT_MS;
}

function timeoutError(target: URL, proxy: URL | null) {
  const transport = proxy ? `proxy ${redactUrl(proxy)}` : "direct connection";
  return new Error(
    `AI request timed out after ${aiRequestTimeoutMs()}ms via ${transport} to ${target.hostname}`,
  );
}

function redactUrl(url: URL) {
  const redacted = new URL(url.toString());
  if (redacted.username || redacted.password) {
    redacted.username = "***";
    redacted.password = "***";
  }
  return redacted.toString();
}

function arrayBufferBody(body: Uint8Array) {
  return body.buffer.slice(
    body.byteOffset,
    body.byteOffset + body.byteLength,
  ) as ArrayBuffer;
}

function requestBodyInit(body: Buffer | null) {
  return body ? arrayBufferBody(new Uint8Array(body)) : null;
}

type ProxyRequestOptions = {
  target: URL;
  proxy: URL;
  request: Request;
  headers: Record<string, string>;
  body: Buffer | null;
};

type ProxyResponsePayload = {
  statusCode: number;
  statusMessage?: string;
  headers: Headers;
  body: Uint8Array;
};
