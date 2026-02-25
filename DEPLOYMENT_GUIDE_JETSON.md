# BPS 系统 Jetson 部署指南

**目标环境**: NVIDIA Jetson (ARM64 架构)  
**并发用户**: ~50 人  
**部署模式**: 生产环境  
**文档版本**: 1.0  
**更新日期**: 2026-02-25

---

## 📋 目录

1. [架构概览](#架构概览)
2. [硬件要求](#硬件要求)
3. [关键挑战与解决方案](#关键挑战与解决方案)
4. [部署前准备](#部署前准备)
5. [部署方案对比](#部署方案对比)
6. [推荐部署架构](#推荐部署架构)
7. [详细部署步骤](#详细部署步骤)
8. [性能优化](#性能优化)
9. [监控与维护](#监控与维护)
10. [故障排查](#故障排查)

---

## 架构概览

### 当前系统架构

```
┌─────────────────┐
│  浏览器客户端    │ (50 个并发用户)
└────────┬────────┘
         │ HTTP/HTTPS
         ▼
┌─────────────────┐
│  前端服务        │ React + Vite (端口 5173)
│  (当前开发模式)   │
└────────┬────────┘
         │ REST API
         ▼
┌─────────────────┐
│  后端服务        │ FastAPI + Python (端口 8000)
└────────┬────────┘
         │ pyodbc
         ▼
┌─────────────────┐
│  SQL Server     │ 10.88.43.154 (Windows Server)
└─────────────────┘
```

### 目标生产架构（Jetson + 独立数据库服务器）✅

```
┌─────────────────┐
│  浏览器客户端    │ (50 个并发用户，内网访问)
└────────┬────────┘
         │ HTTPS (443)
         ▼
┌──────────────────────────────────────────────┐
│              Jetson 设备                      │
│  (应用服务器 - 192.168.1.100)                 │
│  ┌────────────────────────────────────────┐  │
│  │  Nginx (反向代理 + SSL + 静态文件)      │  │ ← 入口
│  └───────────┬────────────────────────────┘  │
│              │                                │
│      ┌───────┴────────┐                       │
│      │                │                       │
│      ▼                ▼                       │
│  ┌─────────┐    ┌──────────┐                 │
│  │ 前端静态  │    │ 后端 API  │                 │
│  │ 文件服务  │    │ FastAPI  │ (4-5 workers)   │
│  │ (Nginx) │    │ Gunicorn │                 │
│  └─────────┘    └────┬─────┘                 │
│                      │                        │
└──────────────────────┼────────────────────────┘
                       │ TCP/IP (1433)
                       │ 局域网高速连接
                       ▼
            ┌─────────────────────┐
            │  数据库服务器        │ (Windows Server)
            │  SQL Server 2019    │
            │  10.88.43.154:1433  │
            │  DCCT_BPS_Debug     │
            └─────────────────────┘

优势：
✅ SQL Server 保持在高性能服务器上（x86_64）
✅ 无需数据迁移，零停机时间
✅ 利用现有备份和恢复方案
✅ Jetson 只负责应用层，资源需求更低
✅ 数据库和应用分离，易于扩展
```

---

## 硬件要求

### Jetson 型号建议

| 型号 | CPU | RAM | 存储 | 适用场景 | 预估并发 |
|------|-----|-----|------|---------|---------|
| **Jetson Orin NX 16GB** ✅ | 8 核 ARM Cortex-A78AE | 16GB | 64GB+ | **推荐** | 50-100 |
| Jetson Orin Nano 8GB | 6 核 | 8GB | 64GB+ | 基本满足 | 30-50 |
| Jetson Xavier NX | 6 核 | 8GB | 32GB+ | 边缘可用 | 20-40 |
| Jetson Nano ❌ | 4 核 | 4GB | 16GB | **不推荐** | < 20 |

### 存储要求

```
最小配置: 64GB eMMC/SD 卡
推荐配置: 128GB NVMe SSD

空间分配:
├── 系统 (Ubuntu)           : 15 GB
├── Docker 镜像和容器        : 10 GB
├── 应用代码                : 2 GB
├── 日志文件 (轮转)          : 5 GB
├── 数据库备份 (可选)        : 10 GB
└── 预留空间                : 26+ GB
```

### 网络要求

- **带宽**: 至少 100 Mbps (推荐 1 Gbps)
- **延迟**: 到 SQL Server < 10ms (局域网内)
- **固定 IP**: 必须（或通过 DHCP 保留）
- **防火墙**: 开放 80/443 端口（外部访问），1433 端口（到 SQL Server）

---

## 关键挑战与解决方案

### ✅ 架构优势：应用与数据库分离

**您的架构配置（推荐）**:
- **Jetson**: 应用服务器（前端 + 后端 API）
- **Windows Server**: 数据库服务器（SQL Server 10.88.43.154）

**这是最佳实践！原因**:
1. ✅ **无需数据迁移** - SQL Server 保持在原位置，零风险
2. ✅ **性能最优** - SQL Server 运行在 x86_64 架构上，充分利用硬件
3. ✅ **简化部署** - Jetson 不需要安装数据库，节省资源
4. ✅ **备份恢复简单** - 使用现有的数据库维护流程
5. ✅ **独立扩展** - 应用层和数据层可以独立升级
6. ✅ **故障隔离** - 应用服务器问题不影响数据库，反之亦然

**网络要求（重要）**:
```bash
# 1. Jetson → SQL Server 连接测试
ping 10.88.43.154          # 延迟应 < 10ms
telnet 10.88.43.154 1433   # 端口必须开放

# 2. 防火墙规则（SQL Server 端）
# 允许来自 Jetson IP (192.168.1.100) 的 1433 端口连接

# 3. SQL Server 配置
# - 启用 TCP/IP 协议
# - 允许远程连接
# - SQL Server Browser 服务运行中
```

---

### ⚠️ 挑战 1: 50 并发用户的性能需求

**计算资源估算**:

```python
# 每个请求的平均资源占用
单个 API 请求:
  - CPU: 0.02 核心 × 200ms = 4ms 核心时间
  - 内存: 50 MB (Python + FastAPI 进程)
  - 数据库连接: 1 个（短暂）

50 个并发用户（峰值场景）:
  - CPU: 50 × 0.02 = 1 核心（持续负载）
  - 内存: 500 MB - 1 GB (共享 Python 解释器)
  - 数据库连接池: 10-20 个连接
```

**解决方案**:
1. **后端多 Worker 部署**: 使用 Gunicorn + Uvicorn workers (4-5 个)
2. **连接池优化**: 设置合理的数据库连接池（10-20 个连接）
3. **静态资源优化**: 前端静态文件由 Nginx 直接服务（CDN 功能）
4. **缓存策略**: Redis 缓存热点数据（可选）
5. **网络优化**: Jetson 和数据库服务器使用千兆以太网直连

---

### ⚠️ 挑战 2: Vite 开发服务器不适合生产

**问题**: `npm run dev` 是开发模式，性能差、不稳定

**解决方案**:
```bash
# 1. 构建生产版本
npm run build  # 输出到 dist/

# 2. 通过 Nginx 服务静态文件
# 不再运行 Vite dev server
```

---

## 部署前准备

### 1. Jetson 系统初始化

```bash
# 1.1 更新系统
sudo apt update && sudo apt upgrade -y

# 1.2 安装必要工具
sudo apt install -y \
  docker.io \
  docker-compose \
  nginx \
  git \
  curl \
  vim \
  htop \
  net-tools

# 1.3 配置 Docker 权限
sudo usermod -aG docker $USER
newgrp docker

# 1.4 启用 Docker 开机自启
sudo systemctl enable docker
sudo systemctl start docker

# 1.5 验证安装
docker --version
nginx -v
```

### 2. 网络配置

```bash
# 2.1 设置静态 IP（编辑 netplan 配置）
sudo vim /etc/netplan/01-netcfg.yaml

# 内容示例:
network:
  version: 2
  ethernets:
    eth0:
      dhcp4: no
      addresses:
        - 192.168.1.100/24  # Jetson 的固定 IP
      gateway4: 192.168.1.1
      nameservers:
        addresses: [8.8.8.8, 8.8.4.4]

# 2.2 应用配置
sudo netplan apply

# 2.3 验证网络和数据库连接
ip addr show
ping 10.88.43.154                # 测试到数据库服务器的连接
telnet 10.88.43.154 1433         # 测试 SQL Server 端口

# 如果 telnet 不通，需要在 SQL Server 端配置：
# 1. SQL Server Configuration Manager
#    → SQL Server Network Configuration
#    → Protocols for [实例名]
#    → TCP/IP → 启用
# 
# 2. Windows 防火墙
#    → 入站规则
#    → 新建规则
#    → 端口 1433 TCP
#    → 允许来自 192.168.1.100 的连接
#
# 3. SQL Server Browser 服务
#    → 设置为自动启动
```

### 3. 防火墙配置（Jetson 端）

```bash
# 3.1 安装 UFW
sudo apt install ufw -y

# 3.2 配置规则
sudo ufw allow 22/tcp      # SSH
sudo ufw allow 80/tcp      # HTTP
sudo ufw allow 443/tcp     # HTTPS
sudo ufw default deny incoming
sudo ufw default allow outgoing

# 3.3 启用防火墙
sudo ufw enable
sudo ufw status
```

### 4. SSL 证书准备（HTTPS）

**选项 A: 自签名证书（内网使用）**
```bash
sudo mkdir -p /etc/nginx/ssl
cd /etc/nginx/ssl

# 生成证书（有效期 365 天）
sudo openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout bps-selfsigned.key \
  -out bps-selfsigned.crt \
  -subj "/C=CN/ST=Shanghai/L=Shanghai/O=Bosch/CN=bps.local"
```

**选项 B: Let's Encrypt 证书（公网使用）**
```bash
sudo apt install certbot python3-certbot-nginx -y
sudo certbot --nginx -d yourdomain.com
```

### 5. 代码准备

```bash
# 5.1 克隆代码到 Jetson
cd /home/$USER
git clone https://github.com/douhababa123/BPS_20251219.git
cd BPS_20251219
git checkout DEV  # 或 main 分支

# 5.2 创建必要的目录
mkdir -p logs
mkdir -p backups
```

---

## 部署方案对比

### 方案 1: Docker Compose 部署（推荐）✅

**优点**:
- ✅ 环境隔离，依赖管理简单
- ✅ 一键启动/停止/重启
- ✅ 易于回滚和版本管理
- ✅ 资源限制配置简单

**缺点**:
- ⚠️ 需要编写 Dockerfile 和 docker-compose.yml
- ⚠️ Docker overlay 网络有轻微性能开销

### 方案 2: Systemd 服务部署

**优点**:
- ✅ 原生性能，无容器开销
- ✅ 系统级管理，开机自启简单

**缺点**:
- ❌ 依赖管理复杂（需手动配置 Python 环境）
- ❌ 不同环境不一致性风险高

### 方案 3: Kubernetes (K3s)

**优点**:
- ✅ 企业级容器编排
- ✅ 自动扩展、自愈

**缺点**:
- ❌ 过度复杂（50 用户不需要）
- ❌ Jetson 资源不足

---

## 推荐部署架构

### 部署方案: Docker Compose + Nginx

```yaml
架构组件:
├── Nginx (容器)                      # 反向代理 + 静态文件服务
│   ├── SSL 终止 (HTTPS)
│   ├── 前端静态文件 (React build)
│   └── API 请求转发到后端
├── FastAPI 后端 (容器)               # Python + Gunicorn + Uvicorn
│   ├── 4-5 个 worker 进程
│   ├── pyodbc 驱动（连接 SQL Server）
│   └── 数据库连接池（10-20 个连接）
└── SQL Server (外部独立服务器) ✅    # 10.88.43.154 (保持现状)
    ├── Windows Server
    ├── 现有备份策略
    └── 局域网高速连接
```

**网络拓扑**:
```
用户设备 (50台)
    │
    ├─→ http://192.168.1.100 (或内网域名)
    │
    ▼
Jetson (192.168.1.100)
    │
    ├─→ Nginx :80/443
    ├─→ Backend :8000 (内部)
    │
    ▼ TCP 1433 (局域网)
    │
SQL Server (10.88.43.154)
    │
    └─→ DCCT_BPS_Debug 数据库
```

---

## 详细部署步骤

### Step 1: 创建 Dockerfile

#### 后端 Dockerfile

```dockerfile
# backend/Dockerfile
FROM python:3.9-slim

# 设置工作目录
WORKDIR /app

# 安装系统依赖（SQL Server ODBC 驱动）
RUN apt-get update && apt-get install -y \
    curl \
    gnupg \
    apt-transport-https \
    && curl https://packages.microsoft.com/keys/microsoft.asc | apt-key add - \
    && curl https://packages.microsoft.com/config/debian/10/prod.list > /etc/apt/sources.list.d/mssql-release.list \
    && apt-get update \
    && ACCEPT_EULA=Y apt-get install -y msodbcsql17 unixodbc-dev \
    && rm -rf /var/lib/apt/lists/*

# 复制依赖文件
COPY requirements.txt .

# 安装 Python 依赖
RUN pip install --no-cache-dir -r requirements.txt

# 复制应用代码
COPY . .

# 暴露端口
EXPOSE 8000

# 启动命令（生产模式）
CMD ["gunicorn", "main:app", \
     "--workers", "4", \
     "--worker-class", "uvicorn.workers.UvicornWorker", \
     "--bind", "0.0.0.0:8000", \
     "--timeout", "120", \
     "--access-logfile", "-", \
     "--error-logfile", "-"]
```

#### 前端 Dockerfile（构建阶段）

```dockerfile
# frontend/Dockerfile
FROM node:18-alpine AS builder

WORKDIR /app

# 复制依赖文件
COPY package.json package-lock.json ./

# 安装依赖
RUN npm ci

# 复制源代码
COPY . .

# 构建生产版本
RUN npm run build

# 生产阶段（Nginx 服务静态文件）
FROM nginx:alpine

# 复制构建产物
COPY --from=builder /app/dist /usr/share/nginx/html

# 复制 Nginx 配置
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
```

### Step 2: 创建 Nginx 配置

```nginx
# nginx.conf
upstream backend_api {
    # 后端 API 服务器
    server backend:8000;
    
    # 连接池配置
    keepalive 32;
}

server {
    listen 80;
    server_name _;  # 替换为您的域名或 IP

    # 重定向到 HTTPS（可选）
    # return 301 https://$server_name$request_uri;

    # 前端静态文件
    location / {
        root /usr/share/nginx/html;
        index index.html;
        try_files $uri $uri/ /index.html;  # SPA 路由支持
        
        # 缓存策略
        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf)$ {
            expires 1y;
            add_header Cache-Control "public, immutable";
        }
    }

    # API 代理
    location /api/ {
        proxy_pass http://backend_api/api/;
        
        # WebSocket 支持（如果需要）
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        
        # 转发原始请求信息
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # 超时配置
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # 健康检查端点
    location /health {
        access_log off;
        return 200 "healthy\n";
        add_header Content-Type text/plain;
    }
}

# HTTPS 配置（可选）
server {
    listen 443 ssl http2;
    server_name _;

    ssl_certificate /etc/nginx/ssl/bps-selfsigned.crt;
    ssl_certificate_key /etc/nginx/ssl/bps-selfsigned.key;
    
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    # 其余配置与 HTTP 相同
    location / {
        root /usr/share/nginx/html;
        index index.html;
        try_files $uri $uri/ /index.html;
    }

    location /api/ {
        proxy_pass http://backend_api/api/;
        # ... (同上)
    }
}
```

### Step 3: 创建 docker-compose.yml

```yaml
# docker-compose.yml
version: '3.8'

services:
  # 后端 API 服务
  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    container_name: bps_backend
    restart: unless-stopped
    environment:
      # 数据库配置
      DB_SERVER: "10.88.43.154"
      DB_DATABASE: "DCCT_BPS_Debug"
      DB_USERNAME: "your_username"
      DB_PASSWORD: "your_password"
      DB_DRIVER: "ODBC Driver 17 for SQL Server"
      
      # 应用配置
      APP_ENV: "production"
      LOG_LEVEL: "INFO"
      
      # SMTP 配置（如果需要 OTP 邮件）
      SMTP_SERVER: "smtp.bosch.com"
      SMTP_PORT: "587"
      SMTP_USERNAME: "your_smtp_user"
      SMTP_PASSWORD: "your_smtp_password"
    volumes:
      - ./logs:/app/logs
    networks:
      - bps_network
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8000/api/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s
    deploy:
      resources:
        limits:
          cpus: '3.0'
          memory: 2G
        reservations:
          cpus: '1.0'
          memory: 512M

  # 前端 + Nginx
  frontend:
    build:
      context: ./
      dockerfile: frontend.Dockerfile
    container_name: bps_frontend
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/conf.d/default.conf:ro
      - /etc/nginx/ssl:/etc/nginx/ssl:ro  # SSL 证书
      - ./logs/nginx:/var/log/nginx
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
```

### Step 4: 创建 requirements.txt

```bash
# 在 backend 目录运行
cd backend
pip freeze > requirements.txt

# 或手动创建 requirements.txt
cat > requirements.txt << EOF
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

### Step 5: 修改后端配置（生产环境）

```python
# backend/config.py
import os
from typing import List

class Settings:
    # 应用配置
    app_name: str = "BPS API"
    app_version: str = "1.0.0"
    app_env: str = os.getenv("APP_ENV", "production")
    
    # 数据库配置（从环境变量读取）
    db_server: str = os.getenv("DB_SERVER", "10.88.43.154")
    db_database: str = os.getenv("DB_DATABASE", "DCCT_BPS_Debug")
    db_username: str = os.getenv("DB_USERNAME", "")
    db_password: str = os.getenv("DB_PASSWORD", "")
    db_driver: str = os.getenv("DB_DRIVER", "ODBC Driver 17 for SQL Server")
    
    # CORS 配置（生产环境）
    allowed_origins: List[str] = [
        "http://192.168.1.100",      # Jetson IP
        "https://192.168.1.100",
        "http://bps.local",          # 内网域名
        "https://bps.local",
    ]
    
    # JWT 配置
    jwt_secret_key: str = os.getenv("JWT_SECRET_KEY", "CHANGE_THIS_IN_PRODUCTION")
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 1440  # 24 小时
    
    # SMTP 配置
    smtp_server: str = os.getenv("SMTP_SERVER", "smtp.bosch.com")
    smtp_port: int = int(os.getenv("SMTP_PORT", "587"))
    smtp_username: str = os.getenv("SMTP_USERNAME", "")
    smtp_password: str = os.getenv("SMTP_PASSWORD", "")
    
    # OTP 配置
    otp_expire_minutes: int = 10
    allowed_email_domains: List[str] = ["bosch.com"]

settings = Settings()
```

### Step 6: 部署执行

```bash
# 6.1 进入项目目录
cd /home/$USER/BPS_20251219

# 6.2 创建环境变量文件（不提交到 Git）
cat > .env << EOF
DB_USERNAME=your_db_username
DB_PASSWORD=your_db_password
JWT_SECRET_KEY=$(openssl rand -hex 32)
SMTP_USERNAME=your_smtp_user
SMTP_PASSWORD=your_smtp_password
EOF

# 6.3 构建镜像
docker-compose build

# 6.4 启动服务
docker-compose up -d

# 6.5 查看日志
docker-compose logs -f

# 6.6 检查服务状态
docker-compose ps
docker-compose logs backend
docker-compose logs frontend
```

### Step 7: 验证部署

```bash
# 7.1 检查容器运行状态
docker ps

# 7.2 测试后端 API
curl http://localhost/api/health
curl http://localhost/api/docs  # Swagger 文档

# 7.3 测试前端
curl http://localhost/

# 7.4 测试数据库连接
docker-compose exec backend python -c "
from database import Database
db = Database()
conn = db.connect()
print('✅ 数据库连接成功')
"

# 7.5 从其他设备访问
# 浏览器打开: http://192.168.1.100 (Jetson IP)
```

---

## 性能优化

### 1. 后端优化

#### 调整 Gunicorn Workers

```python
# 计算最佳 worker 数量
# 公式: (2 × CPU核心数) + 1

# Jetson Orin NX (8 核)
workers = (2 × 8) + 1 = 17  # 理论值
推荐: 4-6 个 workers（考虑内存限制）

# 修改 docker-compose.yml 或 Dockerfile CMD
CMD ["gunicorn", "main:app", \
     "--workers", "5", \
     "--worker-class", "uvicorn.workers.UvicornWorker", \
     "--bind", "0.0.0.0:8000"]
```

#### 数据库连接池优化

```python
# backend/database.py
class Database:
    def __init__(self):
        self.connection_string = "..."
        self._pool_size = 20  # 连接池大小
        self._max_overflow = 10  # 超出连接池的最大连接数
```

#### 添加缓存层（可选）

```yaml
# docker-compose.yml 添加 Redis
services:
  redis:
    image: redis:7-alpine
    container_name: bps_redis
    restart: unless-stopped
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    networks:
      - bps_network
    deploy:
      resources:
        limits:
          cpus: '0.5'
          memory: 256M

volumes:
  redis_data:
```

```python
# backend/cache.py
import redis
from functools import wraps
import json

redis_client = redis.Redis(host='redis', port=6379, db=0, decode_responses=True)

def cache_result(expire=300):
    def decorator(func):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            cache_key = f"{func.__name__}:{str(args)}:{str(kwargs)}"
            
            # 尝试从缓存读取
            cached = redis_client.get(cache_key)
            if cached:
                return json.loads(cached)
            
            # 执行函数
            result = await func(*args, **kwargs)
            
            # 存入缓存
            redis_client.setex(cache_key, expire, json.dumps(result))
            return result
        return wrapper
    return decorator

# 使用示例
@router.get("/employees")
@cache_result(expire=600)  # 缓存 10 分钟
async def get_employees():
    # ...
```

### 2. 前端优化

#### 构建优化

```javascript
// vite.config.ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { visualizer } from 'rollup-plugin-visualizer'

export default defineConfig({
  plugins: [
    react(),
    visualizer({ open: true })  // 分析包大小
  ],
  build: {
    target: 'es2015',
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,  // 移除 console.log
        drop_debugger: true
      }
    },
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor': ['react', 'react-dom', 'react-router-dom'],
          'ui': ['@headlessui/react', 'lucide-react'],
          'query': ['@tanstack/react-query'],
          'charts': ['recharts']
        }
      }
    },
    chunkSizeWarningLimit: 1000
  }
})
```

#### Nginx Gzip 压缩

```nginx
# nginx.conf 添加
http {
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_comp_level 6;
    gzip_types
        text/plain
        text/css
        text/xml
        text/javascript
        application/json
        application/javascript
        application/xml+rss
        application/rss+xml
        font/truetype
        font/opentype
        application/vnd.ms-fontobject
        image/svg+xml;
}
```

### 3. 数据库查询优化

```sql
-- 在 SQL Server 上创建必要的索引
USE DCCT_BPS_Debug;

-- 任务查询优化
CREATE INDEX idx_tasks_status_requester 
ON dbo.tasks(status, requester_id) 
INCLUDE (task_name, created_at);

-- 匹配历史查询优化（如果改用 source 字段）
CREATE INDEX idx_tasks_source ON dbo.tasks(source);

-- 员工查询优化
CREATE INDEX idx_employees_department 
ON dbo.employees(department_id) 
INCLUDE (name, employee_id);

-- 能力评估查询优化
CREATE INDEX idx_assessments_employee 
ON dbo.competency_assessments(employee_id) 
INCLUDE (skill_id, current_level, target_level);
```

---

## 监控与维护

### 1. 设置日志轮转

```bash
# /etc/logrotate.d/bps
/home/$USER/BPS_20251219/logs/*.log {
    daily
    rotate 14
    compress
    delaycompress
    missingok
    notifempty
    create 0644 $USER $USER
    sharedscripts
    postrotate
        docker-compose -f /home/$USER/BPS_20251219/docker-compose.yml restart backend
    endscript
}
```

### 2. 监控脚本

```bash
# monitor.sh
#!/bin/bash

COMPOSE_FILE="/home/$USER/BPS_20251219/docker-compose.yml"
LOG_FILE="/home/$USER/BPS_20251219/logs/monitor.log"

echo "[$(date)] 开始健康检查" >> $LOG_FILE

# 检查容器状态
if ! docker-compose -f $COMPOSE_FILE ps | grep -q "Up"; then
    echo "[$(date)] ❌ 容器异常，尝试重启" >> $LOG_FILE
    docker-compose -f $COMPOSE_FILE restart
fi

# 检查 API 健康
if ! curl -f http://localhost/api/health > /dev/null 2>&1; then
    echo "[$(date)] ❌ API 健康检查失败" >> $LOG_FILE
    docker-compose -f $COMPOSE_FILE restart backend
fi

# 检查磁盘空间
DISK_USAGE=$(df -h / | awk 'NR==2 {print $5}' | sed 's/%//')
if [ $DISK_USAGE -gt 85 ]; then
    echo "[$(date)] ⚠️ 磁盘空间不足: ${DISK_USAGE}%" >> $LOG_FILE
fi

# 检查内存使用
MEM_USAGE=$(free | awk 'NR==2 {printf "%.0f", $3/$2 * 100}')
if [ $MEM_USAGE -gt 85 ]; then
    echo "[$(date)] ⚠️ 内存使用过高: ${MEM_USAGE}%" >> $LOG_FILE
fi

echo "[$(date)] ✅ 健康检查完成" >> $LOG_FILE
```

```bash
# 设置定时任务
crontab -e

# 每 5 分钟检查一次
*/5 * * * * /home/$USER/BPS_20251219/monitor.sh
```

### 3. 系统监控工具

```bash
# 安装 Prometheus + Grafana（可选）
# docker-compose.yml 添加
services:
  prometheus:
    image: prom/prometheus:latest
    container_name: bps_prometheus
    ports:
      - "9090:9090"
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml
      - prometheus_data:/prometheus
    networks:
      - bps_network

  grafana:
    image: grafana/grafana:latest
    container_name: bps_grafana
    ports:
      - "3000:3000"
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=admin
    volumes:
      - grafana_data:/var/lib/grafana
    networks:
      - bps_network

volumes:
  prometheus_data:
  grafana_data:
```

---

## 故障排查

### 常见问题

#### 1. 容器无法启动

```bash
# 查看详细日志
docker-compose logs backend
docker-compose logs frontend

# 检查配置文件
docker-compose config

# 进入容器调试
docker-compose exec backend bash
```

#### 2. 数据库连接失败

```bash
# 测试网络连通性
ping 10.88.43.154
telnet 10.88.43.154 1433

# 检查防火墙（SQL Server 端）
# 确保 1433 端口开放

# 验证 ODBC 驱动
docker-compose exec backend odbcinst -q -d
```

#### 3. 性能问题

```bash
# 查看容器资源使用
docker stats

# 查看系统负载
htop
vmstat 1

# 查看网络连接
netstat -antp | grep ESTABLISHED

# 查看数据库慢查询（SQL Server）
# 在 SSMS 中运行:
SELECT TOP 10
    qs.execution_count,
    qs.total_elapsed_time / 1000000 AS total_elapsed_time_seconds,
    qs.total_worker_time / 1000000 AS total_worker_time_seconds,
    SUBSTRING(qt.text, qs.statement_start_offset/2 + 1,
        (CASE WHEN qs.statement_end_offset = -1
            THEN LEN(CONVERT(nvarchar(max), qt.text)) * 2
            ELSE qs.statement_end_offset
        END - qs.statement_start_offset)/2) AS query_text
FROM sys.dm_exec_query_stats qs
CROSS APPLY sys.dm_exec_sql_text(qs.sql_handle) qt
ORDER BY qs.total_elapsed_time DESC;
```

#### 4. 前端 404 错误

```bash
# 检查 Nginx 配置
docker-compose exec frontend cat /etc/nginx/conf.d/default.conf

# 检查静态文件是否存在
docker-compose exec frontend ls -la /usr/share/nginx/html

# 重新构建前端
docker-compose build frontend
docker-compose up -d frontend
```

---

## 备份与恢复

### 自动备份脚本

```bash
# backup.sh
#!/bin/bash

BACKUP_DIR="/home/$USER/BPS_20251219/backups"
DATE=$(date +%Y%m%d_%H%M%S)

mkdir -p $BACKUP_DIR

# 1. 备份代码
cd /home/$USER/BPS_20251219
tar -czf $BACKUP_DIR/code_$DATE.tar.gz \
    --exclude=node_modules \
    --exclude=dist \
    --exclude=logs \
    --exclude=.git \
    .

# 2. 备份 Docker 镜像（可选）
docker save bps_backend:latest | gzip > $BACKUP_DIR/backend_image_$DATE.tar.gz
docker save bps_frontend:latest | gzip > $BACKUP_DIR/frontend_image_$DATE.tar.gz

# 3. 清理旧备份（保留最近 7 天）
find $BACKUP_DIR -name "*.tar.gz" -mtime +7 -delete

echo "✅ 备份完成: $DATE"
```

```bash
# 设置每日备份
crontab -e
0 2 * * * /home/$USER/BPS_20251219/backup.sh
```

---

## 总结：部署检查清单

### 部署前（准备阶段）

- [ ] Jetson 硬件确认（推荐 Orin NX 16GB）
- [ ] 系统更新和必要软件安装（Docker, Nginx）
- [ ] 网络配置（静态 IP，防火墙规则）
- [ ] SSL 证书准备
- [ ] SQL Server 连接测试
- [ ] 代码克隆和环境变量配置

### 部署中（执行阶段）

- [ ] Dockerfile 创建
- [ ] docker-compose.yml 配置
- [ ] Nginx 反向代理配置
- [ ] 前端生产构建（npm run build）
- [ ] Docker 镜像构建
- [ ] 容器启动和健康检查

### 部署后（验证阶段）

- [ ] 容器状态检查（docker ps）
- [ ] API 健康检查（/api/health）
- [ ] 前端访问测试
- [ ] 数据库连接验证
- [ ] 多用户并发测试（工具: Apache Bench, JMeter）
- [ ] 日志轮转配置
- [ ] 监控脚本设置
- [ ] 备份计划执行

### 性能测试

```bash
# 使用 Apache Bench 测试并发
# 安装
sudo apt install apache2-utils

# 测试 API 端点（50 并发，1000 请求）
ab -n 1000 -c 50 http://192.168.1.100/api/health

# 预期结果:
# - Time per request: < 100ms (平均)
# - Failed requests: 0
# - Requests per second: > 500
```

---

## 联系支持

如遇到部署问题，请提供以下信息：

1. Jetson 型号和系统版本
2. Docker 和 Docker Compose 版本
3. 错误日志（`docker-compose logs`）
4. 网络拓扑图
5. 系统资源使用情况（`htop`, `docker stats`）

**祝部署顺利！🚀**
