export type RsshubSource = {
  type: "rsshub";
  canonicalUri: string;
  route: string;
  fetchUrl: string;
};

export type HttpSource = {
  type: "http";
  canonicalUri: string;
  fetchUrl: string;
};

export type FeedSource = RsshubSource | HttpSource;

export class SourceUriError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SourceUriError";
  }
}

export function resolveFeedSource(input: string, baseUrl: string): FeedSource {
  const source = input.trim();
  if (!source) {
    throw new SourceUriError("订阅源地址不能为空。");
  }

  if (source.startsWith("rsshub://")) {
    return resolveRsshubSource(source, baseUrl);
  }

  return resolveHttpSource(source);
}

export function resolveRsshubSource(uri: string, baseUrl: string): RsshubSource {
  const normalizedBaseUrl = normalizeBaseUrl(baseUrl);

  let parsed: URL;
  try {
    parsed = new URL(uri);
  } catch {
    throw new SourceUriError(`无效 RSSHub URI: ${uri}`);
  }

  if (parsed.protocol !== "rsshub:") {
    throw new SourceUriError(`不支持的订阅源协议: ${parsed.protocol}`);
  }

  const route = normalizeRoute(`${parsed.hostname}${parsed.pathname}`);
  const fetchUrl = new URL(route, ensureTrailingSlash(normalizedBaseUrl)).toString();

  return {
    type: "rsshub",
    canonicalUri: `rsshub://${route}`,
    route,
    fetchUrl,
  };
}

function resolveHttpSource(uri: string): HttpSource {
  let parsed: URL;
  try {
    parsed = new URL(uri);
  } catch {
    throw new SourceUriError(`无效订阅源地址: ${uri}`);
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new SourceUriError(`不支持的订阅源协议: ${parsed.protocol}`);
  }

  return {
    type: "http",
    canonicalUri: parsed.toString(),
    fetchUrl: parsed.toString(),
  };
}

function normalizeRoute(route: string) {
  const normalized = route
    .split("/")
    .map((part) => part.trim())
    .filter(Boolean)
    .join("/");

  if (!normalized) {
    throw new SourceUriError("RSSHub URI 缺少 route。");
  }

  return normalized;
}

function normalizeBaseUrl(baseUrl: string) {
  try {
    return parseHttpUrl(baseUrl).toString();
  } catch {
    throw new SourceUriError(`无效 RSSHUB_BASE_URL: ${baseUrl}`);
  }
}

function ensureTrailingSlash(value: string) {
  return value.endsWith("/") ? value : `${value}/`;
}
import { parseHttpUrl } from "@/lib/url";
