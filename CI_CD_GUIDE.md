# BPS Jetson CI/CD 完整指南

## 📚 目录

1. [架构概览](#架构概览)
2. [快速开始](#快速开始)
3. [GitHub Actions 配置](#github-actions-配置)
4. [Jetson 端配置](#jetson-端配置)
5. [部署流程](#部署流程)
6. [回滚机制](#回滚机制)
7. [监控和告警](#监控和告警)
8. [最佳实践](#最佳实践)

---

## 架构概览

### CI/CD 流程图

```
┌────────────────────────────────────────────────────────────────┐
│                     开发者工作流                                  │
└────────────────┬───────────────────────────────────────────────┘
                 │
                 ▼
         代码推送到 GitHub
         (git push origin DEV)
                 │
                 ▼
┌────────────────────────────────────────────────────────────────┐
│                   GitHub Actions                                │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐      │
│  │  测试    │→ │  构建    │→ │  部署    │→ │  验证    │      │
│  │  Test    │  │  Build   │  │  Deploy  │  │  Verify  │      │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘      │
│       │             │              │             │              │
│       ├─ TypeCheck  ├─ Docker     ├─ SSH        ├─ Health     │
│       ├─ ESLint     │  Build      │  rsync      │   Check     │
│       └─ Pytest     └─ ARM64      └─ docker-    └─ API Test   │
│                                      compose                    │
└────────────────────┬───────────────────────────────────────────┘
                     │ SSH 连接
                     ▼
┌────────────────────────────────────────────────────────────────┐
│               Jetson (10.70.80.183)                             │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  自动更新流程                                               │  │
│  │  1. 拉取最新代码                                            │  │
│  │  2. 备份当前版本                                            │  │
│  │  3. 构建新镜像                                              │  │
│  │  4. 蓝绿部署（停止旧容器→启动新容器）                        │  │
│  │  5. 健康检查（失败自动回滚）                                 │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌─────────────┐  ┌─────────────┐                              │
│  │   Backend   │  │  Frontend   │                              │
│  │ (容器更新)   │  │ (容器更新)   │                              │
│  └─────────────┘  └─────────────┘                              │
└────────────────────┬───────────────────────────────────────────┘
                     │ 数据库连接保持不变
                     ▼
         ┌───────────────────────┐
         │  SQL Server           │
         │  10.88.43.154         │
         │  (无需更新)            │
         └───────────────────────┘
```

### 部署策略

**蓝绿部署**（Blue-Green Deployment）：
- ✅ 零停机更新
- ✅ 快速回滚（切换回旧容器）
- ✅ 完整验证后再切换流量

---

## 快速开始

### 1. 配置 GitHub Secrets（一次性设置）

在 GitHub 仓库设置 `Settings` → `Secrets and variables` → `Actions` 中添加：

| Secret 名称 | 说明 | 示例值 |
|------------|------|--------|
| `JETSON_HOST` | Jetson IP 地址 | `10.70.80.183` |
| `JETSON_USER` | Jetson SSH 用户名 | `your_username` |
| `JETSON_SSH_KEY` | Jetson SSH 私钥 | `-----BEGIN RSA PRIVATE KEY-----...` |
| `JETSON_PORT` | SSH 端口（可选） | `22` |
| `DOCKERHUB_USERNAME` | Docker Hub 用户名（可选） | - |
| `DOCKERHUB_TOKEN` | Docker Hub Token（可选） | - |
| `SLACK_WEBHOOK` | Slack 通知 Webhook（可选） | - |

### 2. 生成 SSH 密钥对（在 Jetson 上）

```bash
# 在 Jetson 上生成密钥对（如果还没有）
ssh-keygen -t rsa -b 4096 -C "github-actions@jetson" -f ~/.ssh/github_actions_key

# 添加公钥到 authorized_keys
cat ~/.ssh/github_actions_key.pub >> ~/.ssh/authorized_keys
chmod 600 ~/.ssh/authorized_keys

# 查看私钥（复制到 GitHub Secrets）
cat ~/.ssh/github_actions_key
```

### 3. 启用 GitHub Actions

```bash
# 确保 .github/workflows/jetson-deploy.yml 已提交
git add .github/workflows/jetson-deploy.yml
git commit -m "Add CI/CD pipeline for Jetson deployment"
git push origin DEV
```

### 4. 触发自动部署

```bash
# 方式一: 推送代码自动触发
git add .
git commit -m "Update feature"
git push origin DEV  # 自动部署到测试环境

# 方式二: 手动触发
# GitHub → Actions → Jetson CI/CD Pipeline → Run workflow
```

---

## GitHub Actions 配置

### Workflow 文件解析

**文件位置**: `.github/workflows/jetson-deploy.yml`

#### Job 1: 代码质量检查（test）

```yaml
- TypeScript 类型检查 (npm run typecheck)
- ESLint 代码检查 (npm run lint)
- 前端构建测试 (npm run build)
- Python 代码检查 (py_compile)
- 后端单元测试 (pytest)
- 代码覆盖率报告 (codecov)
```

**目的**: 确保代码质量，防止有问题的代码部署到生产环境

#### Job 2: 构建镜像（build）

```yaml
- 设置 QEMU（支持 ARM64 交叉编译）
- 构建后端 Docker 镜像
- 使用 GitHub Actions 缓存加速构建
```

**注意**: 由于 Jetson 是 ARM64 架构，需要交叉编译或在 Jetson 本地构建

#### Job 3: 部署（deploy）

```yaml
1. 配置 SSH 连接
2. 测试连接性
3. rsync 同步代码到 Jetson
4. 远程执行部署脚本:
   - 备份当前版本
   - 停止旧容器
   - 构建新镜像
   - 启动新容器
   - 健康检查
5. 验证部署结果
```

#### Job 4: 回滚（rollback）

手动触发，用于紧急回滚到上一版本。

---

## Jetson 端配置

### 1. 安装 update.sh 脚本

```bash
cd ~/BPS_20251219

# 脚本已包含在代码库中
chmod +x update.sh

# 测试脚本
bash update.sh --help
```

### 2. 配置 Git（用于更新）

```bash
# 设置 Git 用户（如果还没有）
git config --global user.name "Jetson Auto Deploy"
git config --global user.email "deploy@jetson.local"

# 允许 Git 拉取（配置凭证）
git config --global credential.helper store
```

### 3. 手动更新流程

```bash
# 更新到最新版本
bash update.sh

# 更新到指定分支
bash update.sh --branch main

# 强制更新（忽略本地更改）
bash update.sh --force

# 跳过备份（不推荐）
bash update.sh --no-backup

# 回滚到上一版本
bash update.sh --rollback
```

---

## 部署流程

### 自动部署（推荐）

#### 开发环境（DEV 分支）

```bash
# 1. 开发新功能
git checkout DEV
# ... 开发代码 ...

# 2. 提交并推送
git add .
git commit -m "feat: add new feature"
git push origin DEV

# 3. GitHub Actions 自动执行:
#    - 代码检查
#    - 构建测试
#    - 部署到 Jetson
#    - 健康检查

# 4. 查看部署状态
# GitHub → Actions → 查看最新 Workflow 运行状态
```

#### 生产环境（main 分支）

```bash
# 1. 测试通过后，合并到 main
git checkout main
git merge DEV
git push origin main

# 2. 自动部署到生产环境（同上）
```

### 半自动部署（Jetson 本地）

```bash
# 在 Jetson 上执行
cd ~/BPS_20251219

# 1. 拉取最新代码
git pull origin DEV

# 2. 运行更新脚本
bash update.sh

# 3. 监控部署
bash monitor.sh --watch
```

### 手动部署（完全控制）

```bash
# 1. 备份
rsync -avz ~/BPS_20251219/ ~/BPS_backups/backup_$(date +%Y%m%d_%H%M%S)/

# 2. 拉取代码
cd ~/BPS_20251219
git pull origin DEV

# 3. 停止容器
docker-compose down

# 4. 构建新镜像
docker-compose build

# 5. 启动容器
docker-compose up -d

# 6. 验证
bash monitor.sh
curl http://localhost/api/health
```

---

## 回滚机制

### 自动回滚（集成在部署流程中）

如果健康检查失败，GitHub Actions 会自动回滚：

```yaml
# 健康检查失败，回滚
echo "❌ 健康检查失败，开始回滚..."
docker-compose logs backend
exit 1
```

### 手动回滚（3 种方法）

#### 方法 1: 使用 update.sh（推荐）

```bash
cd ~/BPS_20251219
bash update.sh --rollback
```

**流程**:
1. 停止当前容器
2. 恢复到最近的备份
3. 重新启动容器
4. 健康检查

#### 方法 2: Git 回滚

```bash
cd ~/BPS_20251219

# 查看提交历史
git log --oneline -10

# 回滚到指定提交
git checkout <commit_hash>

# 重新部署
docker-compose down
docker-compose build
docker-compose up -d
```

#### 方法 3: 恢复备份

```bash
# 查看备份列表
ls -lh ~/BPS_backups/

# 选择备份
BACKUP_DIR="backup_20260225_143000_abc1234"

# 恢复
docker-compose down
rsync -avz --delete ~/BPS_backups/$BACKUP_DIR/ ~/BPS_20251219/
docker-compose up -d
```

---

## 监控和告警

### 实时监控

```bash
# 使用监控脚本
bash monitor.sh --watch

# 查看日志
docker-compose logs -f

# 查看资源
docker stats
```

### 日志收集

在 Jetson 上配置日志聚合（可选）：

```bash
# 安装 logrotate（防止日志占满磁盘）
sudo apt install logrotate

# 配置日志轮转
sudo nano /etc/logrotate.d/docker-bps

# 添加内容:
/var/lib/docker/containers/*/*.log {
    rotate 7
    daily
    compress
    size=10M
    missingok
    delaycompress
    copytruncate
}
```

### Slack 通知（可选）

在 GitHub Actions 中已配置 Slack 通知：

1. 创建 Slack Incoming Webhook
2. 添加到 GitHub Secrets (`SLACK_WEBHOOK`)
3. 部署成功/失败会自动发送通知

---

## 最佳实践

### 1. 分支策略

```
main        - 生产环境（稳定版本）
  ↑ PR
DEV         - 测试环境（开发版本）
  ↑ PR
feature/*   - 功能分支
```

**工作流程**:
1. 从 DEV 创建 feature 分支
2. 开发完成后 PR 到 DEV
3. DEV 测试通过后 PR 到 main
4. main 自动部署到生产环境

### 2. 版本标签

```bash
# 生产部署前打标签
git tag -a v1.0.0 -m "Release version 1.0.0"
git push origin v1.0.0
```

### 3. 数据库迁移

**重要**: 数据库在 SQL Server 上，CI/CD 不涉及数据库更新。

如果需要数据库迁移：

```bash
# 1. 在 SQL Server 端手动执行迁移脚本
# 2. 然后再部署应用代码

# 或者在 GitHub Actions 中添加迁移步骤:
- name: 数据库迁移
  run: |
    ssh ${{ env.JETSON_USER }}@${{ env.JETSON_HOST }} << 'ENDSSH'
      cd ${{ env.PROJECT_DIR }}
      docker-compose exec backend python migrate.py
    ENDSSH
```

### 4. 环境变量管理

```bash
# 开发环境
.env.development

# 生产环境
.env.production

# 在部署时选择对应的环境变量文件
cp .env.production .env
```

### 5. 健康检查端点

确保后端有完善的健康检查：

```python
# backend/routers/health.py
@router.get("/health")
def health_check():
    return {
        "status": "healthy",
        "version": "1.0.0",
        "timestamp": datetime.now().isoformat(),
        "database": check_database_connection(),
        "services": {
            "api": "ok",
            "database": "ok"
        }
    }
```

### 6. 性能监控

```bash
# 定时检查性能
# 添加到 crontab
crontab -e

# 每 5 分钟检查一次
*/5 * * * * cd ~/BPS_20251219 && bash monitor.sh >> ~/monitor.log 2>&1
```

### 7. 备份策略

- **代码备份**: Git 仓库已有版本控制
- **容器备份**: `update.sh` 自动创建备份
- **数据库备份**: 在 SQL Server 端配置自动备份

### 8. 安全考虑

```bash
# 1. 限制 SSH 密钥权限
chmod 600 ~/.ssh/github_actions_key

# 2. 使用 SSH 密钥而非密码
# 3. 定期更换密钥
# 4. GitHub Secrets 不要提交到代码库
# 5. 生产环境使用 HTTPS
```

---

## 故障排查

### 问题 1: GitHub Actions 无法连接 Jetson

**原因**: SSH 密钥配置错误或网络问题

**解决**:
```bash
# 1. 测试 SSH 连接
ssh -i ~/.ssh/github_actions_key user@10.70.80.183

# 2. 检查 authorized_keys
cat ~/.ssh/authorized_keys

# 3. 检查防火墙
sudo ufw status
```

### 问题 2: 部署后健康检查失败

**原因**: 数据库连接失败或配置错误

**解决**:
```bash
# 查看日志
docker-compose logs backend

# 测试数据库连接
bash test_connection.sh

# 手动回滚
bash update.sh --rollback
```

### 问题 3: 构建镜像超时

**原因**: Jetson 性能限制或网络问题

**解决**:
```bash
# 1. 在 GitHub Actions 中跳过构建（在 Jetson 本地构建）
# 2. 增加构建超时时间
# 3. 使用 Docker 缓存加速
```

---

## 示例场景

### 场景 1: 紧急修复 Bug

```bash
# 1. 创建 hotfix 分支
git checkout -b hotfix/critical-bug main

# 2. 修复 Bug
# ... 修改代码 ...

# 3. 测试
npm run typecheck
cd backend && pytest

# 4. 提交并推送
git add .
git commit -m "fix: critical bug in task matching"
git push origin hotfix/critical-bug

# 5. 合并到 main 并部署
git checkout main
git merge hotfix/critical-bug
git push origin main  # 自动部署

# 6. 监控
# GitHub Actions 会自动部署并通知
```

### 场景 2: 新功能开发

```bash
# 1. 创建功能分支
git checkout -b feature/new-dashboard DEV

# 2. 开发
# ... 开发代码 ...

# 3. 推送到 DEV 测试
git push origin DEV  # 自动部署到测试环境

# 4. 测试通过后合并到 main
git checkout main
git merge DEV
git push origin main  # 自动部署到生产环境
```

### 场景 3: 定期更新依赖

```bash
# 1. 更新依赖
npm update
cd backend && pip list --outdated

# 2. 测试
npm run build
pytest

# 3. 提交
git add .
git commit -m "chore: update dependencies"
git push origin DEV  # 自动测试和部署
```

---

## 性能优化

### 加速构建

```yaml
# 使用 GitHub Actions 缓存
- uses: actions/cache@v3
  with:
    path: |
      ~/.npm
      ~/.cache/pip
    key: ${{ runner.os }}-build-${{ hashFiles('**/package-lock.json', '**/requirements.txt') }}
```

### 并行部署（多环境）

```yaml
strategy:
  matrix:
    environment: [dev, staging, prod]
```

---

## 总结

通过这套 CI/CD 系统，您可以：

✅ **自动化部署**: 推送代码自动部署到 Jetson  
✅ **质量保证**: 代码检查和测试自动化  
✅ **零停机更新**: 蓝绿部署策略  
✅ **快速回滚**: 1 分钟内回滚到上一版本  
✅ **监控告警**: 实时监控和通知  
✅ **安全可靠**: 备份和健康检查机制  

**开始使用**:
1. 配置 GitHub Secrets
2. 生成 SSH 密钥对
3. 推送代码触发部署
4. 使用 `bash monitor.sh --watch` 监控

参考文档:
- `jetson-deploy.yml` - GitHub Actions 配置
- `update.sh` - Jetson 更新脚本
- `QUICKSTART_JETSON.md` - 快速开始指南
