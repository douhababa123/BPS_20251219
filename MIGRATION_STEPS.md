# Supabase 到 SQL Server 数据迁移操作手册

## 📋 目标
将 BPS 项目从 Supabase (PostgreSQL) 无缝迁移到内网 SQL Server，保证程序打开即可用。

---

## 🛠️ 前置准备

### 1. 软件环境
- ✅ **SQL Server** 已安装（版本 2016 或更高）
- ✅ **SQL Server Management Studio (SSMS)** 已安装
- ✅ **Python 3.8+** 已安装（用于运行迁移脚本）
- ✅ **本机可访问 Supabase** 和 **内网 SQL Server**

### 2. Python 依赖安装
```powershell
# 在项目根目录执行
pip install supabase pyodbc python-dotenv
```

### 3. 检查 SQL Server ODBC 驱动
```powershell
# 打开 PowerShell 执行
Get-OdbcDriver | Where-Object {$_.Name -like "*SQL Server*"}
```

**如果无输出，请下载安装**：
- [ODBC Driver 17 for SQL Server](https://learn.microsoft.com/en-us/sql/connect/odbc/download-odbc-driver-for-sql-server)
- 或 [ODBC Driver 18 for SQL Server](https://learn.microsoft.com/en-us/sql/connect/odbc/download-odbc-driver-for-sql-server)

安装后驱动名称为：`ODBC Driver 17 for SQL Server` 或 `ODBC Driver 18 for SQL Server`

---

## 📝 迁移步骤

### 步骤 1：备份 Supabase 数据（可选但强烈推荐）

在 Supabase Dashboard 中：
1. 进入 **Database** → **Backups**
2. 点击 **Download backup** 保存到本地

---

### 步骤 2：在 SQL Server 创建数据库

#### 方法 A：使用 SSMS 图形界面
1. 打开 **SQL Server Management Studio (SSMS)**
2. 连接到你的内网 SQL Server
3. 右键 **Databases** → **New Database**
4. 数据库名称输入：`bps_db`
5. 点击 **OK** 创建

#### 方法 B：使用 SQL 命令
```sql
CREATE DATABASE bps_db;
GO
USE bps_db;
GO
```

---

### 步骤 3：执行建表脚本

1. **在 SSMS 中打开脚本**：
   - 点击 **File** → **Open** → **File...**
   - 选择项目根目录的 `SQLSERVER_SCHEMA.sql`

2. **确保连接到 bps_db 数据库**：
   - 在 SSMS 工具栏的数据库下拉列表中选择 `bps_db`

3. **执行脚本**：
   - 点击工具栏的 **Execute** 按钮（或按 `F5`）

4. **查看执行结果**：
   - 在 **Messages** 窗口应显示所有 "✅" 成功消息
   - 应创建 10 张表、4 个视图、1 个存储过程
   - 应插入 8 种任务类型、9 个工厂、18 个示例技能

**验证建表成功**：
```sql
-- 查看所有表
SELECT TABLE_NAME 
FROM INFORMATION_SCHEMA.TABLES 
WHERE TABLE_TYPE = 'BASE TABLE' 
ORDER BY TABLE_NAME;

-- 应显示以下 10 张表：
-- competency_assessments
-- departments
-- employees
-- factories
-- otp_tokens
-- resource_planning_tasks
-- skills
-- task_types
-- tasks
-- users
```

---

### 步骤 4：配置迁移脚本

打开项目根目录的 `migrate_supabase_to_sqlserver.py`，修改以下配置：

#### 4.1 Supabase 配置（第18-19行）
```python
# 确认以下信息与你的 .env 一致
SUPABASE_URL = "https://wpbgzcmpwsktoaowwkpj.supabase.co"  # 或从 .env 读取
SUPABASE_KEY = "sb_publishable_ytPCyU2oEoHxYQYBPdC-8A_QskBu-l4"  # 或从 .env 读取
```

#### 4.2 SQL Server 配置（第21-28行）
```python
SQLSERVER_CONFIG = {
    "server": "192.168.1.100",  # ⚠️ 修改为你的内网 SQL Server IP 或主机名
    "port": 1433,
    "database": "bps_db",
    "username": "sa",           # ⚠️ 修改为你的 SQL Server 用户名
    "password": "YourPass123",  # ⚠️ 修改为你的 SQL Server 密码
    "driver": "ODBC Driver 17 for SQL Server"  # 如果安装的是 Driver 18，改为 "ODBC Driver 18 for SQL Server"
}
```

**获取 SQL Server 连接信息**：
- **Server**: 在 SSMS 连接时显示的服务器名称（如 `localhost`, `192.168.1.100`, `DESKTOP-ABC123`）
- **Port**: 默认 `1433`（可在 SQL Server Configuration Manager 查看）
- **Username/Password**: SQL Server 认证的用户名和密码（如果使用 Windows 认证，需修改连接字符串）

---

### 步骤 5：运行数据迁移

在项目根目录打开 PowerShell，执行：

```powershell
python migrate_supabase_to_sqlserver.py
```

**预期输出**：
```
============================================================
🚀 Supabase → SQL Server 数据迁移工具
============================================================
✅ Supabase 连接成功
✅ SQL Server 连接成功

📋 开始迁移 departments 表...
   ✅ 已迁移 5 条部门数据

👤 开始迁移 employees 表...
   ✅ 已迁移 50 条员工数据

🔐 开始迁移认证用户...
   ✅ 已为 50 个员工创建用户记录（邮箱未激活）
   💡 提示：用户首次登录时需通过OTP验证邮箱

🛠️  开始迁移 skills 表...
   ✅ 已迁移 18 条技能数据

📊 开始迁移 competency_assessments 表...
   ✅ 已迁移 1200 条评估数据

📅 开始迁移 tasks 表...
   ✅ 已迁移 100 条任务数据

📆 开始迁移 resource_planning_tasks 表...
   ✅ 已迁移 200 条资源规划任务数据

🔍 验证迁移结果...

表名                          | 行数
--------------------------------------------------
users                          | 50
departments                    | 5
employees                      | 50
skills                         | 18
competency_assessments         | 1,200
tasks                          | 100
resource_planning_tasks        | 200

✅ 数据验证完成

============================================================
🎉 数据迁移完成！
============================================================

下一步操作:
  1. 在 SQL Server 中检查数据完整性
  2. 更新前端 .env 配置（VITE_API_BASE_URL）
  3. 启动 FastAPI 后端服务
  4. 测试登录/注册功能

✅ 数据库连接已关闭
```

---

### 步骤 6：验证数据完整性

在 SSMS 中执行以下查询：

```sql
-- 1. 检查所有表的行数
SELECT
  t.name AS TableName,
  SUM(p.rows) AS RowCount
FROM sys.tables t
INNER JOIN sys.partitions p ON t.object_id = p.object_id
WHERE p.index_id IN (0,1)
  AND t.name IN ('users', 'departments', 'employees', 'skills', 'competency_assessments', 'tasks', 'resource_planning_tasks')
GROUP BY t.name
ORDER BY t.name;

-- 2. 检查部门数据
SELECT * FROM departments;

-- 3. 检查员工数据（前10条）
SELECT TOP 10 * FROM employees ORDER BY created_at DESC;

-- 4. 检查评估数据（前10条）
SELECT TOP 10 * FROM competency_assessments ORDER BY created_at DESC;

-- 5. 使用视图查询（验证联表查询）
SELECT TOP 10 * FROM view_assessments_full;
```

**确认要点**：
- ✅ 所有表的行数应与 Supabase 一致
- ✅ 员工的 `department_id` 外键关联正确
- ✅ 评估记录的 `employee_id` 和 `skill_id` 外键关联正确
- ✅ 视图查询能正常返回结果（含部门名称、技能名称）

---

## 🔧 常见问题排查

### 问题 1：Python 脚本报错 "ModuleNotFoundError: No module named 'supabase'"
**解决方案**：
```powershell
pip install supabase pyodbc python-dotenv
```

---

### 问题 2：连接 SQL Server 失败 "Login failed for user 'sa'"
**原因**：密码错误或 SQL Server 认证未启用

**解决方案**：
1. **检查密码**：确认 `migrate_supabase_to_sqlserver.py` 中的密码正确
2. **启用 SQL Server 认证**：
   - 在 SSMS 中，右键服务器 → **Properties** → **Security**
   - 选择 **SQL Server and Windows Authentication mode**
   - 重启 SQL Server 服务

---

### 问题 3：连接 SQL Server 失败 "TCP/IP connection to the host ... failed"
**原因**：SQL Server 未启用 TCP/IP 协议或防火墙阻止

**解决方案**：
1. **启用 TCP/IP**：
   - 打开 **SQL Server Configuration Manager**
   - 展开 **SQL Server Network Configuration** → **Protocols for MSSQLSERVER**
   - 右键 **TCP/IP** → **Enable**
   - 重启 SQL Server 服务

2. **检查防火墙**：
   ```powershell
   # 允许端口 1433
   New-NetFirewallRule -DisplayName "SQL Server" -Direction Inbound -LocalPort 1433 -Protocol TCP -Action Allow
   ```

---

### 问题 4：迁移脚本报错 "pyodbc.Error: ('08001', ...)"
**原因**：ODBC 驱动版本不匹配

**解决方案**：
1. 检查已安装的驱动：
   ```powershell
   Get-OdbcDriver | Where-Object {$_.Name -like "*SQL Server*"}
   ```

2. 修改 `migrate_supabase_to_sqlserver.py` 中的 `driver` 配置：
   ```python
   "driver": "ODBC Driver 18 for SQL Server"  # 根据实际驱动版本修改
   ```

---

### 问题 5：数据迁移后行数为 0
**原因**：Supabase 连接失败或表名不匹配

**解决方案**：
1. 检查 Supabase 连接：
   ```python
   # 在脚本中添加调试代码
   response = supabase.table("departments").select("*").execute()
   print(f"Supabase departments count: {len(response.data)}")
   ```

2. 确认 Supabase 中确实有数据：
   - 登录 Supabase Dashboard → **Table Editor** → 查看各表数据

---

## 🎯 下一步：前端对接 SQL Server

迁移完成后，需要修改前端代码对接新的 FastAPI 后端（参考 `SUPABASE_TO_SQLSERVER_MIGRATION_GUIDE.md` 第 5-6 节）。

### 快速切换步骤：

1. **部署 FastAPI 后端**（参考迁移指南第 5 节）
2. **修改前端 .env 配置**：
   ```env
   # .env
   VITE_API_BASE_URL=http://192.168.1.100:8000  # FastAPI 后端地址
   ```

3. **更新前端服务层**（参考迁移指南第 6 节）

4. **重启前端**：
   ```powershell
   npm run dev
   ```

---

## ✅ 迁移完成检查清单

- [ ] SQL Server 已安装并可访问
- [ ] 已创建数据库 `bps_db`
- [ ] 已执行 `SQLSERVER_SCHEMA.sql` 建表脚本
- [ ] 已配置 `migrate_supabase_to_sqlserver.py` 连接信息
- [ ] 已运行迁移脚本且无报错
- [ ] 已在 SSMS 中验证数据完整性（表行数、外键关联）
- [ ] 已测试视图查询（`view_assessments_full` 等）
- [ ] 已备份 SQL Server 数据库（可选）

---

## 📞 技术支持

如遇到问题，请检查：
1. 迁移脚本输出的错误信息
2. SQL Server 错误日志（SSMS → Management → SQL Server Logs）
3. Python 异常堆栈信息

提供以上信息以便快速定位问题。

---

**文档版本**: v1.0  
**创建日期**: 2026-01-29  
**维护者**: GitHub Copilot
