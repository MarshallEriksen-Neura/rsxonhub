import { describe, expect, test } from "bun:test";
import { encodeArticleCursor, parseArticleCursor } from "./cursor";

describe("article cursor", () => {
  test("round-trips and normalizes cursor dates to ISO strings", () => {
    const cursor = encodeArticleCursor({
      sortAt: "Thu Apr 09 2026 14:52:14 GMT+0800 (China Standard Time)",
      id: 50,
    });

    expect(parseArticleCursor(cursor)).toEqual({
      sortAt: "2026-04-09T06:52:14.000Z",
      id: 50,
    });
  });

  test("returns null for invalid cursors", () => {
    expect(parseArticleCursor(null)).toBeNull();
    expect(parseArticleCursor("not-base64-json")).toBeNull();
    expect(
      parseArticleCursor(
        Buffer.from(JSON.stringify({ sortAt: "not-a-date", id: 50 })).toString(
          "base64url",
        ),
      ),
    ).toBeNull();
    expect(
      parseArticleCursor(
        Buffer.from(
          JSON.stringify({ sortAt: "2026-04-09T06:52:14.000Z", id: 50.5 }),
        ).toString("base64url"),
      ),
    ).toBeNull();
  });
});
