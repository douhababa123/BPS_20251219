# 🚀 BPS Jetson 部署指南集

本目录包含完整的 Jetson 部署文档和自动化脚本。

---

## 📚 快速导航

### 🎯 新手必读（按顺序阅读）

1. **[DEPLOYMENT_CHECKLIST.md](DEPLOYMENT_CHECKLIST.md)** ⭐⭐⭐⭐⭐
   - 📋 部署前检查清单
   - ✅ 逐项确认硬件/软件/网络/数据库
   - 🔒 生产环境安全加固
   - **适用人群**: 所有部署人员必读

2. **[QUICKSTART_JETSON.md](QUICKSTART_JETSON.md)** ⭐⭐⭐⭐⭐
   - ⚡ 30 分钟快速部署
   - 🚀 一键自动化脚本 + 手动分步指南
   - 🔧 故障排查和运维命令
   - **适用人群**: 执行部署的技术人员

3. **[SCRIPTS_README.md](SCRIPTS_README.md)** ⭐⭐⭐⭐
   - 📜 3 个自动化脚本详细说明
   - 🧪 test_connection.sh - 连接测试
   - 🚀 deploy.sh - 一键部署
   - 📊 monitor.sh - 系统监控
   - **适用人群**: 使用脚本的技术人员

4. **[DEPLOYMENT_GUIDE_JETSON.md](DEPLOYMENT_GUIDE_JETSON.md)** ⭐⭐⭐
   - 📖 完整技术文档（800+ 行）
   - 🏗️ 架构设计详解
   - 📈 性能优化和监控
   - 💾 备份恢复策略
   - **适用人群**: 深入了解架构的高级用户

---

## ⚡ 快速开始（3 步）

### 前提条件
- ✅ Jetson 已安装 Docker 和 Docker Compose
- ✅ Jetson 固定 IP 为 `10.70.80.183`
- ✅ SQL Server 在 `10.88.43.154` 可访问

### 部署步骤

```bash
# Step 1: 克隆代码
git clone https://github.com/douhababa123/BPS_20251219.git
cd BPS_20251219
git checkout DEV

# Step 2: 测试连接（重要！）
bash test_connection.sh
# 如果失败，先修复 SQL Server 防火墙

# Step 3: 一键部署
bash deploy.sh

# 完成！浏览器访问
# http://10.70.80.183
```

---

## 📂 文件清单

### 部署文档
| 文件名 | 用途 | 页数 | 重要性 |
|--------|------|------|--------|
| `DEPLOYMENT_CHECKLIST.md` | 部署前检查清单 | 6 页 | ⭐⭐⭐⭐⭐ |
| `QUICKSTART_JETSON.md` | 快速开始指南 | 10 页 | ⭐⭐⭐⭐⭐ |
| `SCRIPTS_README.md` | 脚本使用说明 | 12 页 | ⭐⭐⭐⭐ |
| `DEPLOYMENT_GUIDE_JETSON.md` | 完整部署文档 | 50+ 页 | ⭐⭐⭐ |

### CI/CD 文档（自动化部署）
| 文件名 | 用途 | 页数 | 重要性 |
|--------|------|------|--------|
| `CI_CD_QUICKSTART.md` | CI/CD 快速配置（10分钟） | 5 页 | ⭐⭐⭐⭐⭐ |
| `CI_CD_GUIDE.md` | CI/CD 完整指南 | 30+ 页 | ⭐⭐⭐⭐ |
| `.github/workflows/jetson-deploy.yml` | GitHub Actions 配置 | - | ⭐⭐⭐⭐⭐ |

### 自动化脚本
| 文件名 | 用途 | 预计时间 |
|--------|------|----------|
| `test_connection.sh` | 数据库连接测试 | 1 分钟 |
| `deploy.sh` | 一键自动部署 | 10-15 分钟 |
| `monitor.sh` | 系统监控面板 | 实时 |
| `update.sh` | CI/CD 更新脚本（蓝绿部署） | 5-10 分钟 |

### 配置模板
| 文件名 | 用途 |
|--------|------|
| `.env.jetson` | 环境变量模板（已预填数据库配置） |
| `backend/Dockerfile` | 后端容器镜像定义（自动生成） |
| `Dockerfile.frontend` | 前端容器镜像定义（自动生成） |
| `nginx.conf` | Nginx 反向代理配置（自动生成） |
| `docker-compose.yml` | 容器编排配置（自动生成） |

