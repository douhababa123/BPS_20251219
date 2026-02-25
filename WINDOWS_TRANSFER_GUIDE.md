# Windows 环境下准备 Jetson 部署文件

由于您当前在 Windows 环境，需要先将文件传输到 Jetson，并设置执行权限。

## 📦 方式一: 使用 Git 推送（推荐）

```powershell
# 在 Windows 上（当前目录）
git add .
git commit -m "Add Jetson deployment scripts and docs"
git push origin DEV
```

然后在 Jetson 上：
```bash
cd ~
git clone https://github.com/douhababa123/BPS_20251219.git
cd BPS_20251219
git checkout DEV

# 添加执行权限
chmod +x test_connection.sh deploy.sh monitor.sh

# 验证权限
ls -la *.sh
```

---

## 📦 方式二: 使用 SCP 传输

### 在 Windows PowerShell 中:

```powershell
# 设置 Jetson 连接信息
$JETSON_IP = "10.70.80.183"
$JETSON_USER = "your_username"  # 替换为 Jetson 用户名

# 传输脚本
scp test_connection.sh "${JETSON_USER}@${JETSON_IP}:~/"
scp deploy.sh "${JETSON_USER}@${JETSON_IP}:~/"
scp monitor.sh "${JETSON_USER}@${JETSON_IP}:~/"
scp .env.jetson "${JETSON_USER}@${JETSON_IP}:~/"

# 传输文档
scp QUICKSTART_JETSON.md "${JETSON_USER}@${JETSON_IP}:~/"
scp DEPLOYMENT_CHECKLIST.md "${JETSON_USER}@${JETSON_IP}:~/"
scp SCRIPTS_README.md "${JETSON_USER}@${JETSON_IP}:~/"
```

### 在 Jetson 上:

```bash
# 创建项目目录
mkdir -p ~/BPS_20251219
cd ~/BPS_20251219

# 移动文件
mv ~/*.sh .
mv ~/*.md .
mv ~/.env.jetson .

# 添加执行权限
chmod +x *.sh

# 验证
ls -la *.sh
```

---

## 📦 方式三: 使用 WinSCP（图形界面）

1. **下载 WinSCP**: https://winscp.net/

2. **连接到 Jetson**:
   - 主机名: `10.70.80.183`
   - 用户名: 您的 Jetson 用户名
   - 密码: 您的 Jetson 密码
   - 协议: SFTP

3. **传输文件**:
   - 将以下文件拖拽到 Jetson 的 `/home/your_username/BPS_20251219/` 目录:
     - `test_connection.sh`
     - `deploy.sh`
     - `monitor.sh`
     - `.env.jetson`
     - `QUICKSTART_JETSON.md`
     - `DEPLOYMENT_CHECKLIST.md`
     - `SCRIPTS_README.md`
     - `DEPLOYMENT_INDEX.md`

4. **在 WinSCP 中设置执行权限**:
   - 右键点击 `.sh` 文件
   - Properties → Permissions
   - 勾选所有 "Execute" 权限
   - 或设置为 `0755` (rwxr-xr-x)

---

## ✅ 验证文件完整性

在 Jetson 上运行：

```bash
cd ~/BPS_20251219

# 检查文件是否存在
ls -lh test_connection.sh deploy.sh monitor.sh .env.jetson *.md

# 检查执行权限（应显示 -rwxr-xr-x）
ls -l *.sh

# 如果权限不对，统一设置
chmod +x test_connection.sh deploy.sh monitor.sh
```

---

## 🚀 开始部署

文件准备完成后，按照以下顺序操作：

```bash
# 1. 阅读部署索引
cat DEPLOYMENT_INDEX.md

# 2. 查看检查清单
cat DEPLOYMENT_CHECKLIST.md

# 3. 测试连接
bash test_connection.sh

# 4. 一键部署
bash deploy.sh

# 5. 监控系统
bash monitor.sh --watch
```

---

## 📝 文件清单（确保都已传输）

### 必需文件 ✅
- [ ] `test_connection.sh` - 连接测试脚本
- [ ] `deploy.sh` - 一键部署脚本
- [ ] `monitor.sh` - 监控脚本
- [ ] `.env.jetson` - 环境变量模板（已预填数据库配置）

### 推荐文件 ⭐
- [ ] `DEPLOYMENT_INDEX.md` - 部署文档索引（导航）
- [ ] `DEPLOYMENT_CHECKLIST.md` - 部署检查清单
- [ ] `QUICKSTART_JETSON.md` - 快速开始指南
- [ ] `SCRIPTS_README.md` - 脚本详细说明

### 可选文件 📚
- [ ] `DEPLOYMENT_GUIDE_JETSON.md` - 完整部署文档（800+ 行）
- [ ] `TASK_ASSIGNMENT_WORKFLOW_ANALYSIS.md` - 任务工作流分析

---

## 🔍 常见问题

### Q1: bash: ./test_connection.sh: Permission denied

**原因**: 文件没有执行权限

**解决**:
```bash
chmod +x test_connection.sh
bash test_connection.sh
```

### Q2: 文件传输后乱码或格式错误

**原因**: Windows 和 Linux 的换行符不同（CRLF vs LF）

**解决**:
```bash
# 在 Jetson 上安装 dos2unix
sudo apt install dos2unix

# 转换文件格式
dos2unix test_connection.sh deploy.sh monitor.sh

# 重新设置权限
chmod +x *.sh
```

### Q3: Git 推送后脚本无法执行

**原因**: Git 默认不保留执行权限

**解决**:
```bash
# 在 Jetson 上
cd ~/BPS_20251219
chmod +x *.sh

# 或者在 Windows Git Bash 中（推送前）
git update-index --chmod=+x test_connection.sh
git update-index --chmod=+x deploy.sh
git update-index --chmod=+x monitor.sh
git commit -m "Add execute permissions to scripts"
git push origin DEV
```

---

## 📞 下一步

文件传输完成后，请阅读 `DEPLOYMENT_INDEX.md` 选择合适的部署方式：

- **新手**: 阅读 DEPLOYMENT_CHECKLIST.md → 运行 deploy.sh
- **有经验**: 直接运行 test_connection.sh → deploy.sh
- **学习理解**: 阅读 QUICKSTART_JETSON.md 的手动部署步骤

祝部署顺利！🚀
