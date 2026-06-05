import { PgBoss } from "pg-boss";
import { env } from "@/lib/env";
import { JOB_NAMES } from "@/lib/jobs/names";

const globalForBoss = globalThis as unknown as {
  boss?: PgBoss;
  bossStart?: Promise<PgBoss>;
};

export function getBoss() {
  globalForBoss.boss ??= new PgBoss({
    connectionString: env.DATABASE_URL,
  });

  return globalForBoss.boss;
}

export async function startBoss() {
  const boss = getBoss();
  globalForBoss.bossStart ??= boss.start().then(async () => {
    await Promise.all(
      Object.values(JOB_NAMES).map((queueName) => boss.createQueue(queueName)),
    );
    return boss;
  });
  return globalForBoss.bossStart;
}

export async function stopBoss() {
  if (!globalForBoss.boss) {
    return;
  }

  await globalForBoss.boss.stop();
  globalForBoss.boss = undefined;
  globalForBoss.bossStart = undefined;
}
