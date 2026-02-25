#!/bin/bash
#
# BPS Jetson 一键部署脚本
# 用途: 自动化完成所有部署步骤
# 使用: bash deploy.sh
#

set -e  # 遇到错误立即退出

echo "=========================================="
echo "  BPS Jetson 一键部署脚本"
echo "  目标 IP: 10.70.80.183"
echo "  数据库: 10.88.43.154"
echo "=========================================="
echo ""

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Step 1: 检查先决条件
echo -e "${YELLOW}[1/7] 检查先决条件...${NC}"

if ! command -v docker &> /dev/null; then
    echo -e "${RED}❌ 错误: Docker 未安装${NC}"
    echo "请先运行: sudo apt install -y docker.io"
    exit 1
fi

if ! command -v docker-compose &> /dev/null; then
    echo -e "${RED}❌ 错误: Docker Compose 未安装${NC}"
    echo "请先运行: sudo apt install -y docker-compose"
    exit 1
fi

echo -e "${GREEN}✅ Docker 和 Docker Compose 已安装${NC}"

# Step 2: 测试数据库连接
echo -e "\n${YELLOW}[2/7] 测试数据库连接...${NC}"

if ping -c 1 -W 2 10.88.43.154 &> /dev/null; then
    echo -e "${GREEN}✅ 数据库服务器网络可达${NC}"
else
    echo -e "${RED}❌ 错误: 无法 ping 通 10.88.43.154${NC}"
    exit 1
fi

if timeout 2 bash -c "cat < /dev/null > /dev/tcp/10.88.43.154/1433" 2>/dev/null; then
    echo -e "${GREEN}✅ SQL Server 端口 1433 开放${NC}"
else
    echo -e "${RED}❌ 警告: SQL Server 端口 1433 无法访问${NC}"
    echo "   请在 SQL Server 端检查:"
    echo "   1. TCP/IP 协议已启用"
    echo "   2. 防火墙允许 10.70.80.183 访问 1433 端口"
    read -p "   是否继续部署? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# Step 3: 配置环境变量
echo -e "\n${YELLOW}[3/7] 配置环境变量...${NC}"

if [ ! -f .env ]; then
    if [ -f .env.jetson ]; then
        cp .env.jetson .env
        echo -e "${GREEN}✅ 已复制 .env.jetson 为 .env${NC}"
        
        # 生成 JWT 密钥
        JWT_KEY=$(openssl rand -hex 32)
        sed -i "s/your-secret-key-change-this-in-production/${JWT_KEY}/" .env
        echo -e "${GREEN}✅ 已生成随机 JWT 密钥${NC}"
    else
        echo -e "${RED}❌ 错误: .env.jetson 文件不存在${NC}"
        exit 1
    fi
else
    echo -e "${YELLOW}⚠️  .env 文件已存在，跳过创建${NC}"
fi

# Step 4: 创建必要的配置文件
echo -e "\n${YELLOW}[4/7] 创建 Docker 配置文件...${NC}"

# 创建 backend/Dockerfile
if [ ! -f backend/Dockerfile ]; then
    cat > backend/Dockerfile << 'EOF'
FROM python:3.9-slim

WORKDIR /app

# 安装 ODBC 驱动
RUN apt-get update && apt-get install -y curl gnupg apt-transport-https \
    && curl https://packages.microsoft.com/keys/microsoft.asc | apt-key add - \
    && curl https://packages.microsoft.com/config/debian/10/prod.list > /etc/apt/sources.list.d/mssql-release.list \
    && apt-get update \
    && ACCEPT_EULA=Y apt-get install -y msodbcsql17 unixodbc-dev \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8000

CMD ["gunicorn", "main:app", \
     "--workers", "4", \
     "--worker-class", "uvicorn.workers.UvicornWorker", \
     "--bind", "0.0.0.0:8000", \
     "--timeout", "120"]
EOF
    echo -e "${GREEN}✅ 创建 backend/Dockerfile${NC}"
fi

# 创建 Dockerfile.frontend
if [ ! -f Dockerfile.frontend ]; then
    cat > Dockerfile.frontend << 'EOF'
FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
EOF
    echo -e "${GREEN}✅ 创建 Dockerfile.frontend${NC}"
fi

# 创建 nginx.conf
if [ ! -f nginx.conf ]; then
    cat > nginx.conf << 'EOF'
upstream backend_api {
    server backend:8000;
    keepalive 32;
}

