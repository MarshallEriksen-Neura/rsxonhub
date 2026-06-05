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
