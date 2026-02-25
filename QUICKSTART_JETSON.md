# BPS Jetson 部署快速开始指南

**架构**: Jetson (应用) + 独立 SQL Server (数据库)  
**目标**: 30 分钟内完成基础部署  
**适用**: 已有 SQL Server 在 10.88.43.154

---

## 🎯 架构概览

```
┌──────────────┐
│   用户浏览器   │ (50 人内网访问)
└──────┬───────┘
       │ HTTPS
       ▼
┌────────────────────────┐
│  Jetson (10.70.80.183) │
│  ┌──────────────────┐  │
│  │ Nginx (前端+代理) │  │
│  └────────┬─────────┘  │
│           │             │
│  ┌────────▼─────────┐  │
│  │ FastAPI (后端)    │  │
│  └────────┬─────────┘  │
└───────────┼────────────┘
            │ 局域网 1433
            ▼
   ┌────────────────┐
   │  SQL Server    │
   │ 10.88.43.154   │
   └────────────────┘
```

---

## 🚀 快速部署方式

### 方式一: 一键自动部署（推荐）

```bash
# 1. 克隆代码
git clone https://github.com/douhababa123/BPS_20251219.git
cd BPS_20251219
git checkout DEV

# 2. 运行一键部署脚本
bash deploy.sh

# 3. 访问系统
# 浏览器打开: http://10.70.80.183
```

**说明**: `deploy.sh` 自动完成以下步骤：
- ✅ 检查 Docker 安装
- ✅ 测试数据库连接
- ✅ 配置环境变量
- ✅ 创建所有配置文件
- ✅ 构建 Docker 镜像
- ✅ 启动服务
- ✅ 验证部署

---

### 方式二: 手动分步部署（详细控制）

适用于需要深入了解每一步的用户。

---

## ⚡ 5 步部署流程

### Step 1: 准备 Jetson (15 分钟)

#### 1.1 测试数据库连接（重要！）

```bash
# 使用自动化测试脚本（推荐）
bash test_connection.sh

# 或手动测试
ping 10.88.43.154
telnet 10.88.43.154 1433
```

**如果测试失败**，在 SQL Server (10.88.43.154) 上运行：

```powershell
# PowerShell (管理员权限)

# 1. 添加防火墙规则
New-NetFirewallRule -DisplayName "SQL Server for Jetson" `
  -Direction Inbound `
  -Protocol TCP `
  -LocalPort 1433 `
  -Action Allow `
  -RemoteAddress 10.70.80.183

# 2. 验证规则
Get-NetFirewallRule | Where-Object {$_.DisplayName -like "*SQL*"} | Format-Table

# 3. 检查 TCP/IP 协议
# SQL Server Configuration Manager → SQL Server Network Configuration
# → Protocols for MSSQLSERVER → TCP/IP → Enabled = Yes
```

#### 1.2 更新系统并安装 Docker

```bash
# 1.1 更新系统
sudo apt update && sudo apt upgrade -y

# 1.2 安装 Docker
sudo apt install -y docker.io docker-compose git
sudo usermod -aG docker $USER
newgrp docker

# 1.3 设置固定 IP
sudo nano /etc/netplan/01-netcfg.yaml
```

```yaml
# 编辑内容（实际网络配置）
network:
  version: 2
  ethernets:
    eth0:
      dhcp4: no
      addresses: [10.70.80.183/24]  # Jetson IP
      gateway4: 10.70.80.1
      nameservers:
        addresses: [8.8.8.8, 8.8.4.4]
```

```bash
# 应用网络配置
sudo netplan apply

# 1.4 测试数据库连接（重要！）
ping 10.88.43.154
telnet 10.88.43.154 1433

