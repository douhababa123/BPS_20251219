# BPS 系统部署启动指南

> **目标**: 让您快速了解部署流程并选择最适合的方式

## 📋 部署前检查清单

在开始之前，请确认：

- [ ]  ✅ **Jetson 已准备好** (IP: 10.70.80.183)

  - 已安装 Ubuntu 18.04/20.04
  - 已安装 Docker 和 Docker Compose
  - 网络连接正常（能访问 SQL Server 10.88.43.154）
- [ ]  ✅ **SQL Server 已准备好** (IP: 10.88.43.154)

  - 数据库 `DCCT_BPS_Debug` 已创建
  - 已导入 `SQLSERVER_SCHEMA.sql` 的表结构
  - 防火墙已开放 1433 端口
- [ ]  ✅ **Windows 开发环境正常**

  - Git 已安装
  - 可以 SSH 到 Jetson: `ssh user@10.70.80.183`

---

## 🎯 部署方案选择

根据您的需求，我们提供 **2 种部署方案**：

### 方案对比


| 特性             | 方案 A: 快速手动部署 | 方案 B: CI/CD 自动化部署 |
| ---------------- | -------------------- | ------------------------ |
| **首次部署时间** | 30 分钟              | 40 分钟（含配置 CI/CD）  |
| **后续更新时间** | 20-30 分钟           | 2 分钟（自动化）         |
| **技术难度**     | 简单                 | 中等                     |
| **适用场景**     | 一次性部署或偶尔更新 | 频繁迭代开发             |
| **推荐度**       | ⭐⭐⭐               | ⭐⭐⭐⭐⭐               |

### 我的推荐

#### 🚀 如果您是初次部署：

**推荐: 先用方案 A 快速部署，让系统跑起来**

理由：

1. 快速验证环境是否正常
2. 先让系统运行起来，确保业务可用
3. 稍后随时可以配置 CI/CD（不影响已部署的系统）

#### 🔄 如果您计划频繁更新功能：

**推荐: 直接用方案 B 配置 CI/CD**

理由：

1. 一次配置，长期受益
2. 节省后续每次更新的 20+ 分钟
3. 减少人为错误，提高稳定性

---

## 📦 方案 A: 快速手动部署（推荐新手）

### 总流程（30 分钟）

```
Windows 电脑准备 (5 分钟)
    ↓
传输文件到 Jetson (3 分钟)
    ↓
Jetson 上配置环境 (10 分钟)
    ↓
启动服务 (5 分钟)
    ↓
验证部署 (5 分钟)
    ↓
完成！系统运行
```

### 详细步骤

#### 步骤 1: Windows 电脑准备 (5 分钟)

```powershell
# 1.1 打开 PowerShell，进入项目目录
cd C:\Users\DOC2CHZ\Software\BPS_20251219

# 1.2 确保代码是最新的
git status
git add .
git commit -m "feat: ready for production deployment"
git push origin DEV

# 1.3 检查配置文件
# 确认 backend/config.py 中的数据库配置正确
# DATABASE_SERVER = "10.88.43.154"
# DATABASE_NAME = "DCCT_BPS_Debug"
```

#### 步骤 2: 传输文件到 Jetson (3 分钟)

**方法 1: 使用 Git（推荐）**

```bash
# 在 Jetson 上执行
ssh user@10.70.80.183

# 克隆代码
cd ~
git clone https://github.com/douhababa123/BPS_20251219.git
cd BPS_20251219
git checkout DEV
```

**方法 2: 使用 SCP**

```powershell
# 在 Windows PowerShell 上执行
scp -r C:\Users\DOC2CHZ\Software\BPS_20251219 user@10.70.80.183:~/
```

#### 步骤 3: Jetson 上配置环境 (10 分钟)

```bash
# SSH 连接到 Jetson
ssh user@10.70.80.183

# 进入项目目录
cd ~/BPS_20251219

# 执行部署脚本（这会自动完成所有配置）
bash deploy.sh

# 脚本会自动：
# - 检查 Docker 和 Docker Compose
# - 创建必要的目录和配置文件
# - 配置数据库连接
# - 构建 Docker 镜像
# - 启动服务
```

#### 步骤 4: 验证部署 (5 分钟)

```bash
# 检查服务状态
docker-compose ps

# 应该看到 3 个容器都是 Up 状态：
# - bps-frontend (端口 80)
# - bps-backend (端口 8000)
# - nginx (端口 80)

# 查看日志
docker-compose logs -f

# 测试后端 API
curl http://localhost:8000/api/health

# 测试前端
curl http://localhost
```

#### 步骤 5: 在 Windows 浏览器访问

```
http://10.70.80.183
```

应该看到 BPS 登录页面！

### 如果遇到问题

参考详细的故障排除指南：

- **部署失败**: 查看 `QUICKSTART_JETSON.md` 第 9 节
- **数据库连接失败**: 查看 `DEPLOYMENT_TROUBLESHOOTING.md` 第 2 节
- **Docker 问题**: 查看 `DEPLOYMENT_TROUBLESHOOTING.md` 第 3 节

