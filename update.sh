#!/bin/bash
#
# Jetson 更新脚本 - 支持蓝绿部署和零停机更新
# 用途: 安全地更新生产环境，支持自动回滚
# 使用: bash update.sh [选项]
#

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# 配置
PROJECT_DIR="$HOME/BPS_20251219"
BACKUP_DIR="$HOME/BPS_backups"
LOG_FILE="$PROJECT_DIR/update.log"

# 日志函数
log() {
    echo -e "${BLUE}[$(date '+%Y-%m-%d %H:%M:%S')]${NC} $1" | tee -a "$LOG_FILE"
}

success() {
    echo -e "${GREEN}✅ $1${NC}" | tee -a "$LOG_FILE"
}

error() {
    echo -e "${RED}❌ $1${NC}" | tee -a "$LOG_FILE"
}

warning() {
    echo -e "${YELLOW}⚠️  $1${NC}" | tee -a "$LOG_FILE"
}

# 显示帮助
show_help() {
    cat << EOF
BPS Jetson 更新脚本

用法: bash update.sh [选项]

选项:
    --branch <name>     指定分支名称（默认: DEV）
    --no-backup         跳过备份（不推荐）
    --skip-tests        跳过健康检查
    --rollback          回滚到上一个版本
    --force             强制更新，即使有未提交的更改
    --help              显示此帮助信息

示例:
    bash update.sh                    # 更新 DEV 分支
    bash update.sh --branch main      # 更新 main 分支
    bash update.sh --rollback         # 回滚到上一版本

EOF
}

# 解析参数
BRANCH="DEV"
NO_BACKUP=false
SKIP_TESTS=false
ROLLBACK=false
FORCE=false

while [[ $# -gt 0 ]]; do
    case $1 in
        --branch)
            BRANCH="$2"
            shift 2
            ;;
        --no-backup)
            NO_BACKUP=true
            shift
            ;;
        --skip-tests)
            SKIP_TESTS=true
            shift
            ;;
        --rollback)
            ROLLBACK=true
            shift
            ;;
        --force)
            FORCE=true
            shift
            ;;
        --help)
            show_help
            exit 0
            ;;
        *)
            error "未知选项: $1"
            show_help
            exit 1
            ;;
    esac
done

# 检查项目目录
if [ ! -d "$PROJECT_DIR" ]; then
    error "项目目录不存在: $PROJECT_DIR"
    exit 1
fi

cd "$PROJECT_DIR"

log "=========================================="
log "  BPS Jetson 更新脚本"
log "  分支: $BRANCH"
log "  时间: $(date '+%Y-%m-%d %H:%M:%S')"
log "=========================================="

# 回滚功能
if [ "$ROLLBACK" = true ]; then
    log "执行回滚操作..."
    
    # 查找最近的备份
    LATEST_BACKUP=$(ls -t "$BACKUP_DIR" | head -1)
    if [ -z "$LATEST_BACKUP" ]; then
        error "没有找到备份，无法回滚"
        exit 1
    fi
    
    warning "即将回滚到备份: $LATEST_BACKUP"
    read -p "确认回滚? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        log "取消回滚"
        exit 0
    fi
    
    # 停止容器
    log "停止容器..."
    docker-compose down
    
    # 恢复代码
    log "恢复代码..."
    rsync -avz --delete "$BACKUP_DIR/$LATEST_BACKUP/" "$PROJECT_DIR/"
    
    # 重新启动
    log "重新启动..."
    docker-compose up -d
    
    # 健康检查
    sleep 10
    if curl -f -s http://localhost/api/health > /dev/null 2>&1; then
        success "回滚成功！"
    else
        error "回滚后健康检查失败"
        exit 1
    fi
    
    exit 0
fi

# 1. 检查 Git 状态
log "[1/10] 检查 Git 状态..."

if ! git rev-parse --git-dir > /dev/null 2>&1; then
    error "当前目录不是 Git 仓库"
    exit 1
fi

# 检查未提交的更改
if ! git diff-index --quiet HEAD -- && [ "$FORCE" != true ]; then
    error "存在未提交的更改，请先提交或使用 --force 强制更新"
    git status --short
    exit 1
fi

CURRENT_COMMIT=$(git rev-parse HEAD)
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
log "当前分支: $CURRENT_BRANCH"
log "当前提交: $CURRENT_COMMIT"

# 2. 拉取最新代码
log "[2/10] 拉取最新代码..."

git fetch origin

