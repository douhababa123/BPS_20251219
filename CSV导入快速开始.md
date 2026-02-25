# ============================================================================
# CSV 数据导入 SQL Server - 快速开始指南
# ============================================================================

## 使用步骤

### 1. 确保已安装 pyodbc

如果未安装，运行：
```powershell
pip install pyodbc
```

### 2. 验证 SQL Server 连接配置

脚本中的连接配置：
- 服务器: 10.88.43.154
- 数据库: DCCT_BPS_Debug
- 用户名: TEST
- 密码: 123456
- 驱动: ODBC Driver 17 for SQL Server

### 3. 运行导入脚本

```powershell
# 激活虚拟环境（如果使用）
.\.venv\Scripts\Activate.ps1

# 运行导入脚本
python import_csv_to_sqlserver.py
```

或直接：
```powershell
c:/Users/DOC2CHZ/Software/BPS_20251219/.venv/Scripts/python.exe import_csv_to_sqlserver.py
```

---

## 脚本功能

### ✅ 自动导入 11 个表（按顺序）

**第一批（6 个表）**：
1. departments (14 行) - 自动处理 IDENTITY_INSERT ✨
2. factories (9 行)
3. task_types (8 行)
4. resource_task_types (11 行) - 自动处理 IDENTITY_INSERT ✨
5. skills (104 行) - 自动处理 IDENTITY_INSERT ✨
6. competency_definitions (39 行)

**第二批（1 个表）**：
7. employees (18 行)

**第三批（4 个表）**：
8. competency_assessments (375 行)
9. tasks (15 行)
10. resource_planning_tasks (2411 行) - 最大表
11. schedule_change_notifications (9 行)

**总计**: 3013 行数据

---

## 导入过程说明

1. **连接数据库**
   - 自动连接到配置的 SQL Server

2. **清空现有数据**
   - 每个表导入前会先清空（DELETE）

3. **处理 IDENTITY_INSERT**
   - departments, resource_task_types, skills 自动开启/关闭 IDENTITY_INSERT
   - 允许手动指定 ID 值

4. **字段匹配**
   - 自动匹配 CSV 字段和 SQL Server 字段
   - 跳过 SQL Server 中不存在的字段（如 employees.position）

5. **数据类型转换**
   - 布尔值: true/false → 1/0
   - 数字: 字符串 → INT/BIGINT/DECIMAL
   - 空值: 空字符串 → NULL

6. **错误处理**
   - 单行失败不影响其他行
   - 显示前 5 个错误信息

7. **进度显示**
   - 实时显示导入进度（每 100 行更新）

8. **自动验证**
   - 导入完成后验证每个表的行数
   - 对比预期值，生成报告

---

## 输出示例

```
================================================================================
  CSV 数据批量导入 SQL Server
================================================================================
开始时间: 2026-01-29 15:30:00
CSV 目录: C:\Users\DOC2CHZ\Software\BPS_20251219\csv_data
SQL Server: 10.88.43.154/DCCT_BPS_Debug

🔌 连接 SQL Server...
✅ 数据库连接成功

================================================================================
  开始导入 11 个表
================================================================================

[1/11] 
📦 导入表: departments
   文件: departments.csv
ℹ️ CSV 文件包含 14 行数据
ℹ️ SQL Server 表包含 7 个字段
ℹ️ 已清空表 departments 的现有数据
ℹ️ 已开启 IDENTITY_INSERT
ℹ️ 匹配到 7 个字段: id, code, name, description, is_active...
   进度: 14/14 (100%)
✅ 成功导入 14 行数据
ℹ️ 已关闭 IDENTITY_INSERT

[2/11] 
📦 导入表: factories
...

================================================================================
  验证导入结果
================================================================================

表名                                 预期行数      实际行数      状态
----------------------------------------------------------------------
departments                         14           14           ✅
employees                           18           18           ✅
factories                           9            9            ✅
...
----------------------------------------------------------------------
总计                                3013         3013         ✅

✅ 所有表数据导入完整！

================================================================================
  导入完成
================================================================================
结束时间: 2026-01-29 15:32:15
成功导入: 11/11 个表
✅ ✨ 所有数据导入成功！
```

---

## 常见问题

### Q1: 提示 "ODBC Driver 17 for SQL Server not found"

**解决**:
1. 检查已安装的驱动：
   ```powershell
   Get-OdbcDriver | Where-Object {$_.Name -like "*SQL Server*"}
   ```

2. 如果只有 Driver 18，修改脚本配置：
   ```python
   SQL_SERVER_CONFIG = {
       ...
       'driver': '{ODBC Driver 18 for SQL Server}'  # 改为 18
   }
   ```

### Q2: 连接失败 "Login failed for user 'TEST'"

**解决**: 检查 SQL Server 配置中的用户名和密码是否正确

### Q3: 导入失败 "Cannot insert explicit value for identity column"

**原因**: IDENTITY_INSERT 配置错误

**解决**: 脚本已自动处理，如果仍有问题，检查 `identity_insert` 配置

### Q4: 某个表导入失败

**解决**:
1. 查看错误信息（脚本会显示前 5 个错误）
2. 检查 CSV 文件格式是否正确
3. 检查字段映射配置

### Q5: 想要自定义导入行为

**修改配置**:
- 修改 `SQL_SERVER_CONFIG` 更改数据库连接
- 修改 `IMPORT_ORDER` 调整导入顺序或跳过某些表
- 修改 `skip_columns` 跳过特定字段
- 修改 `column_mapping` 自定义字段映射

---

## 高级用法

### 只导入特定表

修改 `IMPORT_ORDER`，注释掉不需要的表：

```python
IMPORT_ORDER = [
    {
        'file': 'departments.csv',
        'table': 'departments',
        'identity_insert': True,
    },
    # {
    #     'file': 'factories.csv',  # 跳过
    #     'table': 'factories',
    # },
    ...
]
```

### 不清空现有数据

注释掉 `import_table` 函数中的这行：

```python
# clear_table(cursor, table_name)  # 注释掉这行
```

### 添加自定义字段映射

```python
{
    'file': 'employees.csv',
    'table': 'employees',
    'column_mapping': {
        'employee_code': 'employee_id',  # CSV 字段 -> SQL 字段
        'full_name': 'name',
    }
}
```

---

## 注意事项

⚠️ **数据备份**: 脚本会清空现有数据，请确保已备份重要数据

⚠️ **导入顺序**: 不要修改导入顺序，必须遵循外键依赖

⚠️ **并发导入**: 脚本不支持并发，按顺序逐个导入

⚠️ **错误处理**: 单个表失败不会中断整个流程，会继续导入下一个表

---

## 技术支持

如有问题，请参考：
- `SUPABASE_数据导入SQL_Server操作指南.md`（手动导入指南）
- `SUPABASE_TO_SQLSERVER_表结构迁移完整指南.md`（完整技术文档）