server {
    listen 80;
    server_name _;

    # 前端静态文件
    location / {
        root /usr/share/nginx/html;
        index index.html;
        try_files $uri $uri/ /index.html;
    }

    # API 代理
    location /api/ {
        proxy_pass http://backend_api/api/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_http_version 1.1;
        proxy_set_header Connection "";
    }

    # Gzip 压缩
    gzip on;
    gzip_types text/plain text/css application/json application/javascript;
}
EOF
    echo -e "${GREEN}✅ 创建 nginx.conf${NC}"
fi

# 创建 docker-compose.yml
if [ ! -f docker-compose.yml ]; then
    cat > docker-compose.yml << 'EOF'
version: '3.8'

services:
  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    container_name: bps_backend
    restart: unless-stopped
    environment:
      DB_SERVER: "${DB_SERVER:-10.88.43.154}"
      DB_DATABASE: "${DB_DATABASE:-DCCT_BPS_Debug}"
      DB_USERNAME: "${DB_USERNAME:-TEST}"
      DB_PASSWORD: "${DB_PASSWORD:-123456}"
      DB_DRIVER: "ODBC Driver 17 for SQL Server"
      JWT_SECRET_KEY: "${JWT_SECRET_KEY}"
      APP_ENV: "production"
      DEBUG: "false"
    networks:
      - bps_network
    deploy:
      resources:
        limits:
          cpus: '3.0'
          memory: 2G

  frontend:
    build:
      context: .
      dockerfile: Dockerfile.frontend
    container_name: bps_frontend
    restart: unless-stopped
    ports:
      - "80:80"
    depends_on:
      - backend
    networks:
      - bps_network
    deploy:
      resources:
        limits:
          cpus: '1.0'
          memory: 512M

networks:
  bps_network:
    driver: bridge
EOF
    echo -e "${GREEN}✅ 创建 docker-compose.yml${NC}"
fi

# Step 5: 构建 Docker 镜像
echo -e "\n${YELLOW}[5/7] 构建 Docker 镜像（首次需要 5-10 分钟）...${NC}"

docker-compose build 2>&1 | tee build.log

if [ ${PIPESTATUS[0]} -eq 0 ]; then
    echo -e "${GREEN}✅ Docker 镜像构建成功${NC}"
else
    echo -e "${RED}❌ Docker 镜像构建失败，请查看 build.log${NC}"
    exit 1
fi

# Step 6: 启动服务
echo -e "\n${YELLOW}[6/7] 启动服务...${NC}"

docker-compose up -d

sleep 5  # 等待服务启动

# Step 7: 验证部署
echo -e "\n${YELLOW}[7/7] 验证部署...${NC}"

# 检查容器状态
BACKEND_STATUS=$(docker inspect -f '{{.State.Running}}' bps_backend 2>/dev/null || echo "false")
FRONTEND_STATUS=$(docker inspect -f '{{.State.Running}}' bps_frontend 2>/dev/null || echo "false")

if [ "$BACKEND_STATUS" == "true" ]; then
    echo -e "${GREEN}✅ 后端容器运行正常${NC}"
else
    echo -e "${RED}❌ 后端容器启动失败${NC}"
    docker-compose logs backend
    exit 1
fi

if [ "$FRONTEND_STATUS" == "true" ]; then
    echo -e "${GREEN}✅ 前端容器运行正常${NC}"
else
    echo -e "${RED}❌ 前端容器启动失败${NC}"
    docker-compose logs frontend
    exit 1
fi

# 测试 API
sleep 3
if curl -f -s http://localhost/api/health > /dev/null 2>&1; then
    echo -e "${GREEN}✅ API 健康检查通过${NC}"
else
    echo -e "${RED}❌ API 健康检查失败${NC}"
    echo "请运行查看日志: docker-compose logs backend"
fi

# 完成
echo ""
echo "=========================================="
echo -e "${GREEN}🎉 部署完成！${NC}"
echo "=========================================="
echo ""
echo "访问地址: http://10.70.80.183"
echo ""
echo "常用命令:"
echo "  查看日志: docker-compose logs -f"
echo "  重启服务: docker-compose restart"
echo "  停止服务: docker-compose down"
echo "  查看状态: docker-compose ps"
echo ""
echo "如有问题，请查看:"
echo "  - build.log (构建日志)"
echo "  - docker-compose logs backend"
echo "  - docker-compose logs frontend"
echo "=========================================="
