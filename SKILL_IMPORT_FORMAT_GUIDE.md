# 📊 Skills表数据导入格式指南

## 🎯 快速概览

如果您要上传**skills（技能定义）**数据，有以下几种方式：

### 方式1：通过Web界面导入Excel（推荐）
### 方式2：直接插入SQL语句
### 方式3：使用CSV批量导入

---

## 📋 方式1：Web界面Excel导入（最简单）

### Excel格式要求

#### 文件结构
```
第1行（表头）：编号 | 模块 | 类型 | 工程师
第2行起：数据行
```

#### 示例Excel内容

| 编号 | 模块 | 类型 | 工程师 |
|-----|------|------|--------|
| 1 | BPS elements | BPS System approach | Zhang Wei |
| 2 | BPS elements | VSM/VSD | Li Na |
| 3 | Investment efficiency_PGL | Premises & Risk Assessment | Chen Ming |
| 4 | Waste-free&stable flow_TPM | TPM program management | Wang Pei |

#### 字段说明

| 字段 | 必填 | 说明 | 示例 |
|------|------|------|------|
| **编号** | 可选 | 序号，用于排序（自动生成display_order） | 1, 2, 3... |
| **模块** | ✅ 必填 | 9大能力模块名称 | BPS elements |
| **类型** | ✅ 必填 | 具体技能名称 | VSM/VSD |
| **工程师** | 可选 | 负责人（当前版本不保存） | Zhang Wei |

#### 9大能力模块名称（必须精确匹配）

```
1. BPS elements
2. Investment efficiency_PGL
3. Investment efficiency_IE
4. Waste-free&stable flow_TPM
5. Waste-free&stable flow_LBP
6. Everybody's CIP
7. Leadership commitment
8. CIP in indirect area_LEAN
9. Digital Transformation
```

#### 下载模板

在系统中点击：**数据导入** → **能力定义导入** → **下载模板**

---

## 🗄️ 方式2：直接SQL插入

### skills表结构

```sql
CREATE TABLE dbo.skills (
  id BIGINT IDENTITY(1,1) PRIMARY KEY,        -- 自增ID
  module_id INT NOT NULL,                      -- 模块ID（1-9）
  module_name NVARCHAR(255) NOT NULL,          -- 模块名称
  skill_name NVARCHAR(255) NOT NULL,           -- 技能名称
  skill_code NVARCHAR(50),                     -- 技能编码（可选）
  description NVARCHAR(MAX),                   -- 描述（可选）
  display_order INT DEFAULT 0,                 -- 显示顺序
  is_active BIT DEFAULT 1,                     -- 是否启用
  created_at DATETIME2 DEFAULT GETDATE(),      -- 创建时间
  updated_at DATETIME2 DEFAULT GETDATE()       -- 更新时间
);
```

### 插入示例

```sql
-- 插入BPS elements的5条记录
INSERT INTO dbo.skills (module_id, module_name, skill_name, display_order, is_active)
VALUES 
  (1, 'BPS elements', 'BPS System approach', 1, 1),
  (1, 'BPS elements', 'VSM/VSD', 2, 1),
  (1, 'BPS elements', 'SMC, Process confirmation, Visual management', 3, 1),
  (1, 'BPS elements', 'Working Standard', 4, 1),
  (1, 'BPS elements', 'Problem solving: 10KK/A3/PSS', 5, 1);

-- 插入Investment efficiency_PGL的5条记录
INSERT INTO dbo.skills (module_id, module_name, skill_name, display_order, is_active)
VALUES 
  (2, 'Investment efficiency_PGL', 'Premises & Risk Assessment', 6, 1),
  (2, 'Investment efficiency_PGL', 'DFMA', 7, 1),
  (2, 'Investment efficiency_PGL', 'LLD', 8, 1),
  (2, 'Investment efficiency_PGL', 'FOL', 9, 1),
  (2, 'Investment efficiency_PGL', 'Scaling', 10, 1);

-- 插入其他模块...
```

### 补充缺失的BPS elements记录

如果您只需要添加缺失的2条BPS elements记录：

```sql
-- 查找当前最大的display_order
SELECT MAX(display_order) FROM dbo.skills WHERE module_name = 'BPS elements';

-- 插入缺失的记录（假设是第1和第4项）
INSERT INTO dbo.skills (module_id, module_name, skill_name, display_order, is_active)
VALUES 
  (1, 'BPS elements', 'BPS System approach', 1, 1),  -- 第1项
  (1, 'BPS elements', 'Working Standard', 4, 1);      -- 第4项

-- 或者，如果您知道具体的技能名称，请替换上面的skill_name
```

---

## 📄 方式3：CSV批量导入

### CSV格式

```csv
module_id,module_name,skill_name,display_order,is_active
1,BPS elements,BPS System approach,1,1
1,BPS elements,VSM/VSD,2,1
1,BPS elements,"SMC, Process confirmation, Visual management",3,1
1,BPS elements,Working Standard,4,1
1,BPS elements,Problem solving: 10KK/A3/PSS,5,1
```

