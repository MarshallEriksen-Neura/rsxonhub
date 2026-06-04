export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") {
    return;
  }

  const { bootstrapDatabase } = await import("@/lib/db/bootstrap");
  await bootstrapDatabase();
}