# 如果 telnet 失败，需要在 SQL Server 端：
# - 启用 TCP/IP 协议
# - 防火墙开放 1433 端口给 10.70.80.183
```

---

### Step 2: 克隆代码 (2 分钟)

```bash
cd ~
git clone https://github.com/douhababa123/BPS_20251219.git
cd BPS_20251219
git checkout DEV
```

---

### Step 3: 创建配置文件 (5 分钟)

#### 3.1 后端 Dockerfile

```bash
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
```

#### 3.2 前端构建 Dockerfile

```bash
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
```

#### 3.3 Nginx 配置

```bash
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
```

#### 3.4 Docker Compose

```bash
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
      DB_SERVER: "10.88.43.154"
      DB_DATABASE: "DCCT_BPS_Debug"
      DB_USERNAME: "${DB_USERNAME}"
      DB_PASSWORD: "${DB_PASSWORD}"
      DB_DRIVER: "ODBC Driver 17 for SQL Server"
      JWT_SECRET_KEY: "${JWT_SECRET_KEY}"
      APP_ENV: "production"
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
```

#### 3.5 环境变量

```bash
# 复制预配置的模板（已包含当前数据库信息）
cp .env.jetson .env

# 生成新的 JWT 密钥（安全要求）
sed -i "s/your-secret-key-change-this-in-production/$(openssl rand -hex 32)/" .env

# 如果需要 OTP 邮件功能，编辑 SMTP 配置
nano .env
# 修改这两行：
#   SMTP_USERNAME=your_email@bosch.com
#   SMTP_PASSWORD=your_email_password

# 验证配置
cat .env | grep -E "(DB_|JWT_|SMTP_|ALLOWED_ORIGINS)"
```

**说明**：
- 数据库配置已预填（10.88.43.154 / DCCT_BPS_Debug / TEST / 123456）
- JWT 密钥会自动生成
- CORS 已配置为 Jetson IP (10.70.80.183)
- 如不需要 OTP 邮件功能，可跳过 SMTP 配置

#### 3.6 requirements.txt

```bash
cat > backend/requirements.txt << 'EOF'
fastapi==0.104.1
uvicorn[standard]==0.24.0
gunicorn==21.2.0
pyodbc==5.0.1
pydantic==2.5.0
python-jose[cryptography]==3.3.0
passlib[bcrypt]==1.7.4
python-multipart==0.0.6
openpyxl==3.1.2
pandas==2.1.3
EOF
```

---

### Step 4: 构建和启动 (5 分钟)

```bash
# 4.1 构建 Docker 镜像（首次较慢，约 3-5 分钟）
docker-compose build

# 4.2 启动服务
docker-compose up -d

# 4.3 查看日志（确保无错误）
docker-compose logs -f
# 看到 "Application startup complete" 后按 Ctrl+C 退出
```

---

### Step 5: 验证部署 (3 分钟)

```bash
# 5.1 检查容器状态
docker-compose ps
# 应该看到 backend 和 frontend 都是 "Up"

# 5.2 测试后端 API
curl http://localhost/api/health
# 应返回: {"status":"healthy"}

# 5.3 测试数据库连接
docker-compose exec backend python -c "
from database import Database
db = Database()
conn = db.connect()
print('✅ 数据库连接成功')
conn.close()
"

# 5.4 浏览器访问
# 打开: http://10.70.80.183
# 应看到 BPS 登录页面
```

---

## 🔧 常用运维命令

### 实时监控

```bash
# 使用监控脚本（推荐）
bash monitor.sh              # 显示一次
bash monitor.sh --watch      # 每 10 秒刷新

# 手动查看
docker-compose ps            # 容器状态
docker stats                 # 资源使用
```

### 查看状态

```bash
# 查看容器
docker-compose ps

# 查看日志
docker-compose logs backend        # 后端日志
docker-compose logs frontend       # 前端日志
docker-compose logs -f --tail=100  # 实时查看最后 100 行

# 查看资源使用
docker stats
```

### 重启服务

```bash
# 重启所有服务
docker-compose restart

# 重启后端
docker-compose restart backend

# 重启前端
docker-compose restart frontend
```

### 更新代码

```bash
# 1. 拉取最新代码
cd ~/BPS_20251219
git pull origin DEV

# 2. 重新构建和启动
docker-compose down
docker-compose build
docker-compose up -d

# 3. 验证
docker-compose logs -f
```

### 停止服务

```bash
# 停止但保留容器
docker-compose stop

# 停止并删除容器
docker-compose down

