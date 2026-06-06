import { describe, expect, test } from "bun:test";
import { sql } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import { queueStateInSql } from "@/lib/jobs/queue-sql";

const dialect = new PgDialect();

describe("queue SQL helpers", () => {
  test("renders pg-boss state filters as a parameterized IN list", () => {
    const query = dialect.sqlToQuery(sql`
      select count(*)::int as count
      from pgboss.job
      where name = ${"article.embed"}
        and ${queueStateInSql(["created", "retry"])}
    `);

    expect(query.sql).toContain("state::text in ($2, $3)");
    expect(query.sql).not.toContain("any(($2, $3))");
    expect(query.params).toEqual(["article.embed", "created", "retry"]);
  });

  test("empty state filters are always false", () => {
    const query = dialect.sqlToQuery(sql`
      select count(*)::int as count
      from pgboss.job
      where name = ${"article.embed"}
        and ${queueStateInSql([])}
    `);

    expect(query.sql).toContain("and false");
    expect(query.params).toEqual(["article.embed"]);
  });
});
