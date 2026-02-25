# BPS Jetson 部署检查清单

部署前请逐项确认，确保顺利部署。

## ✅ 部署前准备（在 Jetson 上执行）

### 硬件要求
- [ ] **Jetson 型号**: 
  - ✅ 推荐: Orin NX 16GB / Orin Nano 8GB / Xavier NX
  - ⚠️ 最低: Nano 4GB（性能有限，建议 < 20 用户）
- [ ] **存储空间**: 至少 20GB 可用空间 (`df -h /`)
- [ ] **内存**: 至少 4GB 可用 (`free -h`)
- [ ] **网络**: 千兆以太网（推荐）或 WiFi

### 网络配置
- [ ] **固定 IP 地址**: `10.70.80.183` 已配置
  ```bash
  # 验证命令
  ip addr show | grep 10.70.80.183
  ```
- [ ] **网关可达**: 能访问互联网（用于下载 Docker 镜像）
  ```bash
  ping -c 3 8.8.8.8
  ```
- [ ] **SQL Server 可达**: 能 ping 通数据库服务器
  ```bash
  ping -c 3 10.88.43.154
  ```

### 软件环境
- [ ] **操作系统**: Ubuntu 18.04/20.04 或 JetPack 4.x/5.x
  ```bash
  lsb_release -a
  ```
- [ ] **Docker 已安装**: 版本 >= 19.03
  ```bash
  docker --version
  ```
- [ ] **Docker Compose 已安装**: 版本 >= 1.27
  ```bash
  docker-compose --version
  ```
- [ ] **Git 已安装**:
  ```bash
  git --version
  ```

### 权限验证
- [ ] **当前用户在 docker 组**:
  ```bash
  groups | grep docker
  # 如果没有，运行: sudo usermod -aG docker $USER
  ```
- [ ] **可以运行 Docker 命令**:
  ```bash
  docker ps  # 不需要 sudo
  ```

---

## ✅ SQL Server 端准备（在 10.88.43.154 上执行）

### 网络配置
- [ ] **TCP/IP 协议已启用**:
  - 打开 "SQL Server Configuration Manager"
  - "SQL Server Network Configuration" → "Protocols for MSSQLSERVER"
  - 右键 "TCP/IP" → "Properties" → "Enabled" = Yes
  - 重启 SQL Server 服务

- [ ] **端口 1433 监听**:
  ```powershell
  # PowerShell
  netstat -ano | findstr :1433
  ```

### 防火墙配置
- [ ] **已添加防火墙规则**:
  ```powershell
  # PowerShell (管理员)
  New-NetFirewallRule -DisplayName "SQL Server for Jetson" `
    -Direction Inbound `
    -Protocol TCP `
    -LocalPort 1433 `
    -Action Allow `
    -RemoteAddress 10.70.80.183
  
  # 验证规则
  Get-NetFirewallRule | Where-Object {$_.DisplayName -like "*SQL*"} | 
    Format-Table DisplayName, Direction, Action, Enabled
  ```

### 数据库验证
- [ ] **数据库存在**: `DCCT_BPS_Debug`
  ```sql
  -- SSMS 查询
  SELECT name FROM sys.databases WHERE name = 'DCCT_BPS_Debug'
  ```

- [ ] **用户权限正确**: `TEST` 用户有读写权限
  ```sql
  -- SSMS 查询
  USE DCCT_BPS_Debug;
  SELECT 
    dp.name AS username,
    dp.type_desc,
    o.name AS table_name,
    p.permission_name
  FROM sys.database_principals dp
  LEFT JOIN sys.database_permissions p ON dp.principal_id = p.grantee_principal_id
  LEFT JOIN sys.objects o ON p.major_id = o.object_id
  WHERE dp.name = 'TEST'
  ORDER BY table_name;
  ```

- [ ] **关键表存在**:
  ```sql
  -- SSMS 查询
  SELECT TABLE_NAME 
  FROM INFORMATION_SCHEMA.TABLES 
  WHERE TABLE_TYPE = 'BASE TABLE'
    AND TABLE_NAME IN ('users', 'departments', 'employees', 'skills', 'competency_assessments', 'tasks')
  ORDER BY TABLE_NAME;
  -- 应返回 6 行
  ```

### 身份验证模式
- [ ] **混合身份验证模式**:
  - SSMS → 右键服务器 → "Properties" → "Security"
  - "Server authentication" = "SQL Server and Windows Authentication mode"
  - 修改后需重启 SQL Server 服务

---

## ✅ 连接测试（在 Jetson 上执行）

运行自动化测试脚本：

```bash
cd ~/BPS_20251219
bash test_connection.sh
```

### 测试项目
- [ ] **网络可达**: ping 10.88.43.154 成功
- [ ] **端口开放**: telnet/nc 测试 1433 端口成功
- [ ] **ODBC 驱动**: `odbcinst -q -d` 显示 SQL Server 驱动
- [ ] **Python 连接**: pyodbc 连接测试成功
- [ ] **数据查询**: 能查询 departments 表

### 预期输出
```
==========================================
🎉 连接测试完成！
==========================================