---

## 🤖 方案 B: CI/CD 自动化部署（推荐频繁更新）

### 总流程（40 分钟首次，之后仅 2 分钟）

```
配置 GitHub Secrets (5 分钟)
    ↓
配置 Jetson SSH (5 分钟)
    ↓
首次手动部署 (20 分钟，使用方案 A)
    ↓
提交 CI/CD 配置 (5 分钟)
    ↓
验证自动部署 (5 分钟)
    ↓
完成！后续只需 git push
```

### 详细步骤

#### 步骤 1: 首次手动部署

**重要**: 必须先完成方案 A 的手动部署，确保 Jetson 环境正常运行

```bash
# 按照方案 A 的步骤 1-5 完成首次部署
# 确保系统能正常访问 http://10.70.80.183
```

#### 步骤 2: 配置 Jetson SSH 密钥 (5 分钟)

```bash
# SSH 到 Jetson
ssh user@10.70.80.183

# 生成 SSH 密钥（用于 GitHub Actions 连接）
ssh-keygen -t rsa -b 4096 -f ~/.ssh/github_actions_key -N ""

# 添加公钥到授权列表
cat ~/.ssh/github_actions_key.pub >> ~/.ssh/authorized_keys

# 显示私钥（下一步需要）
cat ~/.ssh/github_actions_key

# ⚠️ 复制完整输出（包括 BEGIN 和 END 行）
```

#### 步骤 3: 配置 GitHub Secrets (5 分钟)

```
1. 打开浏览器访问:
   https://github.com/douhababa123/BPS_20251219/settings/secrets/actions

2. 点击 "New repository secret" 添加 3 个密钥:

   ┌─────────────────────┬──────────────────────┬──────────────────┐
   │ Secret 名称          │ 值                   │ 说明              │
   ├─────────────────────┼──────────────────────┼──────────────────┤
   │ JETSON_HOST         │ 10.70.80.183         │ Jetson IP 地址   │
   │ JETSON_USER         │ your_username        │ 你的 SSH 用户名   │
   │ JETSON_SSH_KEY      │ -----BEGIN RSA...    │ 步骤 2 复制的私钥 │
   └─────────────────────┴──────────────────────┴──────────────────┘

3. 每个 Secret 添加后点击 "Add secret"
```

#### 步骤 4: 提交 CI/CD 配置 (5 分钟)

```powershell
# 在 Windows PowerShell 执行
cd C:\Users\DOC2CHZ\Software\BPS_20251219

# 确认 CI/CD 配置文件存在
ls .github/workflows/jetson-deploy.yml

# 提交配置
git add .github/workflows/
git add update.sh
git add CI_CD_*.md
git commit -m "feat: add CI/CD automation"
git push origin DEV

# 🎉 推送后，GitHub Actions 会自动触发部署！
```

#### 步骤 5: 验证自动部署 (5 分钟)

```
1. 打开 GitHub Actions 页面查看部署进度:
   https://github.com/douhababa123/BPS_20251219/actions

2. 你会看到一个新的 workflow run 正在执行:
   - ✅ Test (2-3 分钟): 代码检查
   - ✅ Build (3-5 分钟): 构建 Docker 镜像
   - ✅ Deploy (3-5 分钟): 部署到 Jetson
   - ✅ Health Check: 验证部署成功

3. 全部完成后（约 10 分钟），访问:
   http://10.70.80.183

4. 应该看到最新版本的系统！
```

#### 步骤 6: 测试自动化流程

```powershell
# 在 Windows 上做一个小改动测试
cd C:\Users\DOC2CHZ\Software\BPS_20251219

# 修改任意文件（例如添加注释）
echo "# Test CI/CD" >> README.md

# 提交并推送
git add .
git commit -m "test: verify CI/CD pipeline"
git push origin DEV

# 🎉 几分钟后，更改会自动部署到 Jetson！
```

---

## 📊 后续使用对比

### 方案 A: 手动更新（每次 20-30 分钟）

```powershell
# Windows 上开发完成
git push origin DEV

# SSH 到 Jetson
ssh user@10.70.80.183
cd ~/BPS_20251219

# 手动更新
git pull
docker-compose down
docker-compose build  # 等待 5-10 分钟
docker-compose up -d

# 验证
curl http://localhost/api/health
```

### 方案 B: 自动更新（仅需 2 分钟）

```powershell
# Windows 上开发完成
git push origin DEV

# 完成！剩下的全自动
# 5-10 分钟后收到部署成功通知
```

---

## 🎯 我的具体建议

### 针对您的情况

**现在立即执行**:

```powershell
# 步骤 1: 在 Windows 上准备代码
cd C:\Users\DOC2CHZ\Software\BPS_20251219
git status

# 步骤 2: SSH 到 Jetson
ssh user@10.70.80.183

# 步骤 3: 在 Jetson 上克隆代码
cd ~
git clone https://github.com/douhababa123/BPS_20251219.git
cd BPS_20251219
git checkout DEV

# 步骤 4: 执行快速部署
bash deploy.sh

# 步骤 5: 验证（5 分钟后）
curl http://localhost/api/health

# 步骤 6: 在 Windows 浏览器访问
# http://10.70.80.183
```

