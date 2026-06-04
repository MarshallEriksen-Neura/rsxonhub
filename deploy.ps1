# rsxonhub Windows 快速部署脚本 (PowerShell)
# 用法: .\deploy.ps1 [start|stop|restart|logs|update]

param(
    [Parameter(Position=0)]
    [string]$Command = "help",
    
    [Parameter(Position=1)]
    [string]$Service = "app"
)

# 颜色函数
function Write-Success { param($msg) Write-Host $msg -ForegroundColor Green }
function Write-Warning { param($msg) Write-Host $msg -ForegroundColor Yellow }
function Write-Error { param($msg) Write-Host $msg -ForegroundColor Red }

# 检查 Docker
if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    Write-Error "错误: Docker 未安装"
    exit 1
}

if (-not (Get-Command docker-compose -ErrorAction SilentlyContinue)) {
    Write-Error "错误: Docker Compose 未安装"
    exit 1
}

# 检查 .env.local
if (-not (Test-Path ".env.local")) {
    Write-Warning "警告: .env.local 不存在,从 .env.example 复制..."
    Copy-Item ".env.example" ".env.local"
    Write-Warning "请编辑 .env.local 并填入正确的值"
    exit 1
}

# 函数定义
function Start-Services {
    Write-Success "启动所有服务..."
    
    $dbPassword = $env:DB_PASSWORD
    if (-not $dbPassword) {
        # 尝试从 .env.local 读取
        $envContent = Get-Content ".env.local" -Raw
        if ($envContent -match "DB_PASSWORD=(.+)") {
            $dbPassword = $matches[1]
        } else {
            Write-Error "错误: 请设置 DB_PASSWORD 环境变量"
            Write-Host "用法: `$env:DB_PASSWORD='your_password'; .\deploy.ps1 start"
            exit 1
        }
    }
    
    $env:DB_PASSWORD = $dbPassword
    docker-compose up -d
    
    Write-Success "等待数据库启动..."
    Start-Sleep -Seconds 10
    
    Write-Success "初始化数据库..."
    try {
        docker-compose exec app npx drizzle-kit push
    } catch {
        Write-Warning "数据库可能已初始化"
    }
    
    Write-Success "✅ 部署完成!"
    Write-Success "访问: http://localhost:3000"
    Write-Success "查看日志: docker-compose logs -f"
}

function Stop-Services {
    Write-Warning "停止所有服务..."
    docker-compose down
    Write-Success "✅ 服务已停止"
}

function Restart-Services {
    Write-Warning "重启所有服务..."
    Stop-Services
    Start-Services
}

function Show-Logs {
    Write-Success "查看 $Service 日志 (Ctrl+C 退出)..."
    docker-compose logs -f $Service
}

function Update-Services {
    Write-Success "更新并重新部署..."
    git pull
    
    $dbPassword = $env:DB_PASSWORD
    if (-not $dbPassword) {
        $envContent = Get-Content ".env.local" -Raw
        if ($envContent -match "DB_PASSWORD=(.+)") {
            $dbPassword = $matches[1]
        }
    }
    
    $env:DB_PASSWORD = $dbPassword
    docker-compose up -d --build
    Write-Success "✅ 更新完成!"
}

function Show-Status {
    Write-Success "服务状态:"
    docker-compose ps
    Write-Host ""
    Write-Success "资源使用:"
    docker stats --no-stream
}

function Backup-Database {
    Write-Success "备份数据库..."
    $timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
    $backupFile = "backup_${timestamp}.sql"
    
    docker-compose exec -T db pg_dump -U rsxonhub rsxonhub > $backupFile
    Write-Success "✅ 备份完成: $backupFile"
}

function Restore-Database {
    param([string]$BackupFile)
    
    if (-not $BackupFile) {
        Write-Error "用法: .\deploy.ps1 restore <backup_file>"
        exit 1
    }
    
    Write-Warning "恢复数据库从 $BackupFile..."
    Get-Content $BackupFile | docker-compose exec -T db psql -U rsxonhub rsxonhub
    Write-Success "✅ 恢复完成"
}

function Show-Help {
    Write-Success "rsxonhub 部署管理工具 (Windows)"
    Write-Host ""
    Write-Host "用法: .\deploy.ps1 <command>"
    Write-Host ""
    Write-Host "命令:"
    Write-Host "  start       启动所有服务"
    Write-Host "  stop        停止所有服务"
    Write-Host "  restart     重启所有服务"
    Write-Host "  logs [svc]  查看日志 (默认: app)"
    Write-Host "  update      拉取代码并重新部署"
    Write-Host "  status      查看服务状态和资源使用"
    Write-Host "  backup      备份数据库"
    Write-Host "  restore     恢复数据库"
    Write-Host "  help        显示此帮助信息"
    Write-Host ""
    Write-Host "示例:"
    Write-Host "  `$env:DB_PASSWORD='mypassword'; .\deploy.ps1 start"
    Write-Host "  .\deploy.ps1 logs worker"
    Write-Host "  .\deploy.ps1 backup"
}

# 主命令
switch ($Command.ToLower()) {
    "start" { Start-Services }
    "stop" { Stop-Services }
    "restart" { Restart-Services }
    "logs" { Show-Logs }
    "update" { Update-Services }
    "status" { Show-Status }
    "backup" { Backup-Database }
    "restore" { Restore-Database $Service }
    default { Show-Help }
}
