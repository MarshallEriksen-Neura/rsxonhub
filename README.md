# rsxonhub

单用户 RSS × AI 阅读器。自动摘要、标签、重要性评分，每日 Digest，以及对全订阅库的 RAG 问答。

![应用截图](docs/images/hero.png)

## 功能

![功能概览](docs/images/features.png)

| 模块 | 说明 |
|------|------|
| 📡 RSS 订阅管理 | 添加/删除 Feed，RSSHub 代理，订阅统计 |
| 🤖 AI 增强 | 自动摘要、标签分类、重要性评分 |
| 💬 RAG 问答 | 对全部文章库提问，返回带来源引用的答案 |
| 📋 每日 Digest | 聚合当天重要文章，AI 生成摘要报告 |
| ⚙️ 后台队列 | pg-boss 管理 RSS 抓取与 AI 处理任务，含队列监控 |
| 🔐 单用户认证 | Auth.js v5 Credentials + bcrypt，全站保护 |

## 截图

### 订阅阅读

![订阅阅读](docs/images/hero.png)

### AI 问答

![AI 问答](docs/images/ai-chat.png)

### 队列状态

![队列状态](docs/images/queue-status.png)

## 架构

![系统架构](docs/images/architecture.png)

## 技术栈

- **框架**: Next.js 16 App Router + React 19 + TypeScript strict
- **数据库**: PostgreSQL + pgvector，Drizzle ORM
- **AI**: Vercel AI SDK，支持任意 OpenAI-compatible 接口（含 NVIDIA NIM）
- **队列**: pg-boss
- **认证**: Auth.js v5
- **UI**: RetroUI + Tailwind v4
- **包管理**: Bun

## 快速开始

**前置条件**: Bun 1.x，PostgreSQL 15+（已启用 pgvector 扩展）

```bash
git clone https://github.com/yourname/rsxonhub
cd rsxonhub
bun install
cp .env.example .env
# 编辑 .env，至少填写 DATABASE_URL 和 AUTH_SECRET
bun run db:migrate
bun run dev
```

访问 http://localhost:3000。在另一个终端启动后台 worker：

```bash
bun run worker
```

## 环境变量

```env
DATABASE_URL=postgresql://user:pass@localhost:5432/rsxonhub
AUTH_SECRET=<随机长字符串，可用 openssl rand -base64 32 生成>
```

> AI 接口（Base URL、API Key、模型）在应用内 **设置页面** 中配置，无需写入环境变量。

## 常用命令

```bash
bun run dev          # 开发服务器
bun run build        # 生产构建（含类型检查）
bun run lint         # ESLint
bun run test         # 单元测试
bun run worker       # 后台任务 worker
bun run db:generate  # 生成 Drizzle 迁移文件
bun run db:migrate   # 执行数据库迁移
bun run db:studio    # 打开 Drizzle Studio
```

## 部署

内置多种部署配置：

- `docker-compose.yml` — 本地/VPS 自托管
- `docker-compose.dokploy.yml` — Dokploy 生产部署
- `render.yaml` — Render 一键部署

详见 [docs/deployment-checklist.md](docs/deployment-checklist.md) 和 [docs/quick-deployment-reference.md](docs/quick-deployment-reference.md)。

## 注意事项

- **pgvector 维度在建表时固定**，更换 embedding 模型维度需创建新迁移，不能仅改配置。
- **NVIDIA embedding** 需传 `input_type`：入库用 `passage`，检索用 `query`，缺失会静默降低质量。
- 图片仅存储 URL 用于展示，不参与向量化。

## 文档

- [产品设计](docs/product-design.md)
- [数据库迁移](docs/database-migration.md)
- [部署清单](docs/deployment-checklist.md)
- [部署快速参考](docs/quick-deployment-reference.md)

## AI 接口推荐

本项目开发使用 [Unity2.ai](https://unity2.ai/dashboard) 提供的免费 Token 驱动。支持纯血 Claude、ChatGPT 等主流模型，价格实惠。

## 社区与更新

认同 `真诚`、`友善`、`团结`、`专业`，欢迎加入 [LinuxDo](https://linux.do/latest)。

## License

MIT
