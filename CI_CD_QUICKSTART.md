# CI/CD 快速配置清单

**目标**: 10 分钟内完成 CI/CD 配置，实现自动部署

---

## ✅ 配置步骤

### Step 1: 在 Jetson 上生成 SSH 密钥（2 分钟）

```bash
# SSH 到 Jetson
ssh your_username@10.70.80.183

# 生成密钥对
cd ~
ssh-keygen -t rsa -b 4096 -f ~/.ssh/github_actions_key -N ""

# 添加公钥到 authorized_keys
cat ~/.ssh/github_actions_key.pub >> ~/.ssh/authorized_keys
chmod 600 ~/.ssh/authorized_keys

# 显示私钥（复制下来，稍后用）
echo "========== 复制下面的私钥到 GitHub Secrets =========="
cat ~/.ssh/github_actions_key
echo "=================================================="
```

---

### Step 2: 配置 GitHub Secrets（3 分钟）

在 GitHub 上:
1. 打开仓库: https://github.com/douhababa123/BPS_20251219
2. 点击 `Settings` → `Secrets and variables` → `Actions`
3. 点击 `New repository secret` 添加以下 Secrets:

| 名称 | 值 | 说明 |
|------|---|------|
| **JETSON_HOST** | `10.70.80.183` | Jetson IP 地址 |
| **JETSON_USER** | `你的Jetson用户名` | SSH 用户名 |
| **JETSON_SSH_KEY** | Step 1 中的私钥内容 | 完整复制私钥 |

**注意**: `JETSON_SSH_KEY` 应该像这样：
```
-----BEGIN RSA PRIVATE KEY-----
MIIEpAIBAAKCAQEA...（很长的密钥内容）
-----END RSA PRIVATE KEY-----
```

---

### Step 3: 提交 CI/CD 配置（2 分钟）

在 Windows 开发机上:

```powershell
cd C:\Users\DOC2CHZ\Software\BPS_20251219

# 添加所有文件
git add .github/workflows/jetson-deploy.yml
git add update.sh
git add CI_CD_GUIDE.md
git add CI_CD_QUICKSTART.md

# 提交
git commit -m "feat: add CI/CD pipeline for automatic deployment

- GitHub Actions workflow for test, build, deploy
- Jetson update script with blue-green deployment
- Auto rollback on health check failure"

# 推送（触发首次部署）
git push origin DEV
```

---

### Step 4: 验证部署（3 分钟）

1. **查看 GitHub Actions**:
   - 打开: https://github.com/douhababa123/BPS_20251219/actions
   - 应该看到 "Jetson CI/CD Pipeline" 正在运行

2. **监控部署进度**:
   - 点击最新的 Workflow 运行
   - 查看每个步骤的执行情况

3. **在 Jetson 上验证**:
   ```bash
   ssh your_username@10.70.80.183
   cd ~/BPS_20251219
   
   # 查看容器状态
   docker-compose ps
   
   # 查看日志
   docker-compose logs -f
   
   # 运行监控
   bash monitor.sh
   ```

4. **浏览器验证**:
   - 打开: http://10.70.80.183
   - 应该看到系统正常运行

---

## 🚀 使用 CI/CD

### 自动部署（推荐）

以后每次更新代码，只需要：

```bash
git add .
git commit -m "feat: your changes"
git push origin DEV
```

GitHub Actions 会自动：
1. ✅ 运行测试（TypeCheck + ESLint + Pytest）
2. ✅ 构建镜像
3. ✅ 部署到 Jetson
4. ✅ 健康检查（失败自动回滚）
5. ✅ 发送通知（如果配置了 Slack）

### 手动更新（在 Jetson 上）

```bash
cd ~/BPS_20251219

# 拉取并自动部署
bash update.sh

# 回滚到上一版本
bash update.sh --rollback

# 监控系统
bash monitor.sh --watch
```

---

## 🔍 故障排查

### 问题 1: GitHub Actions 报错 "Permission denied (publickey)"

