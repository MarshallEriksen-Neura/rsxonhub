# 数据库迁移指南

## 问题背景

在开发过程中，如果使用 `db:push` 直接同步 schema 到数据库，会导致：
- 数据库中已有业务表（`ai_configs`、`articles`、`feeds` 等）
- 但 `drizzle.__drizzle_migrations` 表中没有对应的迁移历史记录

当运行 `db:migrate` 时，Drizzle 会尝试从 `0000` 开始重跑所有迁移，导致错误：
```
ERROR: relation "ai_configs" already exists
```

## 解决方案

### 开发环境

继续使用 `bun run db:push`，它不会检查迁移历史，直接同步 schema：

```bash
bun run db:push
```

### 生产环境

生产环境的 Docker 容器启动时会自动处理这个问题：

1. **执行迁移**：`npx drizzle-kit migrate`
2. **自动修复**：应用启动时 `bootstrapDatabase()` 会检测并自动插入缺失的迁移记录

#### 工作流程

```
容器启动
  ↓
执行 drizzle-kit migrate
  ↓
  ├─ 如果是全新数据库 → 正常执行所有迁移 ✅
  ├─ 如果表已存在但无迁移记录 → 失败（预期）
  ↓
应用启动 (instrumentation.ts)
  ↓
bootstrapDatabase()
  ↓
检测到表存在但迁移记录为空
  ↓
自动插入迁移记录（标记为已完成）
  ↓
后续迁移正常工作 ✅
```

#### 关键代码

见 [`lib/db/bootstrap.ts`](../lib/db/bootstrap.ts) 中的 `initAIConfigs()` 函数：

```typescript
// 检查迁移历史是否存在，如果表存在但没有迁移记录，自动插入
try {
  const [migrationResult] = await db.execute<{ count: number }>(
    sql`SELECT COUNT(*) as "count" FROM drizzle.__drizzle_migrations`,
  );
  const migrationCount = Number(migrationResult?.count ?? 0);

  if (migrationCount === 0) {
    console.log("⚠️  Business tables exist but no migration history found. Inserting migration records...");
    
    // 插入迁移记录（标记所有迁移为已完成）
    const migrations = [
      { id: 1, hash: "0000_mighty_black_panther" },
      { id: 2, hash: "0001_youthful_pyro" },
      // ... 更多迁移
    ];

    for (const migration of migrations) {
      await db.execute(
        sql`INSERT INTO drizzle.__drizzle_migrations (id, hash, created_at) 
            VALUES (${migration.id}, ${migration.hash}, EXTRACT(EPOCH FROM NOW()) * 1000)
            ON CONFLICT DO NOTHING`,
      );
    }
    
    console.log("✅ Migration records inserted successfully.");
  }
} catch (error) {
  // 如果 __drizzle_migrations 表不存在，忽略错误
  console.log("Migration table does not exist yet. Will be created by drizzle-kit migrate.");
}
```

## 最佳实践

### 开发阶段
- 使用 `db:push` 快速迭代
- 定期运行 `db:generate` 生成迁移文件
- 重要变更时手动测试 `db:migrate`

### 生产部署
- 确保 Docker 镜像包含迁移文件（`lib/db/migrations/`）
- 容器启动时自动执行迁移
- 首次部署后，迁移历史会自动同步

### 添加新迁移

```bash
# 1. 修改 schema.ts
# 2. 生成迁移文件
bun run db:generate

# 3. 检查生成的 SQL 文件
# lib/db/migrations/000X_*.sql

# 4. 本地测试
bun run db:migrate

# 5. 提交代码（包含新的迁移文件）
git add lib/db/migrations/
git commit -m "Add migration for XYZ"
```

## 故障排查

### 问题：迁移失败，提示表已存在

**原因**：数据库已有表但缺少迁移历史

**解决**：
1. 重启容器，`bootstrapDatabase()` 会自动修复
2. 或手动插入迁移记录：

```sql
INSERT INTO drizzle.__drizzle_migrations (id, hash, created_at) VALUES
(1, '0000_mighty_black_panther', EXTRACT(EPOCH FROM NOW()) * 1000),
(2, '0001_youthful_pyro', EXTRACT(EPOCH FROM NOW()) * 1000),
(3, '0002_lying_naoko', EXTRACT(EPOCH FROM NOW()) * 1000),
(4, '0003_repair_feed_fetch_runs', EXTRACT(EPOCH FROM NOW()) * 1000),
(5, '0004_careful_swarm', EXTRACT(EPOCH FROM NOW()) * 1000);
```

### 问题：全新部署失败

**检查清单**：
- [ ] `DATABASE_URL` 环境变量正确配置
- [ ] Docker 镜像包含 `lib/db/migrations/` 目录
- [ ] PostgreSQL 服务正常运行
- [ ] 数据库用户有创建表和扩展的权限

### 问题：pgvector 扩展未启用

首次迁移前需要手动启用 pgvector 扩展：

```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

或在应用启动时自动执行（见 [`lib/db/schema.ts`](../lib/db/schema.ts) 的 `ENABLE_PGVECTOR`）。

## 相关文档

- [Drizzle ORM 迁移文档](https://orm.drizzle.team/docs/kit-overview)
- [Docker 部署指南](./DEPLOYMENT.md)
