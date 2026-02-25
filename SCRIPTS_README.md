# BPS Jetson 部署脚本说明

本目录包含 3 个自动化脚本，简化 Jetson 部署流程。

## 📋 脚本列表

### 1. `test_connection.sh` - 数据库连接测试

**用途**: 部署前验证 Jetson 到 SQL Server 的连接

**使用**:
```bash
bash test_connection.sh
```

**检查项目**:
- ✅ 网络连通性 (ping 10.88.43.154)
- ✅ SQL Server 端口 1433 可达性
- ✅ ODBC 驱动安装
- ✅ Python pyodbc 连接测试
- ✅ 数据库权限验证

**预期输出**:
```
==========================================
  BPS 数据库连接测试
  目标: 10.88.43.154:1433
==========================================

[1/4] 测试网络连通性...
✅ 网络可达

[2/4] 测试端口 1433...
✅ 端口 1433 开放

[3/4] SQL Server 端防火墙配置检查...
(手动确认)

[4/4] 测试 ODBC 驱动...
✅ 已安装 ODBC 驱动

[5/5] 测试 Python 数据库连接...
✅ 连接成功
   数据库: DCCT_BPS_Debug@10.88.43.154
   departments 表记录数: 5
```

---

### 2. `deploy.sh` - 一键部署脚本

**用途**: 自动化完成所有部署步骤

**使用**:
```bash
# 首次部署
bash deploy.sh

# 如果中途失败，可重新运行（幂等性）
bash deploy.sh
```

**执行流程** (7 个步骤):
1. ✅ 检查 Docker 和 Docker Compose 安装
2. ✅ 测试数据库连接 (ping + telnet 1433)
3. ✅ 配置环境变量 (.env 文件)
4. ✅ 创建 Docker 配置文件 (Dockerfile, docker-compose.yml, nginx.conf)
5. ✅ 构建 Docker 镜像 (5-10 分钟)
6. ✅ 启动容器服务
7. ✅ 验证部署 (健康检查)

**预期输出**:
```
==========================================
🎉 部署完成！
==========================================

访问地址: http://10.70.80.183

常用命令:
  查看日志: docker-compose logs -f
  重启服务: docker-compose restart
  停止服务: docker-compose down
  查看状态: docker-compose ps
```

**生成的文件**:
- `.env` - 环境变量配置
- `backend/Dockerfile` - 后端容器镜像
- `Dockerfile.frontend` - 前端容器镜像
- `nginx.conf` - Nginx 反向代理配置
- `docker-compose.yml` - 容器编排配置
- `build.log` - 构建日志

---

### 3. `monitor.sh` - 系统监控脚本

**用途**: 监控容器状态、资源使用、API 健康

**使用**:
```bash
# 显示一次
bash monitor.sh

# 实时监控（每 10 秒刷新）
bash monitor.sh --watch
```

**监控内容**:
- 🟢 容器状态 (backend / frontend 运行状态)
- 📊 资源使用 (CPU / 内存 / 网络)
- 💻 Jetson 系统资源 (CPU / 内存 / 磁盘 / 温度)
- 🏥 API 健康检查 (本地 + 外部访问)
- 🗄️ 数据库连接状态
- ❌ 最近错误日志

**预期输出**:
```
==========================================
  BPS 系统监控面板
  时间: 2026-02-25 14:30:00
==========================================

【容器状态】
  后端:   ● 运行中  (启动时间: 2026-02-25 09:00:00)
  前端:   ● 运行中  (启动时间: 2026-02-25 09:00:05)

【资源使用】
NAME           CPU %    MEM USAGE / LIMIT     MEM %    NET I/O
bps_backend    15.2%    850 MiB / 2 GiB       41.5%    1.2GB / 850MB
bps_frontend   2.3%     120 MiB / 512 MiB     23.4%    500MB / 1.1GB

【Jetson 系统资源】
  CPU:    35.8%
  内存:   4200 MB / 15800 MB (26.6%)
  磁盘:   45G / 120G (38%)
  温度:   52°C

【API 健康检查】
  本地:   ✅ 正常 (http://localhost/api/health)
  外部:   ✅ 正常 (响应时间: 0.025s)

【数据库连接】
  SQL:    ✅ 可达 (10.88.43.154:1433)

【最近错误日志】
  无错误
```

---

## 🚀 典型部署流程

### 场景 1: 全新部署（推荐）

```bash
# 1. 克隆代码
git clone https://github.com/douhababa123/BPS_20251219.git
cd BPS_20251219
git checkout DEV

# 2. 测试连接
bash test_connection.sh
# 如果失败，先修复网络/防火墙问题

# 3. 一键部署
bash deploy.sh

# 4. 监控系统
bash monitor.sh --watch
```

### 场景 2: 逐步部署（学习目的）

```bash
# 1. 测试连接
bash test_connection.sh

# 2. 手动执行 deploy.sh 的每个步骤
# 参考 QUICKSTART_JETSON.md 的"方式二：手动分步部署"

# 3. 监控验证
bash monitor.sh
```