**原因**: SSH 密钥配置错误

**解决**:
```bash
# 在 Jetson 上重新检查
cat ~/.ssh/authorized_keys | grep "github_actions"

# 重新生成密钥（如果有问题）
ssh-keygen -t rsa -b 4096 -f ~/.ssh/github_actions_key -N ""
cat ~/.ssh/github_actions_key.pub >> ~/.ssh/authorized_keys

# 测试连接
ssh -i ~/.ssh/github_actions_key your_username@10.70.80.183
```

### 问题 2: 部署后健康检查失败

**查看日志**:
```bash
# 在 GitHub Actions 页面查看 "部署到 Jetson" 步骤的日志

# 或在 Jetson 上查看
docker-compose logs backend
```

**常见原因**:
- 数据库连接失败 → 检查 .env 配置
- 端口被占用 → `netstat -tunlp | grep 8000`
- 容器启动失败 → `docker-compose ps`

### 问题 3: rsync 文件同步失败

**原因**: 网络问题或权限问题

**解决**:
```bash
# 测试 rsync
rsync -avz --dry-run ./ your_username@10.70.80.183:~/test/

# 检查 Jetson 磁盘空间
ssh your_username@10.70.80.183 "df -h"
```

---

## 📊 验证 CI/CD 是否工作

### 测试 1: 修改一个文件触发部署

```bash
# 修改 README.md（不影响功能）
echo "<!-- Test CI/CD -->" >> README.md

git add README.md
git commit -m "test: verify CI/CD pipeline"
git push origin DEV

# 查看 GitHub Actions 是否自动运行
```

### 测试 2: 查看部署历史

```bash
# 在 Jetson 上
cd ~/BPS_20251219

# 查看 Git 历史
git log --oneline -10

# 查看备份历史
ls -lh ~/BPS_backups/
```

### 测试 3: 模拟回滚

```bash
# 在 Jetson 上手动回滚
bash update.sh --rollback

# 验证回滚成功
curl http://localhost/api/health
```

---

## ✨ 高级配置（可选）

### 1. 添加 Slack 通知

```bash
# 在 GitHub Secrets 中添加:
SLACK_WEBHOOK = "https://hooks.slack.com/services/YOUR/WEBHOOK/URL"
```

### 2. 多环境部署

编辑 `.github/workflows/jetson-deploy.yml`:
```yaml
# 添加环境矩阵
strategy:
  matrix:
    environment: [dev, prod]
```

### 3. 定时健康检查

在 Jetson 上添加 crontab:
```bash
crontab -e

# 每 5 分钟检查一次
*/5 * * * * cd ~/BPS_20251219 && curl -f http://localhost/api/health || bash update.sh --rollback
```

---

## 📝 完成检查清单

完成后请确认：

- [ ] ✅ GitHub Secrets 已配置（JETSON_HOST, JETSON_USER, JETSON_SSH_KEY）
- [ ] ✅ Jetson SSH 密钥已生成并添加到 authorized_keys
- [ ] ✅ CI/CD 配置文件已提交（jetson-deploy.yml）
- [ ] ✅ 推送代码后 GitHub Actions 自动运行
- [ ] ✅ 部署成功且健康检查通过
- [ ] ✅ 浏览器可访问 http://10.70.80.183
- [ ] ✅ update.sh 脚本可正常使用
- [ ] ✅ 回滚功能测试通过

---

## 🎉 完成！

现在您的 CI/CD 管道已配置完成！

**日常工作流程**:
```bash
# 1. 开发
# ... 修改代码 ...

# 2. 提交
git add .
git commit -m "feat: new feature"
git push origin DEV

# 3. 自动部署
# GitHub Actions 会自动完成测试、构建、部署

# 4. 验证
# 浏览器访问 http://10.70.80.183 验证更新
```

**需要更多帮助？**
- 完整文档: `CI_CD_GUIDE.md`
- 部署脚本: `update.sh --help`
- 监控系统: `bash monitor.sh --watch`