测试结果摘要:
  ✅ 网络连通: 正常
  ✅ 端口 1433: 可访问
  ✅ ODBC 驱动: 已安装
  ✅ 数据库连接: 成功
```

**如果测试失败，请先解决问题再继续部署！**

---

## ✅ 部署执行（在 Jetson 上执行）

### 方式一: 一键部署（推荐新手）

```bash
cd ~/BPS_20251219
bash deploy.sh
```

- [ ] **构建成功**: 看到 "Successfully built" 和 "Successfully tagged"
- [ ] **容器启动**: `docker-compose ps` 显示两个容器 "Up"
- [ ] **健康检查**: `curl http://localhost/api/health` 返回 `{"status":"healthy"}`

### 方式二: 手动部署（推荐有经验用户）

按照 `QUICKSTART_JETSON.md` 的 5 步流程逐步执行。

---

## ✅ 部署验证

### 容器状态
- [ ] **后端容器运行**:
  ```bash
  docker inspect -f '{{.State.Running}}' bps_backend
  # 应返回: true
  ```

- [ ] **前端容器运行**:
  ```bash
  docker inspect -f '{{.State.Running}}' bps_frontend
  # 应返回: true
  ```

### API 测试
- [ ] **健康检查**:
  ```bash
  curl http://localhost/api/health
  # 应返回: {"status":"healthy"}
  ```

- [ ] **数据库连接测试**:
  ```bash
  curl http://localhost/api/departments
  # 应返回部门列表 JSON
  ```

### 浏览器访问
- [ ] **本地访问**: 在 Jetson 上打开浏览器访问 `http://localhost`
- [ ] **远程访问**: 在其他电脑上访问 `http://10.70.80.183`
- [ ] **登录页面显示**: 看到 BPS 系统登录界面
- [ ] **可以登录**: 使用测试账号登录成功

### 监控面板
- [ ] **运行监控脚本**:
  ```bash
  bash monitor.sh
  ```
  确认所有检查项为绿色 ✅

---

## ✅ 性能测试（可选）

### 并发测试
```bash
# 安装测试工具
sudo apt install apache2-utils -y

# 测试 50 并发
ab -n 1000 -c 50 http://10.70.80.183/api/health
```

- [ ] **吞吐量**: Requests per second >= 500
- [ ] **响应时间**: Time per request < 100ms
- [ ] **失败率**: Failed requests = 0

### 资源使用
```bash
docker stats --no-stream
```

- [ ] **后端 CPU**: < 50%
- [ ] **后端内存**: < 1.5GB
- [ ] **前端 CPU**: < 10%
- [ ] **前端内存**: < 300MB

---

## ✅ 安全加固（生产环境必做）

### JWT 密钥
- [ ] **.env 中的 JWT_SECRET_KEY 已修改**（不是默认值）
  ```bash
  grep JWT_SECRET_KEY .env
  # 不应该是 "your-secret-key-change-this-in-production"
  ```

### HTTPS 配置
- [ ] **生成 SSL 证书**:
  ```bash
  sudo mkdir -p /etc/nginx/ssl
  sudo openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
    -keyout /etc/nginx/ssl/bps.key \
    -out /etc/nginx/ssl/bps.crt \
    -subj "/CN=10.70.80.183"
  ```

- [ ] **更新 nginx.conf** 添加 HTTPS 监听（参考完整部署指南）