### 注意事项

- ✅ 第一行必须是表头
- ✅ 字段值包含逗号时用双引号包裹
- ✅ 文件编码使用 **UTF-8 with BOM**
- ✅ 保存为 `.csv` 格式

---

## 🔍 数据验证规则

### 必填字段

| 字段 | 验证规则 |
|------|----------|
| `module_id` | 1-9之间的整数 |
| `module_name` | 不能为空，建议使用标准9大模块名 |
| `skill_name` | 不能为空，同一模块下不能重复 |
| `display_order` | 整数，用于排序 |
| `is_active` | 1（启用）或 0（禁用） |

### 约束条件

```sql
-- 唯一约束：同一module_id下skill_name不能重复
CONSTRAINT uq_skills_module_name UNIQUE (module_id, skill_name)

-- 唯一约束：skill_code不能重复（如果使用）
CONSTRAINT uq_skills_code UNIQUE (skill_code)
```

---

## 🎯 完整的BPS elements数据示例

根据您提供的信息，BPS elements应该有5条记录。以下是完整示例：

### Excel格式

| 编号 | 模块 | 类型 | 工程师 |
|-----|------|------|--------|
| 1 | BPS elements | BPS System approach | |
| 2 | BPS elements | VSM/VSD | |
| 3 | BPS elements | SMC, Process confirmation, Visual management | |
| 4 | BPS elements | Working Standard | |
| 5 | BPS elements | Problem solving: 10KK/A3/PSS | |

### SQL格式

```sql
INSERT INTO dbo.skills (module_id, module_name, skill_name, display_order, is_active)
VALUES 
  (1, 'BPS elements', 'BPS System approach', 1, 1),
  (1, 'BPS elements', 'VSM/VSD', 2, 1),
  (1, 'BPS elements', 'SMC, Process confirmation, Visual management', 3, 1),
  (1, 'BPS elements', 'Working Standard', 4, 1),
  (1, 'BPS elements', 'Problem solving: 10KK/A3/PSS', 5, 1);
```

---

## ⚠️ 常见问题

### Q1: 如何确定缺失的2条记录是什么？

**方法1：查看原始导入文件**
- 检查您最初的Excel导入文件
- 确认BPS elements模块下应该有哪5条技能

**方法2：询问数据来源**
- 联系数据提供者确认完整的技能列表
- 参考其他部门或系统的数据

**方法3：查看文档或规范**
- 查看能力评估规范文档
- 确认9大模块39项技能的标准清单

### Q2: 导入后如何验证数据？

```sql
-- 统计每个模块的技能数量
SELECT 
    module_name, 
    COUNT(*) as skill_count,
    STRING_AGG(skill_name, ', ') as skills
FROM dbo.skills
GROUP BY module_name
ORDER BY module_name;

-- 查看BPS elements的所有记录
SELECT * 
FROM dbo.skills 
WHERE module_name = 'BPS elements'
ORDER BY display_order;
```

### Q3: 如何更新display_order？

```sql
-- 重新排序BPS elements的记录
UPDATE dbo.skills 
SET display_order = 1 
WHERE module_name = 'BPS elements' AND skill_name = 'BPS System approach';

UPDATE dbo.skills 
SET display_order = 2 
WHERE module_name = 'BPS elements' AND skill_name = 'VSM/VSD';

-- 以此类推...
```

---

## 📞 需要帮助？

如果您能提供以下信息，我可以帮您准备准确的导入数据：

1. **缺失的2条BPS elements技能名称**
2. **原始Excel文件的截图或内容**
3. **期望的display_order顺序**

示例回复：
```
缺失的2条记录是：
1. BPS System approach（应该在第1位）
4. Working Standard（应该在第4位）
```

---

## 🚀 推荐操作步骤

### 方案A：Web界面导入（简单）
1. 准备完整的Excel文件（包含所有技能）
2. 登录系统 → 数据导入 → 能力定义导入
3. 上传Excel → 预览 → 确认导入
4. 检查导入结果

### 方案B：SQL直接插入（快速）
1. 确认缺失的技能名称
2. 打开SQL Server Management Studio
3. 执行INSERT语句
4. 验证数据

```sql
-- 示例：补充缺失的2条记录
INSERT INTO dbo.skills (module_id, module_name, skill_name, display_order, is_active)
VALUES 
  (1, 'BPS elements', '【技能名称1】', 1, 1),
  (1, 'BPS elements', '【技能名称2】', 4, 1);

-- 验证
SELECT * FROM dbo.skills WHERE module_name = 'BPS elements' ORDER BY display_order;
```

---

## 📝 总结

| 导入方式 | 难度 | 适用场景 |
|---------|------|----------|
| Web界面 | ⭐ 简单 | 首次导入、大量数据、不熟悉SQL |
| SQL插入 | ⭐⭐ 中等 | 补充少量记录、精确控制 |
| CSV导入 | ⭐⭐⭐ 复杂 | 批量更新、自动化脚本 |

**推荐：** 如果只是补充2条记录，使用SQL插入最快速！
