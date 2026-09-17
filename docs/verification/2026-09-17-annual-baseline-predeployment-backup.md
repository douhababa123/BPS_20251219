# 年度能力基线上线前数据库保护记录

记录时间：2026-09-17 20:55（Asia/Shanghai）

## 专用完整备份

- 数据库：`DCCT_BPS_Debug`
- SQL Server：`naaswigqm01p`
- 备份文件：`D:\DATA01\Microsoft SQL Server\MSSQL15.MSSQLSERVER\MSSQL\Backup\DCCT_BPS_Debug_pre_annual_baseline_20260917_205518.bak`
- 类型：完整备份，`COPY_ONLY`
- 校验：`CHECKSUM`，`msdb.dbo.backupset.has_backup_checksums = 1`
- 原始大小：17,928,192 bytes
- 压缩大小：2,304,897 bytes

当前应用账号能够创建备份并读取备份历史，但没有执行 `RESTORE VERIFYONLY` 所需的 `CREATE DATABASE` 权限。因此恢复验证需要由数据库管理员使用有权限的账号执行：

```sql
RESTORE VERIFYONLY
FROM DISK = N'D:\DATA01\Microsoft SQL Server\MSSQL15.MSSQLSERVER\MSSQL\Backup\DCCT_BPS_Debug_pre_annual_baseline_20260917_205518.bak'
WITH CHECKSUM;
```

## 迁移前业务数据基线

以下数值在执行 `008_capability_governance.sql` 前记录。校验值使用 SQL Server `CHECKSUM_AGG(BINARY_CHECKSUM(*))`，用于迁移后的同库快速对比。

| 表/投影 | 行数 | 校验值 |
|---|---:|---:|
| `dbo.competency_assessments` | 463 | 1725216546 |
| `dbo.competency_assessment_history` | 509 | 642256766 |
| `dbo.tasks` | 437 | 472835184 |
| `dbo.competency_definitions` | 38 | -1243624166 |
| `dbo.competency_definitions(module_name, owner_engineer)` | 38 | 794740913 |
| `dbo.skills` | 75 | 1304258118 |
| `dbo.employees` | 29 | -999955565 |
| `dbo.users` | 27 | -769917105 |

迁移前以下新增对象不存在：

- `dbo.competency_assessment_versions`
- `dbo.competency_annual_baselines`
- `dbo.competency_annual_baseline_items`

迁移完成后必须重新读取上述行数与校验值。除允许增加的历史表 `version_id` 空列外，既有业务数据的行数和值不得改变。

## 迁移后核对

`008_capability_governance.sql` 已于 2026-09-17 执行成功，并再次执行验证幂等性。核对结果：

- `competency_assessments`：463 行，校验值 `1725216546`，一致。
- `competency_assessment_history`：509 行；排除新增的全空 `version_id` 列后，原有15列校验值为 `642256766`，一致；`version_id IS NOT NULL` 为 0。
- `tasks`：437 行，校验值 `472835184`，一致。
- `competency_definitions`：38 行，校验值 `-1243624166`，一致。
- 模块 Owner 投影：38 行，校验值 `794740913`，一致。
- `skills`：75 行，校验值 `1304258118`，一致。
- `employees`：29 行，校验值 `-999955565`，一致。
- `users`：27 行，校验值 `-769917105`，一致。
- 新增版本表、年度基线头表和年度基线明细表均为 0 行，没有自动创建或激活任何年度基线。
- 年度基线明细所需的4个关键外键均已建立。

结论：迁移仅增加结构，现有评估、历史值、任务、员工、账号、技能和模块 Owner 数据均未改变。