**30 分钟后，系统应该运行起来了！**

### 之后可选执行（配置 CI/CD）

等系统稳定运行后，按照 `CI_CD_QUICKSTART.md` 配置自动化部署：

```bash
# 参考文档
cat CI_CD_QUICKSTART.md

# 10 分钟配置，后续每次更新只需 git push
```

---

## 📚 相关文档索引

### 快速开始

- **[QUICKSTART_JETSON.md](QUICKSTART_JETSON.md)** - Jetson 部署详细步骤（30 分钟）
- **[CI_CD_QUICKSTART.md](CI_CD_QUICKSTART.md)** - CI/CD 配置快速指南（10 分钟）
- **[CI_CD_EXPLAINED.md](CI_CD_EXPLAINED.md)** - CI/CD 概念详解

### 完整文档

- **[DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md)** - 完整部署指南（所有细节）
- **[CI_CD_GUIDE.md](CI_CD_GUIDE.md)** - CI/CD 完整技术文档

### 故障排除

- **[DEPLOYMENT_TROUBLESHOOTING.md](DEPLOYMENT_TROUBLESHOOTING.md)** - 部署问题解决
- **[DEPLOYMENT_CHECKLIST.md](DEPLOYMENT_CHECKLIST.md)** - 部署检查清单

### 脚本文件

- **[deploy.sh](deploy.sh)** - 首次部署脚本
- **[update.sh](update.sh)** - 更新部署脚本（含蓝绿部署）
- **[monitor.sh](monitor.sh)** - 监控脚本

---

## ❓ 常见问题

### Q1: 我应该选择哪个方案？

**A**:

- **新手 / 不确定**: 选方案 A（快速手动部署）
- **已有经验 / 频繁更新**: 选方案 B（CI/CD 自动化）
- **最佳实践**: 先用方案 A 部署，稳定后配置方案 B

### Q2: 两个方案可以切换吗？

**A**:

- 可以！先用方案 A 手动部署，后续随时可以配置 CI/CD
- 配置 CI/CD 不会影响已部署的系统
- CI/CD 配置后，仍然可以手动执行 `bash update.sh`

### Q3: deploy.sh 和 update.sh 有什么区别？

**A**:

- `deploy.sh`: 首次部署用（创建环境、初始化配置）
- `update.sh`: 后续更新用（蓝绿部署、自动备份、自动回滚）

### Q4: 如果部署失败怎么办？

**A**:

1. 查看错误日志: `docker-compose logs`
2. 参考故障排除文档: `DEPLOYMENT_TROUBLESHOOTING.md`
3. 使用诊断脚本: `bash diagnose.sh`

### Q5: 需要在 Jetson 上安装什么软件？

**A**:

- Docker (20.10+)
- Docker Compose (1.29+)
- Git
- Bash (Ubuntu 默认有)

详细安装指南参考: `QUICKSTART_JETSON.md` 第 2 节

---

## ✅ 下一步行动

### 立即开始（推荐）

1. **阅读**: [QUICKSTART_JETSON.md](QUICKSTART_JETSON.md) 前 3 节（5 分钟）
2. **检查**: Jetson 和 SQL Server 环境（5 分钟）
3. **执行**: 运行 `bash deploy.sh`（20 分钟）
4. **验证**: 访问 `http://10.70.80.183`（2 分钟）

### 配置 CI/CD（可选）

1. **阅读**: [CI_CD_EXPLAINED.md](CI_CD_EXPLAINED.md)（10 分钟）
2. **配置**: [CI_CD_QUICKSTART.md](CI_CD_QUICKSTART.md)（10 分钟）
3. **测试**: 提交代码验证自动部署（5 分钟）

---

## 📞 需要帮助？

如果在部署过程中遇到问题：

1. **检查日志**: `docker-compose logs -f`
2. **运行诊断**: `bash diagnose.sh`
3. **查看文档**: `DEPLOYMENT_TROUBLESHOOTING.md`
4. **查看错误码**: 参考各文档的"常见问题"章节

---

**祝部署顺利！🚀**

[部署到 Jetson](https://github.com/douhababa123/BPS_20251219/actions/runs/22390243062/job/64810267261#logs)

Started 25s **ago**

Evaluating deploy.if

Evaluating: (success() && (((github.event\_name == 'push') && (((needs.test.result == 'success') || (needs.test.result == 'failure'))))))

Expanded: (true && (('push' == 'push') && (('success' == 'success') || (needs.test.result == 'failure'))))

Result: true

Requested labels: self-hosted, linux, arm64

Job defined at: douhababa123/BPS\_20251219/.github/workflows/jetson-deploy.yml@refs/heads/DEV

Waiting for a runner to pick up this job...