---

## 🎯 使用场景指南

### 场景 1: 第一次部署（推荐流程）

```
1. 阅读 DEPLOYMENT_CHECKLIST.md（15 分钟）
   └─ 确认所有硬件/软件/网络要求

2. 运行 test_connection.sh（3 分钟）
   └─ 验证到 SQL Server 的连接
   └─ 如果失败，按提示修复 SQL Server 防火墙

3. 阅读 QUICKSTART_JETSON.md 的"方式一"（5 分钟）
   └─ 了解一键部署流程

4. 运行 deploy.sh（10-15 分钟）
   └─ 自动完成所有部署步骤

5. 运行 monitor.sh --watch（持续监控）
   └─ 验证部署成功，监控系统状态

6. 完成 DEPLOYMENT_CHECKLIST.md 的"部署验证"部分
   └─ 浏览器访问测试
   └─ 性能测试
   └─ 安全加固
```

### 场景 2: 配置 CI/CD 自动化（推荐生产环境）

```
1. 阅读 CI_CD_QUICKSTART.md（10 分钟）
   └─ 了解 CI/CD 配置步骤

2. 在 Jetson 上生成 SSH 密钥（2 分钟）
   └─ ssh-keygen -t rsa -b 4096

3. 在 GitHub 配置 Secrets（3 分钟）
   └─ JETSON_HOST, JETSON_USER, JETSON_SSH_KEY

4. 提交 CI/CD 配置文件（2 分钟）
   └─ git push 触发首次自动部署

5. 日常使用（自动化）
   └─ git push → GitHub Actions 自动测试+构建+部署
```

### 场景 3: 学习理解部署过程

```
1. 阅读 QUICKSTART_JETSON.md 的"方式二"
   └─ 手动分步部署（每步都解释为什么）

2. 阅读 SCRIPTS_README.md
   └─ 了解每个脚本做了什么

3. 阅读 DEPLOYMENT_GUIDE_JETSON.md
   └─ 深入理解架构设计和性能优化
```

### 场景 4: 生产环境部署

```
1. 完成 DEPLOYMENT_CHECKLIST.md 的所有检查项

2. 运行 deploy.sh 部署

3. 配置 CI/CD 自动化（CI_CD_QUICKSTART.md）

4. 完成安全加固:
   ├─ 生成 HTTPS 证书
   ├─ 配置防火墙
   ├─ 设置日志轮转
   └─ 配置自动重启

5. 配置备份计划

6. 向运维团队交接文档
```

### 场景 5: 日常功能更新（CI/CD 模式）

```
1. 开发新功能
   └─ git checkout -b feature/new-feature DEV

2. 提交代码
   └─ git push origin DEV

3. 自动部署
   └─ GitHub Actions 自动测试+构建+部署到 Jetson
   └─ 健康检查失败自动回滚

4. 验证
   └─ 浏览器访问 http://10.70.80.183
   └─ bash monitor.sh --watch

5. 如有问题，一键回滚
   └─ bash update.sh --rollback
```

### 场景 6: 故障排查

```
1. 运行 monitor.sh
   └─ 查看实时状态和错误日志

2. 参考 QUICKSTART_JETSON.md 的"故障排查"章节

3. 查看 SCRIPTS_README.md 的"故障排查"部分

4. 如果是数据库连接问题:
   └─ 重新运行 test_connection.sh 诊断
```

### 场景 5: 更新现有部署

```bash
# 1. 拉取最新代码
git pull origin DEV

# 2. 查看变更
git diff HEAD~1

# 3. 重新构建
docker-compose down
docker-compose build
docker-compose up -d

# 4. 验证
bash monitor.sh
```

---

## 🔧 常用命令速查

### 部署相关
```bash
# 测试连接
bash test_connection.sh

# 一键部署
bash deploy.sh

# 手动部署
docker-compose build
docker-compose up -d
```

### 监控相关
```bash
# 显示监控面板
bash monitor.sh

# 实时监控（每 10 秒刷新）
bash monitor.sh --watch

# 查看日志
docker-compose logs -f
docker-compose logs backend
docker-compose logs frontend
```

### 运维相关
```bash
# 重启服务
docker-compose restart

# 停止服务
docker-compose down

# 查看状态
docker-compose ps
docker stats

# 进入容器调试
docker-compose exec backend bash
docker-compose exec frontend sh
```

