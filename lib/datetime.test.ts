import { describe, expect, test } from "bun:test";
import { toIsoString } from "./datetime";

describe("toIsoString", () => {
  test("serializes Date values", () => {
    expect(toIsoString(new Date("2026-06-01T12:30:00.000Z"))).toBe(
      "2026-06-01T12:30:00.000Z",
    );
  });

  test("serializes database string values", () => {
    expect(toIsoString("2026-06-01T12:30:00.000Z")).toBe(
      "2026-06-01T12:30:00.000Z",
    );
  });

  test("returns null for missing or invalid values", () => {
    expect(toIsoString(null)).toBeNull();
    expect(toIsoString("not-a-date")).toBeNull();
  });
});
