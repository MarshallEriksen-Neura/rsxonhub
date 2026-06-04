import { compare } from "bcryptjs";
import { eq } from "drizzle-orm";
import {
  ensureDatabaseBootstrapped,
  isMissingRelationError,
} from "@/lib/db/bootstrap";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";

type CredentialsInput = {
  username: string;
  password: string;
};

type AuthUser = {
  id: string;
  name: string;
};

async function verifyDatabaseUser({
  username,
  password,
}: CredentialsInput): Promise<AuthUser | null> {
  await ensureDatabaseBootstrapped();

  let user:
    | {
        id: number;
        username: string;
        passwordHash: string;
      }
    | undefined;

  try {
    [user] = await db
      .select({
        id: users.id,
        username: users.username,
        passwordHash: users.passwordHash,
      })
      .from(users)
      .where(eq(users.username, username))
      .limit(1);
  } catch (error) {
    if (isMissingRelationError(error)) {
      console.warn(
        'Cannot verify credentials because table "users" does not exist. Run `bun run db:push` or `bun run db:migrate` first.',
      );
      return null;
    }

    throw error;
  }

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
  return verifyDatabaseUser(credentials);
}
