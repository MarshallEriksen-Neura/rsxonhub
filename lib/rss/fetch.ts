import http from "node:http";
import https from "node:https";
import net from "node:net";
import tls from "node:tls";
import zlib from "node:zlib";

export const FEED_REQUEST_TIMEOUT_MS = 15_000;

export const feedRequestHeaders = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
  Accept: "application/rss+xml, application/atom+xml, application/xml, text/xml, text/html;q=0.9, */*;q=0.8",
  "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
  "Accept-Encoding": "gzip, deflate, br",
  Connection: "keep-alive",
};

const MAX_REDIRECTS = 5;
const ERROR_BODY_PREVIEW_CHARS = 500;

export class FeedFetchHttpError extends Error {
  readonly statusCode: number;
  readonly url: string;
  readonly contentType: string | null;
  readonly responseBodyPreview: string | null;

  constructor(payload: {
    statusCode: number;
    url: string;
    contentType: string | null;
    responseBodyPreview: string | null;
  }) {
    const details = [
      `Upstream returned HTTP ${payload.statusCode}`,
      payload.contentType ? `content-type: ${payload.contentType}` : null,
      payload.responseBodyPreview ? `body: ${payload.responseBodyPreview}` : null,
      `url: ${payload.url}`,
    ].filter(Boolean);
    super(details.join("; "));
    this.name = "FeedFetchHttpError";
    this.statusCode = payload.statusCode;
    this.url = payload.url;
    this.contentType = payload.contentType;
    this.responseBodyPreview = payload.responseBodyPreview;
  }
}

export async function fetchFeedXml(url: string) {
  return requestFeedXml(url, 0);
}

async function requestFeedXml(url: string, redirectCount: number): Promise<string> {
  const target = parseHttpUrl(url, "RSS feed URL");
  const proxy = process.env.RSS_FETCH_PROXY
    ? parseProxyUrl(process.env.RSS_FETCH_PROXY)
    : null;

  const { statusCode, headers, body } = proxy
    ? await requestViaHttpProxy(target, proxy)
    : await requestDirect(target);

  if (statusCode >= 300 && statusCode < 400 && headers.location) {
    if (redirectCount >= MAX_REDIRECTS) {
      throw new Error("Too many redirects");
    }
    return requestFeedXml(new URL(headers.location, target).toString(), redirectCount + 1);
  }

  if (statusCode >= 300) {
    throw new FeedFetchHttpError({
      statusCode,
      url: target.toString(),
      contentType: headerValue(headers["content-type"]),
      responseBodyPreview: previewResponseBody(body),
    });
  }

  return body;
}

function requestDirect(target: URL) {
  const transport = target.protocol === "https:" ? https : http;

  return new Promise<ResponsePayload>((resolve, reject) => {
    const req = transport.get(
      {
        protocol: target.protocol,
        hostname: target.hostname,
        port: target.port,
        path: `${target.pathname}${target.search}`,
        headers: feedRequestHeaders,
        timeout: FEED_REQUEST_TIMEOUT_MS,
      },
      (res) => collectResponse(res, resolve, reject),
    );

    req.on("timeout", () => req.destroy(timeoutError()));
    req.on("error", reject);
  });
}

function requestViaHttpProxy(target: URL, proxy: URL) {
  if (target.protocol === "http:") {
    return requestHttpViaProxy(target, proxy);
  }
  return requestHttpsViaProxy(target, proxy);
}

function requestHttpViaProxy(target: URL, proxy: URL) {
  return new Promise<ResponsePayload>((resolve, reject) => {
    const req = http.get(
      {
        hostname: proxy.hostname,
        port: proxy.port || 80,
        path: target.toString(),
        headers: {
          ...feedRequestHeaders,
          Host: target.host,
          ...proxyAuthorizationHeader(proxy),
        },
        timeout: FEED_REQUEST_TIMEOUT_MS,
      },
      (res) => collectResponse(res, resolve, reject),
    );

    req.on("timeout", () => req.destroy(timeoutError()));
    req.on("error", reject);
  });
}