# 完全清理（包括镜像）
docker-compose down --rmi all
```

---

## 📊 性能测试

```bash
# 安装测试工具
sudo apt install apache2-utils -y

# 测试 50 并发（模拟 50 个用户）
ab -n 1000 -c 50 http://10.70.80.183/api/health

# 预期结果:
# Time per request: < 100ms
# Requests per second: > 500
# Failed requests: 0
```

---

## 🚨 故障排查

### 问题 1: 数据库连接失败

```bash
# 诊断步骤
ping 10.88.43.154                    # 测试网络
telnet 10.88.43.154 1433             # 测试端口
docker-compose exec backend bash     # 进入容器
odbcinst -q -d                       # 查看 ODBC 驱动

# SQL Server 端检查：
# 1. SQL Server Configuration Manager
#    → TCP/IP 协议已启用
# 2. Windows 防火墙
#    → 1433 端口已开放给 10.70.80.183
# 3. SQL Server 身份验证
#    → 允许 SQL Server 和 Windows 身份验证
```

### 问题 2: 前端 404 错误

```bash
# 检查构建产物
docker-compose exec frontend ls -la /usr/share/nginx/html

# 如果目录为空，重新构建
docker-compose build frontend
docker-compose up -d frontend
```

### 问题 3: 性能问题

```bash
# 查看资源使用
htop               # 整体系统
docker stats       # 容器资源

# 调整 worker 数量（如果 CPU 利用率低）
# 编辑 backend/Dockerfile
# 修改: --workers 4  →  --workers 6

# 重新构建
docker-compose build backend
docker-compose up -d backend
```

---

## 🔒 生产环境加固

### 1. 启用 HTTPS

```bash
# 生成自签名证书（内网使用）
sudo mkdir -p /etc/nginx/ssl
cd /etc/nginx/ssl
sudo openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout bps.key -out bps.crt \
  -subj "/CN=10.70.80.183"

# 修改 nginx.conf 添加 HTTPS 配置
# 参考完整部署指南的 HTTPS 配置部分
```

### 2. 设置自动重启

```bash
# 创建 systemd 服务
sudo nano /etc/systemd/system/bps.service
```

```ini
[Unit]
Description=BPS Application
After=docker.service
Requires=docker.service

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=/home/YOUR_USERNAME/BPS_20251219
ExecStart=/usr/bin/docker-compose up -d
ExecStop=/usr/bin/docker-compose down
User=YOUR_USERNAME

[Install]
WantedBy=multi-user.target
```

```bash
# 启用服务
sudo systemctl daemon-reload
sudo systemctl enable bps.service
sudo systemctl start bps.service
```

### 3. 日志轮转

```bash
sudo nano /etc/logrotate.d/bps
```

```
/home/YOUR_USERNAME/BPS_20251219/logs/*.log {
    daily
    rotate 14
    compress
    delaycompress
    missingok
    notifempty
}
```

---

## ✅ 部署检查清单

- [ ] Jetson 网络配置（静态 IP）
- [ ] 到 SQL Server 的连接测试（ping + telnet 1433）
- [ ] Docker 和 Docker Compose 安装
- [ ] 代码克隆完成
- [ ] 配置文件创建（Dockerfile, docker-compose.yml, nginx.conf）
- [ ] .env 文件配置（数据库密码）
- [ ] Docker 镜像构建成功
- [ ] 容器启动正常（docker-compose ps）
- [ ] API 健康检查通过
- [ ] 数据库连接验证
- [ ] 浏览器访问测试
- [ ] 多用户并发测试（ab 工具）

---

## 📞 需要帮助？

**常见问题**:
1. 数据库连接问题 → 检查 SQL Server (10.88.43.154) 端防火墙允许 10.70.80.183 访问 1433 端口
2. 性能不足 → 增加 worker 数量（当前 4 个），考虑添加 Redis 缓存
3. 内存不足 → 调整 docker-compose.yml 的资源限制（当前后端 2G）

**下一步优化**:
- 添加 HTTPS 支持
- 配置自动备份
- 设置监控告警
- 添加日志聚合（ELK Stack）

参考完整部署指南获取更多细节：`DEPLOYMENT_GUIDE_JETSON.md`
