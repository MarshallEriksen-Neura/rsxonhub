import { describe, expect, test } from "bun:test";
import { normalizePostgresUrl, parsePostgresUrl } from "@/lib/database-url";

describe("Postgres URL normalization", () => {
  test("encodes malformed percent escapes in credentials", () => {
    expect(
      normalizePostgresUrl("postgresql://user:p%@localhost:5432/rsxonhub"),
    ).toBe("postgresql://user:p%25@localhost:5432/rsxonhub");
  });

  test("preserves valid percent-encoded credential semantics", () => {
    expect(
      normalizePostgresUrl("postgresql://u%3Aer:p%3A@localhost:5432/rsxonhub"),
    ).toBe("postgresql://u%3Aer:p%3A@localhost:5432/rsxonhub");
  });

  test("encodes bare at signs inside passwords using the last host delimiter", () => {
    expect(
      normalizePostgresUrl("postgresql://user:p@ss%word@localhost:5432/rsxonhub"),
    ).toBe("postgresql://user:p%40ss%25word@localhost:5432/rsxonhub");
  });

  test("keeps URLs without credentials unchanged", () => {
    expect(normalizePostgresUrl("postgresql://localhost:5432/rsxonhub")).toBe(
      "postgresql://localhost:5432/rsxonhub",
    );
  });

  test("rejects non-Postgres protocols", () => {
    expect(() => parsePostgresUrl("https://localhost/db")).toThrow(
      "DATABASE_URL must use postgres or postgresql.",
    );
  });
});
