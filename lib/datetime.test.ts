import { describe, expect, test } from "bun:test";
import {
  getScheduleLocalDate,
  getScheduleLocalMinutes,
  isWithinDailyDigestWindow,
  parseClockTime,
  toIsoString,
} from "./datetime";

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

describe("schedule local time helpers", () => {
  test("resolves Asia/Shanghai date at UTC boundary", () => {
    expect(
      getScheduleLocalDate("Asia/Shanghai", new Date("2026-06-05T00:00:00.000Z")),
    ).toBe("2026-06-05");
  });

  test("resolves local minutes for schedule checks", () => {
    expect(
      getScheduleLocalMinutes("Asia/Shanghai", new Date("2026-06-05T00:03:00.000Z")),
    ).toBe(8 * 60 + 3);
  });

  test("validates digest window", () => {
    expect(
      isWithinDailyDigestWindow(new Date("2026-06-05T00:03:00.000Z"), {
        timeZone: "Asia/Shanghai",
        at: parseClockTime("08:00"),
        windowMinutes: 10,
      }),
    ).toBe(true);
    expect(
      isWithinDailyDigestWindow(new Date("2026-06-05T00:10:00.000Z"), {
        timeZone: "Asia/Shanghai",
        at: parseClockTime("08:00"),
        windowMinutes: 10,
      }),
    ).toBe(false);
  });

  test("rejects invalid clock strings", () => {
    expect(() => parseClockTime("25:99")).toThrow("Invalid clock time");
    expect(() => parseClockTime("8:00")).toThrow("Invalid clock time");
  });
});