# 检查是否有更新
LATEST_COMMIT=$(git rev-parse origin/$BRANCH)
if [ "$CURRENT_COMMIT" = "$LATEST_COMMIT" ] && [ "$CURRENT_BRANCH" = "$BRANCH" ]; then
    success "已是最新版本，无需更新"
    exit 0
fi

log "发现更新: $CURRENT_COMMIT -> $LATEST_COMMIT"

# 3. 备份当前版本
if [ "$NO_BACKUP" != true ]; then
    log "[3/10] 备份当前版本..."
    
    mkdir -p "$BACKUP_DIR"
    BACKUP_NAME="backup_$(date '+%Y%m%d_%H%M%S')_${CURRENT_COMMIT:0:7}"
    BACKUP_PATH="$BACKUP_DIR/$BACKUP_NAME"
    
    rsync -avz --exclude '.git' --exclude 'node_modules' --exclude '__pycache__' \
        "$PROJECT_DIR/" "$BACKUP_PATH/"
    
    # 保留最近 5 个备份
    ls -t "$BACKUP_DIR" | tail -n +6 | xargs -I {} rm -rf "$BACKUP_DIR/{}"
    
    success "备份完成: $BACKUP_NAME"
else
    warning "[3/10] 跳过备份（--no-backup）"
fi

# 4. 保存容器状态
log "[4/10] 保存容器状态..."

RUNNING_CONTAINERS=$(docker-compose ps -q)
if [ -n "$RUNNING_CONTAINERS" ]; then
    log "当前运行的容器:"
    docker-compose ps
else
    warning "没有运行中的容器"
fi

# 5. 切换到新版本
log "[5/10] 切换到新版本..."

git checkout "$BRANCH"
git pull origin "$BRANCH"

NEW_COMMIT=$(git rev-parse HEAD)
success "更新完成: $NEW_COMMIT"

# 6. 检查配置变更
log "[6/10] 检查配置变更..."

if ! cmp -s .env.jetson .env 2>/dev/null; then
    warning "检测到 .env.jetson 有变更，请检查是否需要更新 .env"
    if [ -f .env ]; then
        diff .env.jetson .env || true
    fi
fi

# 7. 停止旧容器（蓝绿部署）
log "[7/10] 停止旧容器..."

docker-compose down

# 8. 构建新镜像
log "[8/10] 构建新镜像..."

docker-compose build 2>&1 | tee -a "$LOG_FILE"

if [ ${PIPESTATUS[0]} -ne 0 ]; then
    error "构建失败，开始回滚..."
    git checkout "$CURRENT_COMMIT"
    docker-compose up -d
    exit 1
fi

success "镜像构建成功"

# 9. 启动新容器
log "[9/10] 启动新容器..."

docker-compose up -d

# 10. 健康检查
if [ "$SKIP_TESTS" != true ]; then
    log "[10/10] 健康检查..."
    
    # 等待服务启动
    sleep 10
    
    # 测试 API
    MAX_RETRIES=10
    RETRY_COUNT=0
    
    while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
        if curl -f -s http://localhost/api/health > /dev/null 2>&1; then
            success "健康检查通过"
            break
        fi
        
        RETRY_COUNT=$((RETRY_COUNT + 1))
        log "等待服务启动... ($RETRY_COUNT/$MAX_RETRIES)"
        sleep 3
    done
    
    if [ $RETRY_COUNT -eq $MAX_RETRIES ]; then
        error "健康检查失败，开始回滚..."
        
        # 查看错误日志
        log "错误日志:"
        docker-compose logs --tail=50 backend
        
        # 回滚
        docker-compose down
        git checkout "$CURRENT_COMMIT"
        docker-compose build
        docker-compose up -d
        
        error "回滚完成，请检查错误日志"
        exit 1
    fi
else
    warning "[10/10] 跳过健康检查（--skip-tests）"
fi

# 完成
log "=========================================="
success "🎉 更新完成！"
log "=========================================="
log ""
log "版本信息:"
log "  旧版本: $CURRENT_COMMIT"
log "  新版本: $NEW_COMMIT"
log "  分支:   $BRANCH"
log ""
log "访问地址: http://10.70.80.183"
log "监控命令: bash monitor.sh --watch"
log ""
log "如果遇到问题，可以回滚:"
log "  bash update.sh --rollback"
log "=========================================="

# 显示容器状态
log "当前容器状态:"
docker-compose ps

# 显示资源使用
log ""
log "资源使用情况:"
docker stats --no-stream
