import http from "node:http";
import { afterEach, describe, expect, test } from "bun:test";
import { FeedFetchHttpError, fetchFeedXml } from "@/lib/rss/fetch";

const originalProxy = process.env.RSS_FETCH_PROXY;

afterEach(() => {
  if (originalProxy === undefined) {
    delete process.env.RSS_FETCH_PROXY;
  } else {
    process.env.RSS_FETCH_PROXY = originalProxy;
  }
});

describe("RSS feed fetch", () => {
  test("uses RSS_FETCH_PROXY for feed requests", async () => {
    const seenRequests: string[] = [];
    const proxy = http.createServer();

    proxy.on("request", (req, res) => {
      seenRequests.push(req.url ?? "");
      res.writeHead(200, {
        "Content-Type": "application/rss+xml; charset=utf-8",
      });
      res.end(
        "<?xml version=\"1.0\"?><rss version=\"2.0\"><channel><title>Proxy Feed</title></channel></rss>",
      );
    });

    await listen(proxy);
    const address = proxy.address();
    if (!address || typeof address === "string") {
      throw new Error("Unable to bind proxy test server");
    }

    process.env.RSS_FETCH_PROXY = `http://127.0.0.1:${address.port}`;

    const xml = await fetchFeedXml("http://rsshub.example/demo");

    expect(xml).toContain("<title>Proxy Feed</title>");
    expect(seenRequests).toEqual(["http://rsshub.example:80/demo"]);

    await close(proxy);
  });

  test("accepts proxy credentials with malformed percent escapes", async () => {
    const seenProxyAuthorizations: Array<string | undefined> = [];
    const proxy = http.createServer((req, res) => {
      seenProxyAuthorizations.push(req.headers["proxy-authorization"]);
      res.writeHead(200, {
        "Content-Type": "application/rss+xml; charset=utf-8",
      });
      res.end(
        "<?xml version=\"1.0\"?><rss version=\"2.0\"><channel><title>Proxy Feed</title></channel></rss>",
      );
    });

    await listen(proxy);
    const address = proxy.address();
    if (!address || typeof address === "string") {
      throw new Error("Unable to bind proxy test server");
    }

    process.env.RSS_FETCH_PROXY = `http://user:p%@127.0.0.1:${address.port}`;

    const xml = await fetchFeedXml("http://rsshub.example/demo");

    expect(xml).toContain("<title>Proxy Feed</title>");
    expect(seenProxyAuthorizations).toEqual([
      `Basic ${Buffer.from("user:p%").toString("base64")}`,
    ]);

    await close(proxy);
  });

  test("decodes valid percent-encoded proxy credentials", async () => {
    const seenProxyAuthorizations: Array<string | undefined> = [];
    const proxy = http.createServer((req, res) => {
      seenProxyAuthorizations.push(req.headers["proxy-authorization"]);
      res.writeHead(200, {
        "Content-Type": "application/rss+xml; charset=utf-8",
      });
      res.end(
        "<?xml version=\"1.0\"?><rss version=\"2.0\"><channel><title>Proxy Feed</title></channel></rss>",
      );
    });

    await listen(proxy);
    const address = proxy.address();
    if (!address || typeof address === "string") {
      throw new Error("Unable to bind proxy test server");
    }

    process.env.RSS_FETCH_PROXY = `http://u%3Aer:p%3A@127.0.0.1:${address.port}`;

    const xml = await fetchFeedXml("http://rsshub.example/demo");

    expect(xml).toContain("<title>Proxy Feed</title>");
    expect(seenProxyAuthorizations).toEqual([
      `Basic ${Buffer.from("u:er:p:").toString("base64")}`,
    ]);

    await close(proxy);
  });

  test("can bypass RSS_FETCH_PROXY for direct feed requests", async () => {
    const seenProxyRequests: string[] = [];
    const upstream = http.createServer((_req, res) => {
      res.writeHead(200, {
        "Content-Type": "application/rss+xml; charset=utf-8",
      });
      res.end(
        "<?xml version=\"1.0\"?><rss version=\"2.0\"><channel><title>Direct Feed</title></channel></rss>",
      );
    });
    const proxy = http.createServer((req, res) => {
      seenProxyRequests.push(req.url ?? "");
      res.writeHead(502);
      res.end("proxy should not be used");
    });

    await listen(upstream);
    await listen(proxy);
    const upstreamAddress = upstream.address();
    const proxyAddress = proxy.address();
    if (
      !upstreamAddress ||
      typeof upstreamAddress === "string" ||
      !proxyAddress ||
      typeof proxyAddress === "string"
    ) {
      throw new Error("Unable to bind feed test servers");
    }

    process.env.RSS_FETCH_PROXY = `http://127.0.0.1:${proxyAddress.port}`;

    const xml = await fetchFeedXml(
      `http://127.0.0.1:${upstreamAddress.port}/feed.xml`,
      { useProxy: false },
    );

    expect(xml).toContain("<title>Direct Feed</title>");
    expect(seenProxyRequests).toEqual([]);

    await close(upstream);
    await close(proxy);
  });

  test("includes upstream response details for failed feed requests", async () => {
    const upstream = http.createServer((_req, res) => {
      res.writeHead(421, {
        "Content-Type": "application/json; charset=utf-8",
      });
      res.end(JSON.stringify({ error: "RSSHub route blocked", route: "/demo" }));
    });

    await listen(upstream);
    const address = upstream.address();
    if (!address || typeof address === "string") {
      throw new Error("Unable to bind upstream test server");
    }

    const url = `http://127.0.0.1:${address.port}/demo`;
    const promise = fetchFeedXml(url);

    await expect(promise).rejects.toThrow(FeedFetchHttpError);
    await expect(promise).rejects.toThrow("Upstream returned HTTP 421");
    await expect(promise).rejects.toThrow("RSSHub route blocked");
    await expect(promise).rejects.toThrow(url);

    await close(upstream);
  });

  test("marks Cloudflare challenge responses", async () => {
    const upstream = http.createServer((_req, res) => {
      res.writeHead(403, {
        Server: "cloudflare",
        "CF-Ray": "demo",
        "Content-Type": "text/html; charset=utf-8",
      });
      res.end("<html><title>Just a moment...</title><script src=\"/cdn-cgi/challenge-platform/h/b/orchestrate/chl_page/v1\"></script></html>");
    });

    await listen(upstream);
    const address = upstream.address();
    if (!address || typeof address === "string") {
      throw new Error("Unable to bind upstream test server");
    }

    const url = `http://127.0.0.1:${address.port}/demo`;

    try {
      await fetchFeedXml(url);
      throw new Error("Expected Cloudflare response to fail");
    } catch (error) {
      expect(error).toBeInstanceOf(FeedFetchHttpError);
      expect((error as FeedFetchHttpError).blockedByCloudflare).toBe(true);
      expect(String(error)).toContain("blocked by Cloudflare");
    }

    await close(upstream);
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