### 故障排查
```bash
# 测试 API
curl http://localhost/api/health

# 测试数据库连接
docker-compose exec backend python -c "
from database import Database
db = Database()
conn = db.connect()
print('✅ 连接成功')
conn.close()
"

# 查看详细错误
docker-compose logs backend --tail 100
```

---

## 🆘 获取帮助

### 问题分类

| 问题类型 | 查看文档 | 运行命令 |
|---------|---------|---------|
| 部署前准备 | `DEPLOYMENT_CHECKLIST.md` | `bash test_connection.sh` |
| 部署失败 | `QUICKSTART_JETSON.md` 故障排查章节 | `cat build.log` |
| 数据库连接失败 | `SCRIPTS_README.md` 问题 1 | `bash test_connection.sh` |
| 性能问题 | `DEPLOYMENT_GUIDE_JETSON.md` 性能优化章节 | `bash monitor.sh --watch` |
| API 报错 | `QUICKSTART_JETSON.md` 故障排查章节 | `docker-compose logs backend` |

### 常见错误代码

| 错误 | 含义 | 解决方法 |
|------|------|---------|
| `Connection refused (10.88.43.154:1433)` | SQL Server 端口未开放 | 配置 SQL Server 防火墙 |
| `502 Bad Gateway` | 后端容器未启动 | `docker-compose logs backend` |
| `ODBC Driver not found` | ODBC 驱动未安装 | 重新构建镜像 `docker-compose build backend` |
| `Permission denied` | Docker 权限不足 | `sudo usermod -aG docker $USER` 并重新登录 |
| `No space left on device` | 磁盘空间不足 | `docker system prune -a` 清理镜像 |

---

## 📊 部署时间估算

### 完整流程时间线
```
前期准备:       15 分钟  (阅读文档 + 检查清单)
测试连接:        3 分钟  (test_connection.sh)
一键部署:       15 分钟  (deploy.sh，含构建)
验证测试:        5 分钟  (浏览器访问 + 性能测试)
安全加固:       20 分钟  (HTTPS + 防火墙 + 日志轮转)
文档交接:       10 分钟  (准备运维文档)
─────────────────────────
总计:           ~70 分钟  (约 1 小时 10 分钟)
```

### 快速部署（跳过安全加固）
```
测试连接:        3 分钟
一键部署:       15 分钟
验证测试:        5 分钟
─────────────────────────
总计:           ~25 分钟
```

---

## ✅ 成功标准

部署完成后，以下所有项应为 ✅：

```bash
# 运行验证脚本
bash monitor.sh
```

**预期输出**:
```
【容器状态】
  后端:   ● 运行中  ✅
  前端:   ● 运行中  ✅

【API 健康检查】
  本地:   ✅ 正常
  外部:   ✅ 正常

【数据库连接】
  SQL:    ✅ 可达
```

**浏览器访问**: http://10.70.80.183 可正常显示登录页面 ✅

**性能测试**: 50 并发下吞吐量 >= 500 req/s ✅

---

## 📞 技术支持

如果以上文档都无法解决问题，请提供以下信息：

```
1. Jetson 型号: _______________
2. JetPack 版本: _______________
3. 错误现象: _______________
4. 相关日志:
   - build.log
   - docker-compose logs backend
   - bash monitor.sh 输出
5. 已尝试的解决方法: _______________
```

---

## 🔄 版本历史

| 日期 | 版本 | 变更说明 |
|------|------|---------|
| 2026-02-25 | v1.0 | 初始版本，包含完整部署指南和自动化脚本 |

---

## 📄 相关项目文档

- [README.md](README.md) - 项目总体介绍
- [TASK_ASSIGNMENT_WORKFLOW_ANALYSIS.md](TASK_ASSIGNMENT_WORKFLOW_ANALYSIS.md) - 任务分配工作流
- [ADMIN_PERMISSION_USAGE_GUIDE.md](ADMIN_PERMISSION_USAGE_GUIDE.md) - 管理员权限指南
- [EXCEL_IMPORT_GUIDE.md](EXCEL_IMPORT_GUIDE.md) - Excel 导入指南

---

**开始部署**: 请按照 `DEPLOYMENT_CHECKLIST.md` 的步骤逐项确认，然后运行 `bash deploy.sh` 🚀