function requestHttpsViaProxy(target: URL, proxy: URL) {
  return new Promise<ResponsePayload>((resolve, reject) => {
    const socket = net.connect(Number(proxy.port || 80), proxy.hostname);
    const onError = (error: Error) => {
      socket.destroy();
      reject(error);
    };

    socket.setTimeout(FEED_REQUEST_TIMEOUT_MS, () => onError(timeoutError()));
    socket.once("error", onError);
    socket.once("connect", () => {
      const connectHeaders = [
        `CONNECT ${target.hostname}:${target.port || 443} HTTP/1.1`,
        `Host: ${target.hostname}:${target.port || 443}`,
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
            path: `${target.pathname}${target.search}`,
            method: "GET",
            headers: feedRequestHeaders,
            timeout: FEED_REQUEST_TIMEOUT_MS,
          },
          (res) => collectResponse(res, resolve, reject),
        );

        req.on("timeout", () => req.destroy(timeoutError()));
        req.on("error", reject);
        req.end();

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
        reject(new Error(`Proxy CONNECT failed with status ${status || "unknown"}`));
        return;
      }
      resolve(buffer.subarray(headerEnd + 4));
    }

    socket.on("data", onData);
  });
}

function collectResponse(
  res: http.IncomingMessage,
  resolve: (payload: ResponsePayload) => void,
  reject: (error: Error) => void,
) {
  const chunks: Buffer[] = [];
  res.on("data", (chunk: Buffer | string) => {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  });
  res.on("end", () =>
    decodeBody(Buffer.concat(chunks), res.headers)
      .then((body) =>
        resolve({
          statusCode: res.statusCode ?? 0,
          headers: res.headers,
          body,
        }),
      )
      .catch(reject),
  );
  res.on("error", reject);
}

async function decodeBody(buffer: Buffer, headers: http.IncomingHttpHeaders) {
  const encoding = String(headers["content-encoding"] ?? "").toLowerCase();
  const decoded =
    encoding === "gzip"
      ? await unzip(buffer, zlib.gunzip)
      : encoding === "deflate"
        ? await unzip(buffer, zlib.inflate)
        : encoding === "br"
          ? await unzip(buffer, zlib.brotliDecompress)
          : buffer;

  return decoded.toString(responseEncoding(headers["content-type"]));
}

function unzip(
  buffer: Buffer,
  unzipper: (buffer: Buffer, callback: (error: Error | null, result: Buffer) => void) => void,
) {
  return new Promise<Buffer>((resolve, reject) => {
    unzipper(buffer, (error, result) => {
      if (error) reject(error);
      else resolve(result);
    });
  });
}

function parseHttpUrl(value: string, label: string) {
  const parsed = new URL(value);
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error(`${label} must use http or https.`);
  }
  return parsed;
}

function parseProxyUrl(value: string) {
  const parsed = parseHttpUrl(value, "RSS_FETCH_PROXY");
  if (parsed.protocol !== "http:") {
    throw new Error("RSS_FETCH_PROXY must use http.");
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

function responseEncoding(contentType: string | string[] | undefined): BufferEncoding {
  const value = Array.isArray(contentType) ? contentType[0] : contentType;
  const charset = value?.match(/charset=([^;]+)/i)?.[1]?.trim().toLowerCase();
  return charset === "gbk" || charset === "gb2312" ? "latin1" : "utf8";
}

function headerValue(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value.join(", ");
  return value ?? null;
}

function previewResponseBody(body: string) {
  const collapsed = body.replace(/\s+/g, " ").trim();
  if (!collapsed) return null;
  return collapsed.length > ERROR_BODY_PREVIEW_CHARS
    ? `${collapsed.slice(0, ERROR_BODY_PREVIEW_CHARS)}...`
    : collapsed;
}

function timeoutError() {
  return new Error(`Request timed out after ${FEED_REQUEST_TIMEOUT_MS}ms`);
}

type ResponsePayload = {
  statusCode: number;
  headers: http.IncomingHttpHeaders;
  body: string;
};