### 场景 3: 更新现有部署

```bash
# 1. 拉取最新代码
git pull origin DEV

# 2. 重新构建和启动
docker-compose down
docker-compose build
docker-compose up -d

# 3. 验证
bash monitor.sh
```

---

## 🔧 故障排查

### 问题 1: test_connection.sh 报错 "端口 1433 无法访问"

**原因**: SQL Server 防火墙未配置

**解决**: 在 SQL Server (10.88.43.154) 上运行:

```powershell
# PowerShell (管理员)
New-NetFirewallRule -DisplayName "SQL Server for Jetson" `
  -Direction Inbound `
  -Protocol TCP `
  -LocalPort 1433 `
  -Action Allow `
  -RemoteAddress 10.70.80.183

# 验证
Get-NetFirewallRule | Where-Object {$_.DisplayName -like "*SQL*"}
```

### 问题 2: deploy.sh 报错 "Docker 镜像构建失败"

**诊断**:
```bash
# 查看构建日志
cat build.log

# 手动构建查看详细错误
docker-compose build --no-cache
```

**常见原因**:
- 网络问题（无法下载包）→ 配置代理或使用国内镜像源
- 磁盘空间不足 → `df -h` 检查，清理旧镜像 `docker system prune -a`

### 问题 3: monitor.sh 显示 "API 健康检查失败"

**诊断**:
```bash
# 查看后端日志
docker-compose logs backend

# 查看容器状态
docker-compose ps

# 进入容器调试
docker-compose exec backend bash
curl http://localhost:8000/api/health
```

**常见原因**:
- 数据库连接失败 → 检查 .env 配置
- 端口冲突 → `netstat -tunlp | grep 8000`

---

## 📝 配置文件说明

### `.env` - 环境变量

由 `deploy.sh` 自动从 `.env.jetson` 复制生成。

**关键配置**:
```env
DB_SERVER=10.88.43.154        # SQL Server 地址
DB_DATABASE=DCCT_BPS_Debug    # 数据库名
DB_USERNAME=TEST              # 用户名
DB_PASSWORD=123456            # 密码
JWT_SECRET_KEY=<随机生成>     # JWT 密钥（自动生成）
ALLOWED_ORIGINS=http://10.70.80.183  # CORS 白名单
```

### `docker-compose.yml` - 容器编排

定义两个服务:
- **backend**: FastAPI 后端，4 个 Gunicorn worker，限制 3 CPU / 2G 内存
- **frontend**: Nginx 前端，限制 1 CPU / 512M 内存

### `nginx.conf` - 反向代理

配置:
- `/` → 前端静态文件
- `/api/` → 后端 API (http://backend:8000)
- Gzip 压缩
- Keepalive 连接池

---

## 🎯 性能基准

### 测试环境
- **硬件**: Jetson Orin NX 16GB
- **并发**: 50 用户
- **测试工具**: Apache Bench (ab)

### 预期性能
```bash
# 测试命令
ab -n 1000 -c 50 http://10.70.80.183/api/health

# 预期结果
Requests per second:    500-800 req/s
Time per request:       60-100 ms
Failed requests:        0
```

---

## ⚙️ 高级配置

### 调整 Worker 数量（提升性能）

编辑 `backend/Dockerfile`:
```dockerfile
CMD ["gunicorn", "main:app", \
     "--workers", "6", \          # 4 → 6
     "--worker-class", "uvicorn.workers.UvicornWorker", \
     "--bind", "0.0.0.0:8000"]
```

然后重建:
```bash
docker-compose build backend
docker-compose up -d backend
```

### 启用 HTTPS

1. 生成证书:
```bash
sudo openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout /etc/nginx/ssl/bps.key \
  -out /etc/nginx/ssl/bps.crt \
  -subj "/CN=10.70.80.183"
```

2. 修改 `nginx.conf` 添加 HTTPS 监听（参考完整部署指南）

### 添加自动备份

创建定时任务:
```bash
# 编辑 crontab
crontab -e

# 添加每天凌晨 2 点备份
0 2 * * * cd ~/BPS_20251219 && docker-compose exec -T backend python scripts/backup.py
```

---

## 📚 相关文档

- `QUICKSTART_JETSON.md` - 完整部署指南（包含手动步骤）
- `DEPLOYMENT_GUIDE_JETSON.md` - 详细部署文档（架构设计、监控、备份）
- `README.md` - 项目总体说明
- `.github/copilot-instructions.md` - 项目开发规范

---

## 🆘 获取帮助

如果遇到问题：

1. **查看日志**:
   ```bash
   docker-compose logs -f
   bash monitor.sh
   ```

2. **检查状态**:
   ```bash
   bash test_connection.sh
   docker-compose ps
   ```

3. **重新部署**:
   ```bash
   docker-compose down
   bash deploy.sh
   ```

4. **查阅文档**: `QUICKSTART_JETSON.md` 的故障排查章节
