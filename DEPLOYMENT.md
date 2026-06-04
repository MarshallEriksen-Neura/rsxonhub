# 部署指南

本文档提供 rsxonhub 项目的完整部署说明。

## 📋 目录

- [快速开始](#快速开始)
- [Docker Compose 部署](#docker-compose-部署)
- [Dokploy/Coolify 部署](#dokploycoolify-部署)
- [Railway 部署](#railway-部署)
- [Render 部署](#render-部署)
- [环境变量配置](#环境变量配置)
- [故障排查](#故障排查)

---

## 快速开始

### 前置要求

- **Node.js**: 20.x 或更高版本
- **Docker & Docker Compose**: 用于容器化部署
- **PostgreSQL**: 16.x (可本地安装或使用 Docker)
- **内存**: 至少 2GB RAM

### 5 分钟快速部署 (Docker)

```bash
# 1. 克隆仓库
git clone <your-repo-url>
cd rsxonhub

# 2. 配置环境变量
cp .env.example .env.local
# 编辑 .env.local,填入必要值

# 3. 一键启动
DB_PASSWORD=your_secure_password ./deploy.sh start

# Windows PowerShell:
# $env:DB_PASSWORD='your_secure_password'; .\deploy.ps1 start

# 4. 访问应用
# http://localhost:3000
```

---

## Docker Compose 部署

### 架构说明

```
┌─────────────┐     ┌──────────┐     ┌─────────┐
│  Next.js    │────▶│PostgreSQL│     │         │
│  App :3000  │     │   :5432  │     │         │
└─────────────┘     └──────────┘     │         │
                                     │ Redis   │
┌─────────────┐     ┌──────────┐     │  :6379  │
│  Worker     │────▶│PostgreSQL│     │         │
│  (Background)│    │   :5432  │     └─────────┘
└─────────────┘     └──────────┘
```

### 详细步骤

#### 1. 准备环境文件

```bash
cp .env.example .env.local
```

编辑 `.env.local`:

```env
# 数据库 (Docker 会自动配置,无需修改)
DATABASE_URL=postgresql://rsxonhub:${DB_PASSWORD}@db:5432/rsxonhub

# RSSHub (可选,默认使用公共实例)
RSSHUB_BASE_URL=https://rsshub.app

# 认证 (必须配置)
AUTH_SECRET=<运行: openssl rand -base64 32>
AUTH_USERNAME=admin
AUTH_PASSWORD=your_password
```

#### 2. 生成密钥

```bash
# 生成 AUTH_SECRET
openssl rand -base64 32
```

#### 3. 启动服务

```bash
# Linux/Mac
DB_PASSWORD=your_secure_password docker-compose up -d

# Windows PowerShell
$env:DB_PASSWORD='your_secure_password'
docker-compose up -d
```

#### 4. 初始化数据库

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

## Dokploy/Coolify 部署

### Dokploy 安装

```bash
# 在 VPS 上执行
curl -sSL https://get.dokploy.com | sh

# 访问控制面板
# http://your-server-ip:3000
```

### 部署步骤

1. **连接 Git 仓库**
   - 在 Dokploy Dashboard 点击 "New Application"
   - 选择 "Git Repository"
   - 授权并选择你的 rsxonhub 仓库

2. **配置 Docker Compose**
   - Compose File Path: `docker-compose.dokploy.yml`
   - Build Context: `.`

3. **设置环境变量**

   | 变量 | 说明 | 示例 |
   |------|------|------|
   | `DOMAIN` | 你的域名 | `rss.yourdomain.com` |
   | `DATABASE_URL` | 数据库连接 | `postgresql://rsxonhub:pass@db:5432/rsxonhub` |
   | `DB_PASSWORD` | 数据库密码 | `strong_password_123` |
   | `AUTH_SECRET` | NextAuth 密钥 | `<生成的随机字符串>` |
   | `AUTH_USERNAME` | 管理员用户名 | `admin` |
   | `AUTH_PASSWORD` | 管理员密码 | `your_password` |
   | `RSSHUB_BASE_URL` | RSSHub 地址 | `https://rsshub.app` |

4. **部署**
   - 点击 "Deploy"
   - Traefik 会自动配置 SSL 证书
   - 等待构建完成 (约 2-5 分钟)

5. **初始化数据库**
   ```bash
   # 在 Dokploy Terminal 中执行
   npx drizzle-kit push
   ```

### Coolify 部署

Coolify 配置与 Dokploy 类似:

```bash
# 安装 Coolify
curl -fsSL https://cdn.coollabs.io/coolify/install.sh | bash

# 访问
# http://your-server-ip:8000
```

后续步骤同 Dokploy。

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

| 变量 | 说明 | 生成方式 |
|------|------|----------|
| `DATABASE_URL` | PostgreSQL 连接字符串 | 由部署平台提供或手动配置 |
| `AUTH_SECRET` | NextAuth 加密密钥 | `openssl rand -base64 32` |
| `AUTH_USERNAME` | 管理员用户名 | 自定义,如 `admin` |
| `AUTH_PASSWORD` | 管理员密码(明文) | 直接设置,启动时自动哈希 | |

### 可选变量

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `RSSHUB_BASE_URL` | RSSHub 实例地址 | `https://rsshub.app` |
| `NODE_ENV` | Node 环境 | `production` |
| `PORT` | 应用端口 | `3000` |

### 安全建议

1. **不要提交 `.env.local` 到 Git**
   - 已添加到 `.gitignore`
   - 使用部署平台的环境变量功能

2. **定期轮换密钥**
   - 每 3-6 个月更新 `AUTH_SECRET`
   - 用户需要重新登录

3. **使用强密码**
   - 至少 12 位字符
   - 包含大小写字母、数字、特殊字符

---

## 故障排查

### 常见问题

#### 1. 容器启动失败

```bash
# 查看详细日志
docker-compose logs app

# 常见原因:
# - 端口被占用: 修改 docker-compose.yml 中的端口映射
# - 环境变量缺失: 检查 .env.local
# - 数据库未就绪: 等待 30 秒后重试
```

#### 2. 数据库连接错误

```bash
# 测试数据库连接
docker-compose exec db pg_isready -U rsxonhub

# 重置数据库 (⚠️ 会删除所有数据)
docker-compose down -v
DB_PASSWORD=your_password docker-compose up -d
docker-compose exec app npx drizzle-kit push
```

#### 3. Worker 服务不工作

```bash
# 检查 Worker 日志
docker-compose logs worker

# 重启 Worker
docker-compose restart worker

# 验证队列系统
docker-compose exec redis redis-cli ping
```

#### 4. 健康检查失败

```bash
# 手动测试健康端点
curl http://localhost:3000/api/health

# 检查应用是否运行
docker-compose exec app wget -O- http://localhost:3000/api/health
```

#### 5. 内存不足

```bash
# 查看资源使用
docker stats

# 限制容器内存 (编辑 docker-compose.yml)
deploy:
  resources:
    limits:
      memory: 1G
      cpus: '0.5'
```

#### 6. SSL 证书问题 (Dokploy)

```bash
# 检查 Traefik 日志
docker logs traefik

# 确保域名 DNS 正确解析
dig your-domain.com

# 强制重新获取证书
docker-compose restart app
```

### 性能优化

#### 数据库优化

```sql
-- 创建索引 (在 Drizzle Studio 中执行)
CREATE INDEX IF NOT EXISTS idx_articles_published_at ON articles(published_at DESC);
CREATE INDEX IF NOT EXISTS idx_feeds_category_id ON feeds(category_id);
```

#### Next.js 优化

已在 `next.config.ts` 中启用:
- `output: 'standalone'` - 减小镜像体积
- 静态资源缓存
- 自动代码分割

#### Redis 优化

```bash
# 调整 Redis 配置 (docker-compose.yml)
command: redis-server --appendonly yes --maxmemory 256mb --maxmemory-policy allkeys-lru
```

### 监控建议

1. **日志聚合**
   ```bash
   # 使用 Loki + Grafana (可选)
   docker-compose -f docker-compose.monitoring.yml up -d
   ```

2. **健康检查**
   ```bash
   # 设置外部监控
   curl -f http://your-domain/api/health || echo "Service down!"
   ```

3. **备份策略**
   ```bash
   # 每日备份 (crontab)
   0 2 * * * /path/to/deploy.sh backup
   ```

---

## 支持

遇到问题?

1. 查看日志: `./deploy.sh logs`
2. 检查文档: [README.md](../README.md)
3. 提交 Issue: GitHub Issues
4. 社区讨论: Discord / Telegram

---

**最后更新**: 2026-06-04
