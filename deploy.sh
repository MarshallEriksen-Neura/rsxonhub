#!/bin/bash
# rsxonhub 快速部署脚本
# 用法: ./deploy.sh [start|stop|restart|logs|update]

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 检查 Docker 是否安装
if ! command -v docker &> /dev/null; then
    echo -e "${RED}错误: Docker 未安装${NC}"
    exit 1
fi

if ! command -v docker-compose &> /dev/null; then
    echo -e "${RED}错误: Docker Compose 未安装${NC}"
    exit 1
fi

# 检查 .env.local 是否存在
if [ ! -f .env.local ]; then
    echo -e "${YELLOW}警告: .env.local 不存在,从 .env.example 复制...${NC}"
    cp .env.example .env.local
    echo -e "${YELLOW}请编辑 .env.local 并填入正确的值${NC}"
    exit 1
fi

# 函数定义
start() {
    echo -e "${GREEN}启动所有服务...${NC}"
    
    if [ -z "$DB_PASSWORD" ]; then
        echo -e "${RED}错误: 请设置 DB_PASSWORD 环境变量${NC}"
        echo "用法: DB_PASSWORD=your_password ./deploy.sh start"
        exit 1
    fi
    
    export DB_PASSWORD
    docker-compose up -d
    
    echo -e "${GREEN}等待数据库启动...${NC}"
    sleep 10
    
    echo -e "${GREEN}初始化数据库...${NC}"
    docker-compose exec app npx drizzle-kit push || echo -e "${YELLOW}数据库可能已初始化${NC}"
    
    echo -e "${GREEN}✅ 部署完成!${NC}"
    echo -e "访问: http://localhost:3000"
    echo -e "查看日志: docker-compose logs -f"
}

stop() {
    echo -e "${YELLOW}停止所有服务...${NC}"
    docker-compose down
    echo -e "${GREEN}✅ 服务已停止${NC}"
}

restart() {
    echo -e "${YELLOW}重启所有服务...${NC}"
    stop
    start
}

logs() {
    SERVICE=${1:-app}
    echo -e "${GREEN}查看 $SERVICE 日志 (Ctrl+C 退出)...${NC}"
    docker-compose logs -f $SERVICE
}

update() {
    echo -e "${GREEN}更新并重新部署...${NC}"
    git pull
    DB_PASSWORD=${DB_PASSWORD:-$(grep DB_PASSWORD .env.local | cut -d'=' -f2)} \
    docker-compose up -d --build
    echo -e "${GREEN}✅ 更新完成!${NC}"
}

status() {
    echo -e "${GREEN}服务状态:${NC}"
    docker-compose ps
    echo ""
    echo -e "${GREEN}资源使用:${NC}"
    docker stats --no-stream
}

backup() {
    echo -e "${GREEN}备份数据库...${NC}"
    TIMESTAMP=$(date +%Y%m%d_%H%M%S)
    BACKUP_FILE="backup_${TIMESTAMP}.sql"
    docker-compose exec -T db pg_dump -U rsxonhub rsxonhub > $BACKUP_FILE
    echo -e "${GREEN}✅ 备份完成: $BACKUP_FILE${NC}"
}

restore() {
    if [ -z "$1" ]; then
        echo -e "${RED}用法: ./deploy.sh restore <backup_file>${NC}"
        exit 1
    fi
    
    echo -e "${YELLOW}恢复数据库从 $1...${NC}"
    cat $1 | docker-compose exec -T db psql -U rsxonhub rsxonhub
    echo -e "${GREEN}✅ 恢复完成${NC}"
}

# 主命令
case "${1:-help}" in
    start)
        start
        ;;
    stop)
        stop
        ;;
    restart)
        restart
        ;;
    logs)
        logs $2
        ;;
    update)
        update
        ;;
    status)
        status
        ;;
    backup)
        backup
        ;;
    restore)
        restore $2
        ;;
    help|*)
        echo -e "${GREEN}rsxonhub 部署管理工具${NC}"
        echo ""
        echo "用法: ./deploy.sh <command>"
        echo ""
        echo "命令:"
        echo "  start       启动所有服务"
        echo "  stop        停止所有服务"
        echo "  restart     重启所有服务"
        echo "  logs [svc]  查看日志 (默认: app)"
        echo "  update      拉取代码并重新部署"
        echo "  status      查看服务状态和资源使用"
        echo "  backup      备份数据库"
        echo "  restore     恢复数据库"
        echo "  help        显示此帮助信息"
        echo ""
        echo "示例:"
        echo "  DB_PASSWORD=mypassword ./deploy.sh start"
        echo "  ./deploy.sh logs worker"
        echo "  ./deploy.sh backup"
        ;;
esac
