import { describe, expect, test } from "bun:test";
import { resolveRsshubSource } from "@/lib/rsshub/source-uri-core";

describe("RSSHub source URI resolver", () => {
  test("resolves canonical rsshub uri through configurable base url", () => {
    const source = resolveRsshubSource(
      "rsshub://tophub/WnBe01o371/",
      "https://rsshub.example/base/",
    );

    expect(source).toEqual({
      type: "rsshub",
      canonicalUri: "rsshub://tophub/WnBe01o371",
      route: "tophub/WnBe01o371",
      fetchUrl: "https://rsshub.example/base/tophub/WnBe01o371",
    });
  });

  test("normalizes bare RSSHub base host to https", () => {
    const source = resolveRsshubSource(
      "rsshub://telegram/channel/foo",
      "rss.datuan.dev",
    );

    expect(source.fetchUrl).toBe("https://rss.datuan.dev/telegram/channel/foo");
  });

  test("rejects unsupported base url protocol", () => {
    expect(() => resolveRsshubSource("rsshub://anthropic/research", "ftp://example.com"))
      .toThrow("无效 RSSHUB_BASE_URL");
  });
});

