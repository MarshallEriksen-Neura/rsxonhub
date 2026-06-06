import { describe, expect, test } from "bun:test";
import {
  fetchFoloListSubscriptions,
  isFoloShareListUrl,
  parseFoloShareListId,
} from "@/lib/rss/folo-list";

describe("Folo share list support", () => {
  test("recognizes Folo share list URLs", () => {
    expect(parseFoloShareListId("https://app.folo.is/share/lists/60603440610499584")).toBe(
      "60603440610499584",
    );
    expect(isFoloShareListUrl("https://app.folo.is/share/lists/60603440610499584")).toBe(
      true,
    );
    expect(isFoloShareListUrl("https://app.folo.is/share/feeds/60603440610499584")).toBe(
      false,
    );
    expect(isFoloShareListUrl("https://example.com/share/lists/60603440610499584")).toBe(
      false,
    );
  });

  test("expands list feed ids into importable subscriptions", async () => {
    const fetchImpl = async (url: string | URL | Request) => {
      const value = String(url);
      if (value.includes("/lists?listId=60603440610499584")) {
        return jsonResponse({
          code: 0,
          data: {
            list: {
              title: "Folo Picks",
              feedIds: ["1", "2", "duplicate"],
            },
          },
        });
      }
      if (value.includes("/feeds?id=1")) {
        return jsonResponse({
          code: 0,
          data: {
            feed: {
              title: "First",
              url: "rsshub://twitter/media/first",
            },
          },
        });
      }
      if (value.includes("/feeds?id=2")) {
        return jsonResponse({
          code: 0,
          data: {
            feed: {
              title: "Second",
              url: "https://example.com/feed.xml",
            },
          },
        });
      }
      if (value.includes("/feeds?id=duplicate")) {
        return jsonResponse({
          code: 0,
          data: {
            feed: {
              title: "Duplicate",
              url: "rsshub://twitter/media/first",
            },
          },
        });
      }
      throw new Error(`Unexpected URL: ${value}`);
    };

    await expect(
      fetchFoloListSubscriptions("https://app.folo.is/share/lists/60603440610499584", {
        fetchImpl: fetchImpl as typeof fetch,
      }),
    ).resolves.toEqual([
      {
        title: "First",
        sourceUri: "rsshub://twitter/media/first",
        folder: "Folo Picks",
      },
      {
        title: "Second",
        sourceUri: "https://example.com/feed.xml",
        folder: "Folo Picks",
      },
    ]);
  });
});

function jsonResponse(payload: unknown) {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}
