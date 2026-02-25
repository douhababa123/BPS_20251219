#!/bin/bash
#
# BPS 系统监控脚本
# 用途: 监控容器状态、资源使用、API 健康
# 使用: bash monitor.sh
#       bash monitor.sh --watch  # 每 10 秒刷新一次
#

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# 显示监控数据
show_status() {
    clear
    echo "=========================================="
    echo "  BPS 系统监控面板"
    echo "  时间: $(date '+%Y-%m-%d %H:%M:%S')"
    echo "=========================================="
    echo ""
    
    # 1. 容器状态
    echo -e "${BLUE}【容器状态】${NC}"
    BACKEND_RUNNING=$(docker inspect -f '{{.State.Running}}' bps_backend 2>/dev/null || echo "false")
    FRONTEND_RUNNING=$(docker inspect -f '{{.State.Running}}' bps_frontend 2>/dev/null || echo "false")
    
    if [ "$BACKEND_RUNNING" == "true" ]; then
        BACKEND_UPTIME=$(docker inspect -f '{{.State.StartedAt}}' bps_backend 2>/dev/null)
        echo -e "  后端:   ${GREEN}● 运行中${NC}  (启动时间: ${BACKEND_UPTIME:0:19})"
    else
        echo -e "  后端:   ${RED}● 已停止${NC}"
    fi
    
    if [ "$FRONTEND_RUNNING" == "true" ]; then
        FRONTEND_UPTIME=$(docker inspect -f '{{.State.StartedAt}}' bps_frontend 2>/dev/null)
        echo -e "  前端:   ${GREEN}● 运行中${NC}  (启动时间: ${FRONTEND_UPTIME:0:19})"
    else
        echo -e "  前端:   ${RED}● 已停止${NC}"
    fi
    
    echo ""
    
    # 2. 资源使用
    echo -e "${BLUE}【资源使用】${NC}"
    docker stats --no-stream --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.MemPerc}}\t{{.NetIO}}" | grep -E "NAME|bps_"
    echo ""
    
    # 3. 系统资源
    echo -e "${BLUE}【Jetson 系统资源】${NC}"
    
    # CPU 使用率
    CPU_USAGE=$(top -bn1 | grep "Cpu(s)" | sed "s/.*, *\([0-9.]*\)%* id.*/\1/" | awk '{print 100 - $1}')
    printf "  CPU:    %.1f%%\n" "$CPU_USAGE"
    
    # 内存使用
    MEM_INFO=$(free -m | awk 'NR==2{printf "  内存:   %d MB / %d MB (%.1f%%)\n", $3, $2, $3*100/$2}')
    echo "$MEM_INFO"
    
    # 磁盘使用
    DISK_INFO=$(df -h / | awk 'NR==2{printf "  磁盘:   %s / %s (%s)\n", $3, $2, $5}')
    echo "$DISK_INFO"
    
    # 温度（如果可用）
    if [ -f /sys/class/thermal/thermal_zone0/temp ]; then
        TEMP=$(cat /sys/class/thermal/thermal_zone0/temp)
        TEMP_C=$((TEMP / 1000))
        echo -e "  温度:   ${TEMP_C}°C"
    fi
    
    echo ""
    
    # 4. API 健康检查
    echo -e "${BLUE}【API 健康检查】${NC}"
    
    # 测试本地 API
    if curl -f -s -m 2 http://localhost/api/health > /dev/null 2>&1; then
        echo -e "  本地:   ${GREEN}✅ 正常${NC} (http://localhost/api/health)"
    else
        echo -e "  本地:   ${RED}❌ 失败${NC}"
    fi
    
    # 测试外部访问
    if curl -f -s -m 2 http://10.70.80.183/api/health > /dev/null 2>&1; then
        RESPONSE_TIME=$(curl -o /dev/null -s -w '%{time_total}' http://10.70.80.183/api/health)
        echo -e "  外部:   ${GREEN}✅ 正常${NC} (响应时间: ${RESPONSE_TIME}s)"
    else
        echo -e "  外部:   ${RED}❌ 失败${NC} (http://10.70.80.183/api/health)"
    fi
    
    echo ""
    
    # 5. 数据库连接
    echo -e "${BLUE}【数据库连接】${NC}"
    if timeout 2 bash -c "cat < /dev/null > /dev/tcp/10.88.43.154/1433" 2>/dev/null; then
        echo -e "  SQL:    ${GREEN}✅ 可达${NC} (10.88.43.154:1433)"
    else
        echo -e "  SQL:    ${RED}❌ 不可达${NC}"
    fi
    
    echo ""
    
    # 6. 最近日志（最后 5 行错误）
    echo -e "${BLUE}【最近错误日志】${NC}"
    
    BACKEND_ERRORS=$(docker logs --tail 100 bps_backend 2>&1 | grep -iE "(error|exception|failed)" | tail -3)
    if [ -n "$BACKEND_ERRORS" ]; then
        echo -e "${RED}  后端错误:${NC}"
        echo "$BACKEND_ERRORS" | while IFS= read -r line; do
            echo "    ${line:0:100}"
        done
    else
        echo -e "  ${GREEN}无错误${NC}"
    fi
    
    echo ""
    
    # 7. 快捷操作
    echo "=========================================="
    echo "快捷命令:"
    echo "  查看日志:     docker-compose logs -f"
    echo "  重启服务:     docker-compose restart"
    echo "  查看完整状态: docker-compose ps"
    echo "  停止监控:     Ctrl+C"
    echo "=========================================="
}

# 主逻辑
if [ "$1" == "--watch" ]; then
    echo "开始监控（每 10 秒刷新）..."
    while true; do
        show_status
        sleep 10
    done
else
    show_status
    echo ""
    echo "提示: 使用 'bash monitor.sh --watch' 开启实时监控"
fi
