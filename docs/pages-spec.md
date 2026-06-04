# rsxonhub 页面规格（产品核心）

> 本文是 rsxonhub 的**页面与界面规格**，回答“需要哪些页面、每个页面显示什么”。
> 产品/架构权威定义见仓库根的产品记忆与 `CLAUDE.md`；视觉 token（颜色/字体/组件样式）见 `docs/product-design.md` 与 `notion/DESIGN.md`（Notion 风格设计系统）。
> 本文只定义**功能页面结构**，样式直接复用上述设计系统的 token。

## 产品定位

单用户、登录保护的 **RSS × AI 阅读器**。三大 AI 能力决定页面结构：

1. 自动**摘要 / 标签 / 重要度评分**
2. 每日 **digest（精选简报）**
3. 全库 **RAG 问答**（带来源引用）

**单用户**意味着：无注册、无定价/企业/营销页、无多租户。登录只是一道保护数据的锁。
Notion 设计系统里的 pricing / enterprise / startups / hero 营销页**一律不用**。

## 全局结构

- **AppShell**：登录后所有页共享。左侧主导航：订阅(`/feed`) / 每日精选(`/digest`) / AI 问答(`/chat`) / 设置(`/settings`)。
- **视觉**：紫色 `primary` 作主 CTA；按钮 `rounded.md`、卡片 `rounded.lg`；Notion-Sans 字体；pastel tag 色映射 AI 标签分类。
- **`middleware.ts`**：保护所有页面与读写 API。未认证页面跳 `/login`，API 返回 401。

## 页面清单

### 1. `/login` — 登录页（唯一公开页）

- 居中单卡片（`card-base`），不用深色 hero band。
- `text-input`（用户名/邮箱）+ 密码 input + 紫色 `button-primary`「登录」。
- 错误态用 `semantic-error` 文案行。
- **无注册链接**（单用户）。

### 2. `/feed` — 主阅读界面（核心，三栏）

产品心脏。经典三栏布局：

- **左栏 · 订阅源侧边栏**
  - `feeds` / 文件夹列表，每项：源名 + 未读数 badge。
  - 顶部虚拟视图：全部 / 未读 / 收藏 / 每日精选。
  - 激活态用 `body-sm-medium`。底部进设置入口。
- **中栏 · 文章列表**
  - 每条：标题、来源、时间、**AI 重要度**（badge 分级：高=紫/橙，中=黄）、**AI 标签 chips**（`badge-tag-*`）、一行 AI 摘要预览。
  - 已读/未读视觉区分。
  - 顶部：`search-pill` + `segmented-tab`（最新 / 重要度排序）。
- **右栏 · 文章详情**
  - 全文（图片按 URL 展示——锁定决策，不嵌入向量）、来源原文链接。
  - 完整 AI 摘要卡（`card-feature`）+ 标签 + 重要度。
  - 顶部「问 AI」按钮：把当前文章带入 `/chat`。

**移动端**：三栏塌成单栏 + 抽屉式侧边栏（见设计系统 collapsing strategy）。

### 3. 添加订阅源（模态，非独立页）

- `text-input` 贴 RSS URL → 校验 → 抓取预览 → 确认订阅。
- 失败态：URL 无效 / 抓取失败提示。
- 依赖 `articles(feed_id, guid)` 唯一索引去重。

### 4. `/digest` — 每日精选

- 顶部日期切换器（`pill-tab` 选日期）。
- 当天 AI 简报正文（`card-feature` / `cta-banner-light` 风格大卡）。
- 下方被选入精选的文章卡列表，每张带摘要 + 跳原文。
- 空态：「今天还没生成精选」。

### 5. `/chat` — RAG 问答（AI 核心差异点）

- 类 ChatGPT 布局：中间消息流 + 底部 `text-input` + 紫色发送按钮。
- **每条 AI 回答下方挂「来源引用」卡片**（`card-base` 小卡：被引用文章标题 + 跳转链接）——RAG 招牌特性，必须显眼。
- 左侧可选 `conversations` 历史列表（对应 conversations / messages 表）。

### 6. `/settings` — 设置

单用户，设置项少，用 `segmented-tab` 分区：

- **订阅管理**：列出所有 feeds，改名 / 删除 / 调抓取频率。
- **AI 配置**：展示并保存当前 chat / embedding 的 baseURL、API Key、model（写入 `ai_configs`）。展示「embedding 已锁定 N 维」只读提示。
- **抓取状态**：上次抓取时间 + `usage_logs` 简要统计。
- **账号**：改密码、登出。

## 优先级与构建顺序

| 优先级 | 页面 | 依赖后端能力 | 状态 |
|---|---|---|---|
| P0 | `/login` + middleware | Auth.js | 未建 |
| P0 | `/feed` 三栏 | feeds/articles/read_states + rss-parser | 未建 |
| P0 | 添加订阅（模态） | feed 校验 + 抓取 | 未建 |
| P1 | 文章 AI 摘要/标签/重要度 | article_summaries | 未建 |
| P1 | `/digest` | 每日精选生成 | 未建 |
| P2 | `/chat` RAG | article_chunks(pgvector) + 向量检索 + 引用 | 未建，**先确认 embedding 维度** |
| P2 | `/settings` | usage_logs | 未建 |

**构建顺序**（与锁定决策一致）：
1. 骨架：Auth + Drizzle/pgvector + 订阅/抓取/列表
2. AI 增强：摘要 + 标签 + 每日 digest
3. RAG：embedding pipeline + 向量检索 + 问答 + 引用

> `/chat` 放最后：依赖 embedding pipeline。`article_chunks.embedding vector(...)` 的维度由源码常量和迁移锁定；如果后续更换不同维度的 embedding 模型，需要迁移 + 重嵌整库，而不是只改设置页。

## 明确不做

定价页、企业页、Startups、营销 hero、logo wall、FAQ —— 均为 Notion 官网营销页，单用户工具不需要。
