# 部署检查清单

在部署 rsxonhub 之前,请确保完成以下检查项。

## 📋 部署前检查

### 环境准备

- [ ] Docker 已安装 (`docker --version`)
- [ ] Docker Compose 已安装 (`docker-compose --version`)
- [ ] Node.js 20+ 已安装 (本地开发用)
- [ ] 至少 2GB 可用内存
- [ ] 至少 5GB 可用磁盘空间

### 配置文件

- [ ] `.env.local` 已从 `.env.example` 复制
- [ ] `DATABASE_URL` 已配置
- [ ] `AUTH_SECRET` 已生成并配置
- [ ] `AUTH_USERNAME` 已设置
- [ ] `AUTH_PASSWORD` 已设置
- [ ] `RSSHUB_BASE_URL` 已配置(可选)

### 密钥生成

```bash
# 生成 AUTH_SECRET
openssl rand -base64 32
```

---

## 🚀 Docker Compose 部署检查

### 启动前

- [ ] 已设置 `DB_PASSWORD` 环境变量
- [ ] 已确认端口 3000、5432、6379 未被占用
- [ ] 已阅读 `docker-compose.yml` 了解服务架构

### 启动命令

```bash
# Linux/Mac
DB_PASSWORD=your_password docker-compose up -d

# Windows PowerShell
$env:DB_PASSWORD='your_password'; docker-compose up -d
```

### 启动后验证

- [ ] 所有容器正在运行 (`docker-compose ps`)
- [ ] 数据库健康检查通过
- [ ] 应用可访问 (`curl http://localhost:3000/api/health`)
- [ ] Worker 服务正常启动
- [ ] 数据库 schema 已初始化 (`docker-compose exec app npx drizzle-kit push`)

### 日志检查

```bash
# 检查应用日志
docker-compose logs app

# 检查 Worker 日志
docker-compose logs worker

# 检查数据库日志
docker-compose logs db
```

**期望看到:**
- [ ] App: "Ready in Xms" 或类似就绪消息
- [ ] Worker: 无错误启动
- [ ] DB: "database system is ready to accept connections"

---

## 🌐 Dokploy/Coolify 部署检查

### 前置条件

- [ ] VPS 已准备(推荐 2GB+ RAM, Ubuntu 22.04+)
- [ ] 域名已配置并指向服务器 IP
- [ ] 防火墙开放端口 80、443、3000

### Dokploy 安装

- [ ] 执行安装脚本: `curl -sSL https://get.dokploy.com | sh`
- [ ] 可访问 Dashboard: `http://your-server-ip:3000`
- [ ] 已完成初始设置

### 应用配置

- [ ] Git 仓库已连接
- [ ] Compose 文件选择: `docker-compose.dokploy.yml`
- [ ] 所有环境变量已配置:
  - [ ] `DOMAIN`
  - [ ] `DATABASE_URL`
  - [ ] `DB_PASSWORD`
  - [ ] `AUTH_SECRET`
  - [ ] `AUTH_USERNAME`
  - [ ] `AUTH_PASSWORD`
  - [ ] `RSSHUB_BASE_URL`

### 部署验证

- [ ] 构建成功完成
- [ ] 所有服务状态为 "Running"
- [ ] Traefik 自动配置 SSL 证书
- [ ] 可通过域名访问应用
- [ ] 健康检查端点返回 200

---

## 🚂 Railway 部署检查

### 账户准备

- [ ] Railway 账户已创建
- [ ] GitHub 账户已授权 Railway

### 项目配置

- [ ] 已从 GitHub 导入仓库
- [ ] PostgreSQL 数据库已添加
- [ ] `DATABASE_URL` 自动配置

### 环境变量

- [ ] Web 服务环境变量已配置:
  - [ ] `AUTH_SECRET`
  - [ ] `AUTH_USERNAME`
  - [ ] `AUTH_PASSWORD`
  - [ ] `RSSHUB_BASE_URL`
  
- [ ] Worker 服务环境变量已配置:
  - [ ] `AUTH_SECRET`
  - [ ] `DATABASE_URL` (从 Database 服务继承)

### 部署验证

- [ ] Web 服务部署成功
- [ ] Worker 服务部署成功
- [ ] 数据库连接正常
- [ ] 分配的域名可访问
- [ ] 日志无错误

---

## 🎨 Render 部署检查

### Blueprint 配置

- [ ] Render 账户已创建
- [ ] 已通过 Blueprint 导入 `render.yaml`
- [ ] 审查服务配置:
  - [ ] Web Service: rsxonhub-web
  - [ ] Worker Service: rsxonhub-worker
  - [ ] Database: rsxonhub-db

### 环境变量

- [ ] Web 服务敏感变量已手动配置:
  - [ ] `AUTH_SECRET`
  - [ ] `AUTH_USERNAME`
  - [ ] `AUTH_PASSWORD`
  
