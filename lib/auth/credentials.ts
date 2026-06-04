import { compare } from "bcryptjs";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { env } from "@/lib/env";

type CredentialsInput = {
  username: string;
  password: string;
};

type AuthUser = {
  id: string;
  name: string;
};

async function verifyEnvUser({
  username,
  password,
}: CredentialsInput): Promise<AuthUser | null> {
  if (!env.AUTH_USERNAME || !env.AUTH_PASSWORD_HASH) {
    return null;
  }

  if (username !== env.AUTH_USERNAME) {
    return null;
  }

  const isValid = await compare(password, env.AUTH_PASSWORD_HASH);

  if (!isValid) {
    return null;
  }

  return {
    id: "env-single-user",
    name: username,
  };
}

async function verifyDatabaseUser({
  username,
  password,
}: CredentialsInput): Promise<AuthUser | null> {
  const [user] = await db
    .select({
      id: users.id,
      username: users.username,
      passwordHash: users.passwordHash,
    })
    .from(users)
    .where(eq(users.username, username))
    .limit(1);

  if (!user) {
    return null;
  }

  const isValid = await compare(password, user.passwordHash);

  if (!isValid) {
    return null;
  }

  return {
    id: String(user.id),
    name: user.username,
  };
}

export async function verifyCredentials(
  credentials: CredentialsInput,
): Promise<AuthUser | null> {
  return (
    (await verifyEnvUser(credentials)) ?? (await verifyDatabaseUser(credentials))
  );
}
