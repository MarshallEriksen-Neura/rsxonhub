import type { OpmlSubscription } from "@/lib/rss/opml";

const FOLO_API_BASE_URL = "https://api.folo.is";
const FOLO_SHARE_LIST_RE = /^\/share\/lists\/(\d+)\/?$/;

export class FoloListError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FoloListError";
  }
}

type FoloApiResponse<T> = {
  code?: number;
  message?: string;
  data?: T;
};

type FoloListPayload = {
  list?: {
    id?: string;
    title?: string | null;
    feedIds?: unknown;
  };
};

type FoloFeedPayload = {
  feed?: {
    title?: string | null;
    url?: string | null;
  };
};

type FetchLike = typeof fetch;

export function parseFoloShareListId(sourceUri: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(sourceUri.trim());
  } catch {
    return null;
  }

  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    return null;
  }

  if (parsed.hostname !== "app.folo.is") {
    return null;
  }

  return parsed.pathname.match(FOLO_SHARE_LIST_RE)?.[1] ?? null;
}

export function isFoloShareListUrl(sourceUri: string): boolean {
  return parseFoloShareListId(sourceUri) !== null;
}

export async function fetchFoloListSubscriptions(
  sourceUri: string,
  options: {
    fallbackFolder?: string | null;
    limit?: number;
    fetchImpl?: FetchLike;
  } = {},
): Promise<OpmlSubscription[]> {
  const listId = parseFoloShareListId(sourceUri);
  if (!listId) {
    throw new FoloListError("请输入有效的 Folo 分享列表链接。");
  }

  const fetchImpl = options.fetchImpl ?? fetch;
  const list = await fetchFoloJson<FoloListPayload>(
    `${FOLO_API_BASE_URL}/lists?listId=${encodeURIComponent(listId)}`,
    fetchImpl,
  );
  const feedIds = list.list?.feedIds;
  if (!Array.isArray(feedIds)) {
    throw new FoloListError("Folo 分享列表没有返回订阅源 ID。");
  }

  const max = options.limit ?? feedIds.length;
  const folder = cleanText(options.fallbackFolder) ?? cleanText(list.list?.title);
  const subscriptions: OpmlSubscription[] = [];
  const seen = new Set<string>();

  for (const rawFeedId of feedIds.slice(0, max)) {
    const feedId = typeof rawFeedId === "string" ? rawFeedId : String(rawFeedId);
    if (!feedId) continue;

    const payload = await fetchFoloJson<FoloFeedPayload>(
      `${FOLO_API_BASE_URL}/feeds?id=${encodeURIComponent(feedId)}`,
      fetchImpl,
    );
    const sourceUri = cleanText(payload.feed?.url);
    if (!sourceUri) continue;

    const key = sourceUri.toLowerCase();
    if (seen.has(key)) continue;

    subscriptions.push({
      title: cleanText(payload.feed?.title),
      sourceUri,
      folder,
    });
    seen.add(key);
  }

  if (subscriptions.length === 0) {
    throw new FoloListError("Folo 分享列表中没有可导入的订阅源。");
  }

  return subscriptions;
}

async function fetchFoloJson<T>(url: string, fetchImpl: FetchLike): Promise<T> {
  let response: Response;
  try {
    response = await fetchImpl(url, {
      headers: {
        accept: "application/json",
        "user-agent": "rsxonhub/0.1",
      },
    });
  } catch {
    throw new FoloListError("无法连接 Folo API。");
  }
  const text = await response.text();

  let payload: FoloApiResponse<T>;
  try {
    payload = JSON.parse(text) as FoloApiResponse<T>;
  } catch {
    throw new FoloListError("Folo API 返回了无法解析的响应。");
  }

  if (!response.ok || payload.code !== 0 || !payload.data) {
    throw new FoloListError(payload.message ?? `Folo API 请求失败: HTTP ${response.status}`);
  }

  return payload.data;
}

function cleanText(value?: string | null) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}
