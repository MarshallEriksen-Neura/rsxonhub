import { sql } from "drizzle-orm";

export function queueStateInSql(states: readonly string[]) {
  if (states.length === 0) {
    return sql`false`;
  }

  return sql`state::text in (${sql.join(
    states.map((state) => sql`${state}`),
    sql`, `,
  )})`;
}
