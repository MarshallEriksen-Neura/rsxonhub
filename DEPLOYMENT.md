# 🚀 部署指南

本文档提供 rsxonhub 项目的完整部署说明，涵盖从本地开发到生产环境的各种场景。

## 📋 目录

- [快速开始](#快速开始)
- [环境要求](#环境要求)
- [Docker Compose 部署](#docker-compose-部署推荐)
- [云平台部署](#云平台部署)
  - [Railway](#railway-部署)
  - [Render](#render-部署)
- [自托管 PaaS 部署](#自托管-paas-部署)
  - [Dokploy](#dokploy-部署)
  - [Coolify](#coolify-部署)
- [环境变量配置](#环境变量配置)
- [数据库管理](#数据库管理)
- [监控与运维](#监控与运维)
- [故障排查](#故障排查)
- [性能优化](#性能优化)

---

---

## 快速开始

### 5 分钟部署 (Docker)

```bash
# 1. 克隆仓库
git clone <your-repo-url>
cd rsxonhub

# 2. 配置环境变量
cp .env.example .env.local
# 编辑 .env.local,填入必要值（见下方环境变量章节）

# 3. 一键启动
DB_PASSWORD=your_secure_password ./deploy.sh start

# Windows PowerShell:
# $env:DB_PASSWORD='your_secure_password'; .\deploy.ps1 start

# 4. 访问应用
# http://localhost:3000
```

---

## 环境要求

### 最低要求

- **CPU**: 2 cores
- **内存**: 2GB RAM (推荐 4GB)
- **存储**: 10GB 可用空间
- **网络**: 稳定的互联网连接（用于 RSS 抓取）

### 软件依赖

**本地开发:**
- Node.js 20.x 或更高版本
- PostgreSQL 16.x
- npm / yarn / pnpm / bun

**容器化部署:**
- Docker 20.10+
- Docker Compose v2.0+

**操作系统:**
- Linux (Ubuntu 20.04+, CentOS 8+)
- macOS 12+
- Windows 10/11 (WSL2 推荐)

---

## Docker Compose 部署（推荐）

### 架构概览

```
┌─────────────────┐
│   Traefik       │ ← SSL/TLS termination (可选)
│   (Reverse Proxy)│
└────────┬────────┘
         │
    ┌────▼────┐     ┌──────────┐
    │ Next.js │────▶│PostgreSQL│
    │ App     │     │   :5432  │
    │ :3000   │     └──────────┘
    └────────┘          ▲
         │              │
    ┌────▼────┐         │
    │ Worker  │─────────┘
    │(Background)│
    └─────────┘
         │
    ┌────▼────┐
    │ RSSHub  │ ← Feed discovery (可选)
    └─────────┘
```

### 详细步骤

#### 1. 准备环境文件

```bash
cp .env.example .env.local
```

编辑 `.env.local`（参考 [环境变量配置](#环境变量配置) 章节）：

```env
# 数据库 (Docker 会自动配置,无需修改)
DATABASE_URL=postgresql://rsxonhub:${DB_PASSWORD}@db:5432/rsxonhub

# RSSHub (可选,默认使用公共实例)
RSSHUB_BASE_URL=https://rsshub.app

# 认证 (必须配置)
AUTH_SECRET=<运行: openssl rand -base64 32>
AUTH_USERNAME=admin
AUTH_PASSWORD=your_strong_password
```

#### 2. 生成密钥

```bash
# 生成 AUTH_SECRET (Linux/macOS)
openssl rand -base64 32

# Windows PowerShell
[System.Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Minimum 0 -Maximum 256 }))
```

#### 3. 启动服务

**Linux/macOS:**
```bash
DB_PASSWORD=your_secure_password docker-compose up -d
```

**Windows PowerShell:**
```powershell
$env:DB_PASSWORD='your_secure_password'
docker-compose up -d
```

**使用部署脚本 (推荐):**
```bash
# Linux/macOS
chmod +x deploy.sh
DB_PASSWORD=mypassword ./deploy.sh start

# Windows PowerShell
$env:DB_PASSWORD='mypassword'; .\deploy.ps1 start
```

#### 4. 初始化数据库

容器启动后，数据库会自动迁移。如需手动执行：

```bash
docker-compose exec app npx drizzle-kit push
```

#### 5. 验证部署

```bash
# 检查服务状态
docker-compose ps

# 查看日志
docker-compose logs -f app
docker-compose logs -f worker

# 健康检查
curl http://localhost:3000/api/health
```

预期响应：
```json
{
  "status": "ok",
  "timestamp": "2026-06-06T12:00:00.000Z",
  "service": "rsxonhub"
}
```

### 管理命令

```bash
# 停止服务
docker-compose down

# 重启特定服务
docker-compose restart app
docker-compose restart worker

# 查看资源使用
docker stats

# 更新部署
git pull
DB_PASSWORD=your_password docker-compose up -d --build

# 备份数据库
docker-compose exec db pg_dump -U rsxonhub rsxonhub > backup.sql

# 恢复数据库
cat backup.sql | docker-compose exec -T db psql -U rsxonhub rsxonhub
```

### 使用部署脚本 (推荐)

**Linux/Mac:**

```bash
chmod +x deploy.sh

# 启动
DB_PASSWORD=mypassword ./deploy.sh start

# 查看日志
./deploy.sh logs worker

# 备份
./deploy.sh backup

# 更新
./deploy.sh update
```

**Windows PowerShell:**

```powershell
# 启动
$env:DB_PASSWORD='mypassword'; .\deploy.ps1 start

# 查看日志
.\deploy.ps1 logs worker

# 备份
.\deploy.ps1 backup

# 更新
.\deploy.ps1 update
```

---

## 云平台部署

### Railway 部署

Railway 提供简单的 Git-based 部署，适合快速上线。

#### 一键部署

1. **创建 Railway 账户**
   - 访问 [railway.app](https://railway.app)
   - 使用 GitHub 登录

2. **新建项目**
   - 点击 "New Project"
   - 选择 "Deploy from GitHub repo"
   - 授权并选择 rsxonhub 仓库

3. **添加 PostgreSQL**
   - 在项目中点击 "+ New"
   - 选择 "Database" → "Add PostgreSQL"
   - Railway 会自动生成 `DATABASE_URL` 环境变量

4. **配置环境变量**
   
   在项目 Settings → Variables 中添加：
   ```env
   AUTH_SECRET=<生成的密钥>
   AUTH_USERNAME=admin
   AUTH_PASSWORD=your_strong_password
   RSSHUB_BASE_URL=https://rsshub.app
   DIGEST_TIMEZONE=Asia/Shanghai
   ```

5. **部署 Web 服务**
   - Railway 自动检测 `railway.json`
   - 自动构建和部署
   - 分配域名: `your-app.up.railway.app`

6. **部署 Worker 服务**
   - 点击 "+ New" → "Empty Service"
   - 命名为 `worker`
   - 设置 Start Command: `npm run worker`
   - 复制相同的环境变量（除 DATABASE_URL 外）

7. **初始化数据库**
   ```bash
   # 在 Railway Shell 中执行
   npx drizzle-kit push
   ```

#### Railway CLI (可选)

```bash
# 安装 CLI
npm i -g @railway/cli

# 登录
railway login

# 链接项目
railway link

# 部署
railway up

# 查看日志
railway logs

# 打开 Web Shell
railway shell
```

#### 定价

- **Hobby Plan**: $5/月，包含 $5  credits
- **Pro Plan**: $20/月，包含 $20 credits
- 每个服务按资源使用量计费

---

### Render 部署

Render 提供免费 tier，适合个人项目和测试。

#### Blueprint 部署

1. **创建 Render 账户**
   - 访问 [render.com](https://render.com)
   - 使用 GitHub 登录

2. **新建 Blueprint**
   - 点击 "New" → "Blueprint"
   - 连接 GitHub 仓库
   - Render 自动读取 `render.yaml`

3. **配置服务**
   
   Render 会创建：
   - **Web Service**: Next.js 应用
   - **Worker Service**: 后台任务
   - **PostgreSQL Database**: 数据库

4. **设置环境变量**
   
   在 Dashboard 中为 Web 和 Worker 服务配置：
   ```env
   AUTH_SECRET=<生成的密钥>
   AUTH_USERNAME=admin
   AUTH_PASSWORD=your_strong_password
   RSSHUB_BASE_URL=https://rsshub.app
   DIGEST_TIMEZONE=Asia/Shanghai
   ```

5. **部署**
   - 点击 "Apply"
   - 等待所有服务部署完成 (约 5-10 分钟)

6. **初始化数据库**
   ```bash
   # 在 Render Web Shell 中执行
   npx drizzle-kit push
   ```

#### 注意事项

**免费套餐限制:**
- Web 服务 15 分钟无活动后休眠
- PostgreSQL 90 天后需要重新创建
- 建议升级到 Starter Plan ($7/月) 用于生产

**性能优化:**
- 使用外部监控服务定期访问以保持活跃
- 考虑使用 Render 的 cron jobs 触发定期任务

#### 定价

- **Free Tier**: 有限资源，适合测试
- **Starter**: $7/月/服务
- **Standard**: $25/月/服务
- **Pro**: $100+/月/服务

---

## 自托管 PaaS 部署

### Dokploy 部署

Dokploy 是开源的 PaaS 平台，类似 Heroku/Vercel，可以自托管。

#### 安装 Dokploy

```bash
# 在 VPS 上执行（需要 root 权限）
curl -sSL https://get.dokploy.com | sh

# 访问控制面板
# http://your-server-ip:3000
```

#### 部署步骤

1. **连接 Git 仓库**
   - 在 Dokploy Dashboard 点击 "New Application"
   - 选择 "Git Repository"
   - 授权并选择你的 rsxonhub 仓库

2. **配置 Docker Compose**
   - Compose File Path: `docker-compose.dokploy.yml`
   - Build Context: `.`
   - 确保 `.env` 文件已正确配置

3. **设置环境变量**

   | 变量 | 说明 | 示例 |
   |------|------|------|
   | `DOMAIN` | 你的域名 | `rss.yourdomain.com` |
   | `DATABASE_URL` | 数据库连接 | `postgresql://rsxonhub:pass@db:5432/rsxonhub` |
   | `DB_PASSWORD` | 数据库密码 | `strong_password_123` |
   | `AUTH_SECRET` | NextAuth 密钥 | `<生成的随机字符串>` |
   | `AUTH_USERNAME` | 管理员用户名 | `admin` |
   | `AUTH_PASSWORD` | 管理员密码 | `your_strong_password` |
   | `RSSHUB_BASE_URL` | RSSHub 地址 | `https://rsshub.app` |
   | `DIGEST_TIMEZONE` | 时区 | `Asia/Shanghai` |

4. **部署**
   - 点击 "Deploy"
   - Traefik 会自动配置 SSL 证书
   - 等待构建完成 (约 2-5 分钟)

5. **初始化数据库**
   ```bash
   # 在 Dokploy Terminal 中执行
   npx drizzle-kit push
   ```

#### 高级配置

**自定义域名:**
- 在 Dokploy Dashboard → Settings → Domains 添加域名
- 配置 DNS A 记录指向服务器 IP
- Traefik 自动申请 Let's Encrypt 证书

**资源限制:**
```yaml
# docker-compose.dokploy.yml
deploy:
  resources:
    limits:
      memory: 2G
      cpus: '1.0'
    reservations:
      memory: 512M
      cpus: '0.25'
```

---

### Coolify 部署

Coolify 是另一个开源的、自托管的 PaaS 解决方案。

#### 安装 Coolify

```bash
# 在 VPS 上执行（需要 root 权限）
curl -fsSL https://cdn.coollabs.io/coolify/install.sh | bash

# 访问控制面板
# http://your-server-ip:8000
```

#### 部署步骤

Coolify 的配置与 Dokploy 类似：

1. **连接 Git 仓库**
   - 在 Coolify Dashboard 点击 "New Project"
   - 选择 "Git-based Service"
   - 授权 GitHub/GitLab

2. **选择配置文件**
   - 使用 `render.yaml` 或 `docker-compose.yml`
   - Coolify 支持多种部署方式

3. **配置环境变量**
   - 同 Dokploy 的环境变量设置
   - 支持从 .env 文件导入

4. **部署**
   - 点击 "Deploy"
   - 等待构建和启动

5. **初始化数据库**
   ```bash
   npx drizzle-kit push
   ```

#### Dokploy vs Coolify

| 特性 | Dokploy | Coolify |
|------|---------|---------|
| 易用性 | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ |
| 功能丰富度 | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| 社区活跃度 | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| 文档质量 | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ |
| 资源占用 | 较低 | 较高 |

**推荐:**
- 新手/简单项目: Dokploy
- 复杂项目/多服务: Coolify

---

## Railway 部署

### 一键部署

1. **创建 Railway 账户**
   - 访问 [railway.app](https://railway.app)
   - 使用 GitHub 登录

2. **新建项目**
   - 点击 "New Project"
   - 选择 "Deploy from GitHub repo"
   - 授权并选择 rsxonhub 仓库

3. **添加 PostgreSQL**
   - 在项目中点击 "+ New"
   - 选择 "Database" → "Add PostgreSQL"
   - Railway 会自动生成 `DATABASE_URL`

4. **配置环境变量**
   
   在项目 Settings → Variables 中添加:
   ```
   AUTH_SECRET=<生成的密钥>
   AUTH_USERNAME=admin
   AUTH_PASSWORD=your_password
   RSSHUB_BASE_URL=https://rsshub.app
   ```

5. **部署 Web 服务**
   - Railway 自动检测 `railway.json`
   - 自动构建和部署
   - 分配域名: `your-app.up.railway.app`

6. **部署 Worker 服务**
   - 点击 "+ New" → "Empty Service"
   - 命名为 `worker`
   - 设置 Start Command: `npm run worker`
   - 复制相同的环境变量

7. **初始化数据库**
   ```bash
   # 在 Railway Shell 中执行
   npx drizzle-kit push
   ```

### Railway CLI (可选)

```bash
# 安装 CLI
npm i -g @railway/cli

# 登录
railway login

# 链接项目
railway link

# 部署
railway up

# 查看日志
railway logs
```

---

## Render 部署

### Blueprint 部署

1. **创建 Render 账户**
   - 访问 [render.com](https://render.com)
   - 使用 GitHub 登录

2. **新建 Blueprint**
   - 点击 "New" → "Blueprint"
   - 连接 GitHub 仓库
   - Render 自动读取 `render.yaml`

3. **配置服务**
   
   Render 会创建:
   - **Web Service**: Next.js 应用
   - **Worker Service**: 后台任务
   - **PostgreSQL Database**: 数据库

4. **设置环境变量**
   
   在 Dashboard 中为 Web 和 Worker 服务配置:
   ```
   AUTH_SECRET=<生成的密钥>
   AUTH_USERNAME=admin
   AUTH_PASSWORD=your_password
   RSSHUB_BASE_URL=https://rsshub.app
   ```

5. **部署**
   - 点击 "Apply"
   - 等待所有服务部署完成 (约 5-10 分钟)

6. **初始化数据库**
   ```bash
   # 在 Render Web Shell 中执行
   npx drizzle-kit push
   ```

### 注意事项

- **免费套餐限制**:
  - Web 服务 15 分钟无活动后休眠
  - 建议升级到 Starter Plan ($7/月) 用于生产
  
- **数据库**:
  - 免费 PostgreSQL 有 90 天限制
  - 生产环境建议使用付费计划或外部数据库

---

## 环境变量配置

### 必需变量

| 变量 | 说明 | 生成方式 | 示例 |
|------|------|----------|------|
| `DATABASE_URL` | PostgreSQL 连接字符串 | 由部署平台提供或手动配置 | `postgresql://user:pass@host:5432/db` |
| `AUTH_SECRET` | NextAuth 加密密钥 | `openssl rand -base64 32` | `abc123...` (64字符) |
| `AUTH_USERNAME` | 管理员用户名 | 自定义 | `admin` |
| `AUTH_PASSWORD` | 管理员密码(明文) | 直接设置,启动时自动哈希 | `your_strong_password` |

### 可选变量

| 变量 | 说明 | 默认值 | 推荐值 |
|------|------|--------|--------|
| `RSSHUB_BASE_URL` | RSSHub 实例地址 | `https://rsshub.app` | 自托管实例 URL |
| `RSS_FETCH_PROXY` | RSS 抓取代理 | 空 | `http://proxy:port` |
| `AI_PROXY_URL` | AI 请求代理 | 空 | `http://proxy:port` |
| `AI_REQUEST_TIMEOUT_MS` | AI 请求超时 | `60000` | `60000-120000` |
| `NODE_ENV` | Node 环境 | `production` | `production` |
| `PORT` | 应用端口 | `3000` | `3000` |
| `DIGEST_TIMEZONE` | 摘要时区 | `Asia/Shanghai` | 你的时区 |
| `DIGEST_GENERATE_AT` | 摘要生成时间 | `08:00` | `08:00` |
| `DIGEST_PREPARE_AT` | 摘要准备时间 | `07:30` | `07:30` |

### 安全建议

1. **不要提交 `.env.local` 到 Git**
   - 已添加到 `.gitignore`
   - 使用部署平台的环境变量功能
   - Docker Compose 通过环境变量注入

2. **定期轮换密钥**
   - 每 3-6 个月更新 `AUTH_SECRET`
   - 用户需要重新登录
   - 记录轮换日期

3. **使用强密码**
   - 至少 16 位字符
   - 包含大小写字母、数字、特殊字符
   - 避免常见词汇和个人信息

4. **生产环境最佳实践**
   ```bash
   # 生成安全的 AUTH_SECRET
   openssl rand -base64 48  # 64 字符
   
   # 生成安全的数据库密码
   openssl rand -base64 32 | tr -d '/+' | head -c 32
   
   # 验证密码强度
   echo "your_password" | grep -P '^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&]).{16,}$'
   ```

---

## 数据库管理

### 迁移策略

rsxonhub 使用 Drizzle ORM 进行数据库管理。

**开发环境:**
```bash
# 推送 schema 变更（自动处理）
npm run db:push

# 查看数据库结构
npm run db:studio
```

**生产环境 (Docker):**
```bash
# 容器启动时自动执行迁移
docker-compose up -d

# 手动执行迁移
docker-compose exec app npx drizzle-kit push

# 查看迁移状态
docker-compose exec app npx drizzle-kit studio
```

### 备份与恢复

**自动备份 (推荐):**

```bash
# 每日凌晨 2 点备份 (crontab)
0 2 * * * /path/to/deploy.sh backup >> /var/log/backup.log 2>&1
```

**手动备份:**

```bash
# Docker Compose
./deploy.sh backup
# 或
docker-compose exec db pg_dump -U rsxonhub rsxonhub > backup_$(date +%Y%m%d).sql

# Railway
railway run pg_dump -U postgres $DATABASE_URL > backup.sql

# Render
# 在 Dashboard → Database → Backups 中创建
```

**恢复备份:**

```bash
# Docker Compose
./deploy.sh restore backup_20260606.sql
# 或
cat backup.sql | docker-compose exec -T db psql -U rsxonhub rsxonhub

# ⚠️ 警告: 这会覆盖现有数据！
```

### 性能优化

**创建索引:**

```sql
-- 在 Drizzle Studio 或 psql 中执行
CREATE INDEX IF NOT EXISTS idx_articles_published_at ON articles(published_at DESC);
CREATE INDEX IF NOT EXISTS idx_feeds_category_id ON feeds(category_id);
CREATE INDEX IF NOT EXISTS idx_articles_feed_id ON articles(feed_id);
CREATE INDEX IF NOT EXISTS idx_article_embeddings_vector ON articles USING ivfflat (embedding vector_cosine_ops);
```

**清理旧数据:**

```sql
-- 删除 90 天前的文章（谨慎操作）
DELETE FROM articles WHERE published_at < NOW() - INTERVAL '90 days';

-- 清理未使用的 feed
DELETE FROM feeds WHERE id NOT IN (SELECT DISTINCT feed_id FROM articles);
```

**监控数据库:**

```bash
# 查看数据库大小
docker-compose exec db psql -U rsxonhub -d rsxonhub -c "SELECT pg_size_pretty(pg_database_size('rsxonhub'));"

# 查看表大小
docker-compose exec db psql -U rsxonhub -d rsxonhub -c "SELECT relname, pg_size_pretty(pg_total_relation_size(relid)) FROM pg_catalog.pg_statio_user_tables ORDER BY pg_total_relation_size(relid) DESC;"
```

---

## 监控与运维

### 健康检查

**端点:**
```
GET http://your-domain/api/health
```

**响应:**
```json
{
  "status": "ok",
  "timestamp": "2026-06-06T12:00:00.000Z",
  "service": "rsxonhub"
}
```

**外部监控设置:**

```bash
# UptimeRobot (免费)
# https://uptimerobot.com

# Healthchecks.io
curl -fsS https://hc-ping.com/your-uuid || exit 1

# 简单的 cron 监控
*/5 * * * * curl -f http://localhost:3000/api/health || echo "Service down!" | mail -s "Alert" admin@example.com
```

### 日志管理

**查看日志:**

```bash
# Docker Compose
docker-compose logs -f app      # Web 应用
docker-compose logs -f worker   # Worker 服务
docker-compose logs -f db       # 数据库

# 最近 100 行
docker-compose logs --tail=100 app

# 导出日志
docker-compose logs app > app.log 2>&1
```

**日志轮转:**

```yaml
# docker-compose.yml
services:
  app:
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"
```

### 资源监控

**Docker Stats:**

```bash
# 实时查看资源使用
docker stats

# 一次性快照
docker stats --no-stream

# 特定服务
docker stats rsxonhub-app rsxonhub-worker
```

**系统监控:**

```bash
# CPU 和内存
htop

# 磁盘空间
df -h

# 网络流量
iftop
```

### 自动化运维

**自动更新脚本:**

```bash
#!/bin/bash
# auto-update.sh
set -e

echo "[$(date)] Starting auto-update..."

# 拉取最新代码
git pull

# 重新构建和部署
DB_PASSWORD=$(grep DB_PASSWORD .env.local | cut -d'=' -f2) \
  docker-compose up -d --build

# 等待服务启动
sleep 10

# 健康检查
if curl -f http://localhost:3000/api/health; then
  echo "[$(date)] Update successful"
else
  echo "[$(date)] Update failed, rolling back..."
  git reset --hard HEAD~1
  docker-compose up -d
fi
```

**定时任务:**

```bash
# crontab -e

# 每天凌晨 3 点自动更新
0 3 * * * /path/to/auto-update.sh >> /var/log/auto-update.log 2>&1

# 每小时检查服务状态
0 * * * * curl -f http://localhost:3000/api/health || systemctl restart rsxonhub

# 每周日清理旧日志
0 0 * * 0 find /var/log -name "*.log" -mtime +7 -delete
```

---

## 故障排查

### 常见问题

#### 1. 容器启动失败

**症状:** `docker-compose up` 后服务无法启动

**解决:**
```bash
# 查看详细日志
docker-compose logs app

# 常见原因:
# - 端口被占用: 修改 docker-compose.yml 中的端口映射
#   ports:
#     - "3001:3000"  # 改为 3001
# - 环境变量缺失: 检查 .env.local
#   echo $DB_PASSWORD  # 确认已设置
# - 数据库未就绪: 等待 30 秒后重试
#   sleep 30 && docker-compose restart app
```

#### 2. 数据库连接错误

**症状:** `ECONNREFUSED` 或 `connection refused`

**解决:**
```bash
# 测试数据库连接
docker-compose exec db pg_isready -U rsxonhub

# 检查数据库服务状态
docker-compose ps db

# 重置数据库 (⚠️ 会删除所有数据)
docker-compose down -v
DB_PASSWORD=your_password docker-compose up -d
sleep 10
docker-compose exec app npx drizzle-kit push
```

#### 3. Worker 服务不工作

**症状:** RSS 不更新，AI 任务不执行

**解决:**
```bash
# 检查 Worker 日志
docker-compose logs worker

# 常见错误:
# - DATABASE_URL 配置错误
# - 缺少 AUTH_SECRET
# - 网络连接问题

# 重启 Worker
docker-compose restart worker

# 手动运行一次任务测试
./deploy.sh logs worker
```

#### 4. 健康检查失败

**症状:** Health check returns 503 or timeout

**解决:**
```bash
# 手动测试健康端点
curl -v http://localhost:3000/api/health

# 检查应用是否运行
docker-compose exec app wget -O- http://localhost:3000/api/health

# 查看应用日志找错误
docker-compose logs --tail=50 app | grep -i error

# 增加健康检查超时时间
# docker-compose.yml
healthcheck:
  timeout: 30s  # 从 10s 增加到 30s
  start_period: 60s  # 从 40s 增加到 60s
```

#### 5. 内存不足 (OOM)

**症状:** 容器被 killed，日志显示 `Out of memory`

**解决:**
```bash
# 查看资源使用
docker stats

# 限制容器内存 (编辑 docker-compose.yml)
services:
  app:
    deploy:
      resources:
        limits:
          memory: 2G
          cpus: '1.0'
        reservations:
          memory: 512M
          cpus: '0.25'

# 或者增加系统 swap
sudo fallocate -l 4G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
```

#### 6. SSL 证书问题 (Dokploy/Coolify)

**症状:** HTTPS 无法访问，证书错误

**解决:**
```bash
# 检查 Traefik 日志
docker logs traefik

# 确保域名 DNS 正确解析
dig your-domain.com
nslookup your-domain.com

# 检查防火墙规则
sudo ufw status
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# 强制重新获取证书
docker-compose restart app
# 或
docker exec traefik traefik --certificatesresolvers.myresolver.acme.caserver=https://acme-v02.api.letsencrypt.org/directory
```

#### 7. RSS 抓取失败

**症状:** Feed 不更新，日志显示 fetch error

**解决:**
```bash
# 检查 RSSHub 连接
curl -I https://rsshub.app

# 如果使用自托管 RSSHub
docker-compose logs rsshub

# 配置代理 (如果需要)
# .env.local
RSS_FETCH_PROXY=http://proxy-server:port

# 测试单个 feed
curl "https://rsshub.app/github/repos/user/repo"
```

#### 8. AI 功能不工作

**症状:** Chat 无响应，Digest 生成失败

**解决:**
```bash
# 检查 AI 提供商配置
# .env.local 中确认 API Key 已设置

# 测试 AI 连接
curl -X POST https://api.openai.com/v1/chat/completions \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"model":"gpt-3.5-turbo","messages":[{"role":"user","content":"Hello"}]}'

# 检查超时设置
# .env.local
AI_REQUEST_TIMEOUT_MS=120000  # 增加到 120 秒

# 配置代理 (如果在中国大陆)
AI_PROXY_URL=http://your-proxy:port
```

### 调试技巧

**启用详细日志:**

```bash
# Next.js 详细日志
# .env.local
LOG_LEVEL=debug

# 查看实时日志
docker-compose logs -f --tail=100 app | grep -E "(error|warn|info)"
```

**进入容器调试:**

```bash
# 进入应用容器
docker-compose exec app sh

# 检查环境变量
printenv | grep AUTH

# 测试数据库连接
npx drizzle-kit studio

# 检查文件系统
ls -la .next/
```

**网络诊断:**

```bash
# 测试容器间网络
docker-compose exec app ping db

# 检查端口监听
docker-compose exec app netstat -tlnp

# DNS 解析
docker-compose exec app nslookup rsshub.app
```

---

## 性能优化

### Next.js 优化

已在 `next.config.ts` 中启用：
- ✅ `output: 'standalone'` - 减小镜像体积 (~50%)
- ✅ 静态资源缓存策略
- ✅ 自动代码分割
- ✅ Image Optimization (可选)

**进一步优化:**

```typescript
// next.config.ts
const nextConfig = {
  output: 'standalone',
  experimental: {
    optimizePackageImports: ['lucide-react', 'recharts'],
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
  },
}
```

### 数据库优化

**索引策略:**

```sql
-- 常用查询索引
CREATE INDEX idx_articles_published_at ON articles(published_at DESC);
CREATE INDEX idx_feeds_category_id ON feeds(category_id);
CREATE INDEX idx_articles_feed_id ON articles(feed_id);
CREATE INDEX idx_articles_is_read ON articles(is_read) WHERE is_read = false;

-- 向量搜索索引 (pgvector)
CREATE INDEX idx_article_embeddings_vector 
  ON articles USING ivfflat (embedding vector_cosine_ops) 
  WITH (lists = 100);
```

**连接池:**

```env
# .env.local
# 使用 PgBouncer 或内置连接池
DATABASE_URL=postgresql://user:pass@host:5432/db?pool_timeout=10&connection_limit=20
```

**查询优化:**

```typescript
// 使用分页避免加载大量数据
const articles = await db.query.articles.findMany({
  limit: 50,
  offset: page * 50,
  orderBy: desc(articles.publishedAt),
});

// 只选择需要的字段
const summaries = await db.select({
  id: articles.id,
  title: articles.title,
  publishedAt: articles.publishedAt,
}).from(articles)
.where(eq(articles.feedId, feedId))
.limit(10);
```

### Worker 优化

**并发控制:**

```typescript
// scripts/worker.ts
const CONCURRENCY_LIMIT = 5; // 限制同时处理的 feed 数量

// 使用队列批处理
await boss.work('rss-fetch', { concurrency: CONCURRENCY_LIMIT }, async (jobs) => {
  for (const job of jobs) {
    await processFeed(job.data.feedId);
  }
});
```

**调度优化:**

```env
# .env.local
# 错开任务执行时间，避免峰值
DIGEST_PREPARE_AT=07:30
DIGEST_GENERATE_AT=08:00
DIGEST_SCAN_INTERVAL_MS=300000  # 5 分钟检查一次
```

### 缓存策略

**Redis 缓存 (可选):**

```bash
# docker-compose.yml 添加 Redis
services:
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data

# .env.local
REDIS_URL=redis://redis:6379
```

**Next.js 缓存:**

```typescript
// 使用 revalidate 进行 ISR
export const revalidate = 3600; // 1 小时重新验证

// 或使用 fetch 缓存
const data = await fetch(url, {
  next: { revalidate: 3600 },
});
```

### CDN 配置

**静态资源 CDN:**

```typescript
// next.config.ts
const nextConfig = {
  assetPrefix: process.env.CDN_URL || '',
}
```

**Cloudflare Workers (示例):**

```javascript
// Cloudflare Worker 作为反向代理
addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request))
})

async function handleRequest(request) {
  const url = new URL(request.url)
  url.hostname = 'your-origin.com'
  return fetch(url, request)
}
```

### 监控指标

**关键指标:**

| 指标 | 正常范围 | 告警阈值 |
|------|---------|----------|
| 响应时间 (P95) | < 500ms | > 1000ms |
| 错误率 | < 1% | > 5% |
| CPU 使用率 | < 70% | > 90% |
| 内存使用率 | < 80% | > 95% |
| 数据库连接数 | < 50 | > 100 |
| RSS 抓取成功率 | > 95% | < 80% |

**监控工具推荐:**

- **开源:** Prometheus + Grafana
- **SaaS:** Datadog, New Relic, Sentry
- **简单:** UptimeRobot, Healthchecks.io

---

## 支持

遇到问题？按以下顺序排查：

1. **查看日志**
   ```bash
   ./deploy.sh logs app
   ./deploy.sh logs worker
   ```

2. **检查文档**
   - [README.md](./README.md) - 快速开始
   - [Product Design](./docs/product-design.md) - 功能说明
   - [Database Migration](./docs/database-migration.md) - 数据库变更

3. **常见问题**
   - 查看上方 [故障排查](#故障排查) 章节
   - 搜索 GitHub Issues

4. **社区支持**
   - GitHub Issues: 报告 bug 或请求功能
   - Discussions: 提问和讨论
   - Discord/Telegram: 实时聊天（如有）

5. **联系维护者**
   - Email: your-email@example.com
   - Twitter: @yourhandle

---

## 版本历史

| 版本 | 日期 | 说明 |
|------|------|------|
| 1.0.0 | 2026-06-06 | 初始部署文档 |

---

**最后更新**: 2026-06-06