### 防火墙
- [ ] **Jetson 防火墙配置**:
  ```bash
  # 仅允许内网访问
  sudo ufw allow from 10.70.80.0/24 to any port 80
  sudo ufw allow from 10.70.80.0/24 to any port 443
  sudo ufw enable
  ```

### 日志轮转
- [ ] **配置 logrotate**:
  ```bash
  sudo nano /etc/logrotate.d/bps
  ```
  添加内容（见 `QUICKSTART_JETSON.md` 生产环境加固章节）

### 自动重启
- [ ] **创建 systemd 服务**:
  ```bash
  sudo nano /etc/systemd/system/bps.service
  ```
  添加内容并启用服务（见 `QUICKSTART_JETSON.md`）

---

## ✅ 备份计划（推荐）

### 数据库备份
- [ ] **在 SQL Server 端配置自动备份计划**
  - SQL Server Management Studio
  - 右键数据库 → Tasks → Back Up
  - 设置定时任务（每天凌晨 2 点）

### 配置备份
- [ ] **备份 .env 文件**:
  ```bash
  cp .env .env.backup
  ```

### Docker 镜像备份
- [ ] **导出镜像**（可选）:
  ```bash
  docker save bps_20251219_backend > bps_backend.tar
  docker save bps_20251219_frontend > bps_frontend.tar
  ```

---

## ✅ 文档交接

### 提供给运维团队
- [ ] **部署文档**: `QUICKSTART_JETSON.md`
- [ ] **脚本说明**: `SCRIPTS_README.md`
- [ ] **监控命令**: `bash monitor.sh --watch`
- [ ] **故障排查**: 文档中的"故障排查"章节
- [ ] **联系方式**: 留下技术支持联系方式

### 提供给用户
- [ ] **访问地址**: http://10.70.80.183
- [ ] **用户手册**: `ADMIN_PERMISSION_USAGE_GUIDE.md`（管理员）
- [ ] **功能指南**: `TASK_ASSIGNMENT_WORKFLOW_ANALYSIS.md`（任务流程）
- [ ] **导入指南**: `EXCEL_IMPORT_GUIDE.md`（数据导入）

---

## 📋 部署信息记录

完成部署后，请填写以下信息：

```
部署日期: _______________
部署人员: _______________
Jetson 型号: _______________
Jetson IP: 10.70.80.183
SQL Server IP: 10.88.43.154
数据库名: DCCT_BPS_Debug

Docker 版本: _______________
Docker Compose 版本: _______________

预期用户数: ~50 人
实际测试并发: _______________
吞吐量: _______________ req/s

备注:
_______________________________________________
_______________________________________________
_______________________________________________
```

---

## 🎯 常见问题

### Q1: deploy.sh 卡在构建镜像步骤
**A**: 正常现象，首次构建需要 5-10 分钟。可以运行 `docker-compose build` 查看详细进度。

### Q2: 浏览器显示 502 Bad Gateway
**A**: 后端容器未启动或数据库连接失败。运行 `docker-compose logs backend` 查看错误。

### Q3: 登录后白屏
**A**: 前端路由问题或 API 调用失败。按 F12 查看浏览器 Console 错误。

### Q4: 性能达不到 500 req/s
**A**: 
1. 检查 Jetson CPU 使用率 (`htop`)
2. 增加 Gunicorn worker 数量（编辑 backend/Dockerfile）
3. 确认数据库服务器负载正常

### Q5: 如何回滚到之前版本？
**A**:
```bash
docker-compose down
git checkout <previous_commit>
bash deploy.sh
```

---

## ✅ 最终确认

部署完成后，请确认以下所有项：

- [ ] ✅ 所有容器运行正常（`docker-compose ps`）
- [ ] ✅ API 健康检查通过（`curl http://localhost/api/health`）
- [ ] ✅ 浏览器可访问登录页面（http://10.70.80.183）
- [ ] ✅ 可以成功登录系统
- [ ] ✅ 可以查看部门/员工/能力数据
- [ ] ✅ 可以创建任务/提交审批
- [ ] ✅ 监控脚本显示所有指标正常（`bash monitor.sh`）
- [ ] ✅ 已配置生产环境安全加固（HTTPS/防火墙/日志轮转）
- [ ] ✅ 已向用户提供访问地址和使用手册
- [ ] ✅ 已向运维团队交接部署文档

**全部完成后，部署即可投入生产使用！** 🎉
