# 🚀 快速部署参考卡

## 一键部署命令

### Docker Compose (推荐)

```bash
# Linux/macOS
cp .env.example .env.local
# 编辑 .env.local
DB_PASSWORD=your_secure_password ./deploy.sh start

# Windows PowerShell
Copy-Item .env.example .env.local
# 编辑 .env.local
$env:DB_PASSWORD='your_secure_password'; .\deploy.ps1 start
```

### 验证部署

```bash
# 检查服务状态
docker-compose ps

# 健康检查
curl http://localhost:3000/api/health

# 查看日志
docker-compose logs -f app
```

---

## 常用管理命令

### 部署脚本

```bash
# Linux/macOS
./deploy.sh start      # 启动
./deploy.sh stop       # 停止
./deploy.sh restart    # 重启
./deploy.sh status     # 状态
./deploy.sh logs app   # 查看日志
./deploy.sh backup     # 备份
./deploy.sh update     # 更新
./deploy.sh help       # 帮助

# Windows PowerShell
.\deploy.ps1 start
.\deploy.ps1 stop
.\deploy.ps1 restart
.\deploy.ps1 status
.\deploy.ps1 logs app
.\deploy.ps1 backup
.\deploy.ps1 update
.\deploy.ps1 help
```

### Docker Compose

```bash
# 基本操作
docker-compose up -d           # 启动
docker-compose down            # 停止
docker-compose restart         # 重启
docker-compose ps              # 状态
docker-compose logs -f         # 日志

# 特定服务
docker-compose up -d app       # 只启动 app
docker-compose restart worker  # 重启 worker
docker-compose logs -f db      # 数据库日志

# 资源管理
docker stats                   # 资源使用
docker system prune            # 清理
```

---

## 环境变量速查

### 必需变量

```bash
# 生成 AUTH_SECRET
openssl rand -base64 32

# .env.local
AUTH_SECRET=<生成的密钥>
AUTH_USERNAME=admin
AUTH_PASSWORD=your_strong_password
DATABASE_URL=postgresql://user:pass@host:5432/db
```

### 可选变量

```bash
RSSHUB_BASE_URL=https://rsshub.app
RSS_FETCH_PROXY=http://proxy:port
AI_PROXY_URL=http://proxy:port
AI_REQUEST_TIMEOUT_MS=60000
DIGEST_TIMEZONE=Asia/Shanghai
```

---

## 数据库管理

### 迁移

```bash
# 开发环境
npm run db:push
npm run db:studio

# 生产环境 (Docker)
docker-compose exec app npx drizzle-kit push
```

### 备份与恢复

```bash
# 备份
./deploy.sh backup
# 或
docker-compose exec db pg_dump -U rsxonhub rsxonhub > backup.sql

# 恢复
./deploy.sh restore backup.sql
# 或
cat backup.sql | docker-compose exec -T db psql -U rsxonhub rsxonhub
```

### 监控

```bash
# 数据库大小
docker-compose exec db psql -U rsxonhub -d rsxonhub \
  -c "SELECT pg_size_pretty(pg_database_size('rsxonhub'));"

# 表大小
docker-compose exec db psql -U rsxonhub -d rsxonhub \
  -c "SELECT relname, pg_size_pretty(pg_total_relation_size(relid)) 
      FROM pg_catalog.pg_statio_user_tables 
      ORDER BY pg_total_relation_size(relid) DESC;"
```

---

## 故障排查

### 常见问题

```bash
# 容器启动失败
docker-compose logs app

# 数据库连接错误
docker-compose exec db pg_isready -U rsxonhub

# Worker 不工作
docker-compose logs worker
docker-compose restart worker

# 内存不足
docker stats
# 编辑 docker-compose.yml 增加限制

# 重置数据库 (⚠️ 删除所有数据)
docker-compose down -v
DB_PASSWORD=xxx docker-compose up -d
docker-compose exec app npx drizzle-kit push
```