- [ ] Worker 服务敏感变量已手动配置:
  - [ ] `AUTH_SECRET`

### 部署验证

- [ ] 所有服务部署成功
- [ ] 数据库连接字符串自动注入
- [ ] Web 服务可访问
- [ ] Worker 服务运行中
- [ ] 健康检查通过

**注意**: Render 免费套餐有休眠限制,生产环境建议升级。

---

## 🔍 通用验证步骤

### 功能测试

访问应用后,测试以下功能:

- [ ] 首页加载正常
- [ ] 登录页面可访问
- [ ] 使用配置的账号密码可登录
- [ ] Feed 列表页面正常显示
- [ ] 可以添加新的 RSS Feed
- [ ] 文章列表正常加载
- [ ] 设置页面可访问
- [ ] AI 配置页面可访问

### API 测试

```bash
# 健康检查
curl http://your-domain/api/health

# 期望响应:
# {"status":"ok","timestamp":"...","service":"rsxonhub"}
```

### 后台任务验证

- [ ] Worker 服务日志无错误
- [ ] Redis 连接正常 (`docker-compose exec redis redis-cli ping`)
- [ ] RSS 抓取任务可以执行
- [ ] AI 处理任务可以执行

### 数据库验证

```bash
# 连接数据库
docker-compose exec db psql -U rsxonhub -d rsxonhub

# 检查表是否存在
\dt

# 期望看到:
# - users
# - feeds
# - articles
# - categories
# - ai_configs
# - 等其他表
```

---

## 🛡️ 安全检查

### 网络安全

- [ ] 仅暴露必要端口
- [ ] 使用 HTTPS (Dokploy/Traefik 自动配置)
- [ ] 数据库不直接暴露到公网
- [ ] 使用强密码和密钥

### 数据安全

- [ ] `.env.local` 未提交到 Git
- [ ] 定期备份数据库
- [ ] 启用自动备份(如果平台支持)

### 访问控制

- [ ] 管理员密码足够强壮
- [ ] `AUTH_SECRET` 是随机生成的
- [ ] 不在日志中打印敏感信息

---

## 📊 性能检查

### 资源使用

```bash
# 查看容器资源使用
docker stats

# 期望:
# - CPU 使用率 < 50% (空闲时)
# - 内存使用 < 1.5GB
```

### 响应时间

```bash
# 测试首页加载时间
curl -w "@curl-format.txt" -o /dev/null -s http://your-domain/

# 期望: < 2s (首次), < 500ms (缓存后)
```

### 数据库性能

```sql
-- 检查慢查询
SELECT query, calls, total_time, mean_time
FROM pg_stat_statements
ORDER BY mean_time DESC
LIMIT 10;
```

---

## 🔄 更新维护

### 常规更新流程

- [ ] 拉取最新代码: `git pull`
- [ ] 重新构建: `docker-compose up -d --build`
- [ ] 检查迁移: `docker-compose exec app npx drizzle-kit push`
- [ ] 验证功能正常
- [ ] 备份数据库(更新前)

### 备份策略

```bash
# 手动备份
./deploy.sh backup

# 自动备份 (crontab)
0 2 * * * /path/to/deploy.sh backup
```

### 监控设置

- [ ] 配置日志聚合(可选)
- [ ] 设置健康检查监控
- [ ] 配置告警通知(可选)

---

## ❌ 故障恢复

### 常见问题快速修复

**问题**: 容器无法启动
```bash
# 解决: 查看详细日志
docker-compose logs <service-name>
```

**问题**: 数据库连接失败
```bash
# 解决: 重启数据库
docker-compose restart db
# 等待 10 秒后重试
```

**问题**: 内存不足
```bash
# 解决: 限制容器资源
# 编辑 docker-compose.yml,添加资源限制
```

**问题**: 数据丢失
```bash
# 解决: 从备份恢复
./deploy.sh restore backup_YYYYMMDD_HHMMSS.sql
```

---

## ✅ 部署完成确认

部署成功后,你应该能够:

- [ ] 通过浏览器访问应用
- [ ] 成功登录系统
- [ ] 添加和管理 RSS Feeds
- [ ] 查看文章列表
- [ ] 配置 AI 模型
- [ ] Worker 后台任务正常运行
- [ ] 数据库持久化正常
- [ ] 健康检查端点返回正常

**恭喜!部署完成! 🎉**

---

## 📞 获取帮助

如果遇到问题:

1. **查看日志**: `./deploy.sh logs`
2. **查阅文档**: [DEPLOYMENT.md](DEPLOYMENT.md)
3. **检查 Issues**: GitHub Issues
4. **社区支持**: Discord / Telegram

---

**检查清单版本**: 1.0  
**最后更新**: 2026-06-04
