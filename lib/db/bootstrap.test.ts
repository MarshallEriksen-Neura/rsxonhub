import { describe, expect, mock, test } from "bun:test";

process.env.DATABASE_URL ??= "postgresql://user:password@localhost:5432/rsxonhub_test";

const hashMock = mock(async () => "hashed-env-password");
const onConflictDoNothingMock = mock(() => Promise.resolve());
const onConflictDoUpdateMock = mock(() => Promise.resolve());
let executeCallCount = 0;
const insertMock = mock(() => ({
  values: mock(() => ({
    onConflictDoNothing: onConflictDoNothingMock,
    onConflictDoUpdate: onConflictDoUpdateMock,
  })),
}));

mock.module("bcryptjs", () => ({
  hash: hashMock,
}));

mock.module("@/lib/env", () => ({
  env: {
    AUTH_USERNAME: "admin",
    AUTH_PASSWORD: "secret",
    DATABASE_URL: process.env.DATABASE_URL,
  },
}));

mock.module("@/lib/db", () => ({
  db: {
    execute: mock(async () => {
      executeCallCount += 1;
      return executeCallCount === 1 ? [{ exists: false }] : [{ exists: true }];
    }),
    insert: insertMock,
  },
}));

describe("database bootstrap", () => {
  test("does not overwrite an existing env-seeded user's password", async () => {
    const { bootstrapDatabase } = await import("@/lib/db/bootstrap");

    await bootstrapDatabase();

    expect(hashMock).toHaveBeenCalledWith("secret", 12);
    expect(onConflictDoNothingMock).toHaveBeenCalled();
    expect(onConflictDoUpdateMock).not.toHaveBeenCalled();
  });
});