### 调试技巧

```bash
# 进入容器
docker-compose exec app sh

# 检查环境变量
printenv | grep AUTH

# 测试数据库连接
npx drizzle-kit studio

# 网络诊断
docker-compose exec app ping db
```

---

## 性能优化

### 索引

```sql
CREATE INDEX idx_articles_published_at ON articles(published_at DESC);
CREATE INDEX idx_feeds_category_id ON feeds(category_id);
CREATE INDEX idx_articles_feed_id ON articles(feed_id);
```

### 资源限制

```yaml
# docker-compose.yml
services:
  app:
    deploy:
      resources:
        limits:
          memory: 2G
          cpus: '1.0'
```

### 缓存

```typescript
// Next.js ISR
export const revalidate = 3600;

// Fetch 缓存
const data = await fetch(url, {
  next: { revalidate: 3600 },
});
```

---

## 监控检查

### 健康检查

```bash
# 端点
curl http://localhost:3000/api/health

# 预期响应
{"status":"ok","timestamp":"...","service":"rsxonhub"}
```

### 关键指标

| 指标 | 正常范围 | 告警阈值 |
|------|---------|----------|
| 响应时间 (P95) | < 500ms | > 1000ms |
| 错误率 | < 1% | > 5% |
| CPU 使用率 | < 70% | > 90% |
| 内存使用率 | < 80% | > 95% |

### 外部监控

- **UptimeRobot**: https://uptimerobot.com (免费)
- **Healthchecks.io**: 简单的 cron 监控
- **Prometheus + Grafana**: 完整监控方案

---

## 安全清单

- [ ] HTTPS 已启用
- [ ] AUTH_SECRET 足够随机（64+ 字符）
- [ ] 强密码策略（16+ 字符）
- [ ] 防火墙规则已配置
- [ ] .env.local 未提交到 Git
- [ ] 定期轮换密钥计划
- [ ] 数据库备份已测试

---

## 云平台快速部署

### Railway

```bash
# 安装 CLI
npm i -g @railway/cli

# 登录并部署
railway login
railway link
railway up

# 添加 PostgreSQL
# 在 Railway Dashboard 中点击 "+ New" → "Database" → "PostgreSQL"

# 设置环境变量
# Settings → Variables → 添加 AUTH_SECRET, AUTH_USERNAME, AUTH_PASSWORD

# 初始化数据库
railway shell
npx drizzle-kit push
```

### Render

```bash
# 1. 在 Dashboard 创建 Blueprint
# 2. 连接 GitHub 仓库
# 3. Render 自动读取 render.yaml
# 4. 配置环境变量
# 5. 部署

# 初始化数据库
# Web Shell → npx drizzle-kit push
```

### Dokploy

```bash
# 安装
curl -sSL https://get.dokploy.com | sh

# 访问 http://your-server-ip:3000
# 1. 连接 Git 仓库
# 2. 选择 docker-compose.dokploy.yml
# 3. 配置环境变量
# 4. 部署
# 5. Terminal → npx drizzle-kit push
```

---

## 维护计划

### 日常
- [ ] 检查服务状态
- [ ] 查看错误日志
- [ ] 监控资源使用

### 每周
- [ ] 审查安全日志
- [ ] 清理旧日志
- [ ] 检查磁盘空间

### 每月
- [ ] 完整备份
- [ ] 恢复测试
- [ ] 性能测试
- [ ] 更新依赖

### 每季度
- [ ] 轮换 AUTH_SECRET
- [ ] 安全审计
- [ ] 灾难恢复演练

---

## 有用链接

- **完整部署文档**: [DEPLOYMENT.md](../DEPLOYMENT.md)
- **部署检查清单**: [deployment-checklist.md](deployment-checklist.md)
- **产品文档**: [product-design.md](product-design.md)
- **GitHub Issues**: 报告问题
- **Discussions**: 提问讨论

---

**提示**: 打印此页或保存为书签，方便快速查阅！
