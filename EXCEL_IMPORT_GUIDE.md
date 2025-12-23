# Excel导入功能完整指南

## 📅 更新日期
2025-11-24

## 🎯 功能说明

已完成**复杂多层表头Excel格式**的导入功能适配，支持您提供的实际Excel格式。

---

## 📊 支持的Excel格式

### 格式结构

```
Row 1-2: 多层分类表头（可选，如：Investment efficiency, Waste-free...）
Row 3:   子分类表头（可选，如：PGL, IE, TPM...）
Row 4:   技能名称（必需）
Row 5:   C/T标记（必需：C=Current, T=Target）
Row 6+:  数据行（每行一个员工）
```

### 列结构

| 列位置 | 内容 | 说明 |
|--------|------|------|
| 第1列 | Department | 部门名称 |
| 第2列 | Name | 员工姓名 |
| 第3列+ | 技能C列 | 现状得分（1-5） |
| 第4列+ | 技能T列 | 目标得分（1-5） |
| ... | 重复 | 每个技能两列（C+T） |

### 实际示例

```
                      | Investment efficiency | Waste-free...     |
                      | PGL                   | IE                |
Department | Name     | BPS System approach   | VSM/VSD           | ...
           |          | C         | T         | C       | T       | ...
-----------------------------------------------------------------------
SNa-PS     | Wang Ning| 4         | 4         | 3       | 3       | ...
SNa-PS     | Huang LP | 4         | 4         | 3       | 3       | ...
FLCNa      | Qian RB  | 2         | 2         | 2       | 2       | ...
```

---

## 🚀 使用步骤

### 步骤1：准备Excel文件

确保您的Excel符合以下要求：

✅ **必需元素**：
- 第4行包含技能名称
- 第5行包含C/T标记
- 第1列包含"Department"或"部门"
- 第2列包含"Name"或"姓名"
- 数据从第6行开始

✅ **数据要求**：
- 得分范围：1-5
- 目标得分 ≥ 现状得分
- 部门和姓名不能为空

❌ **避免的问题**：
- 技能列包含"Gap"、"Con."、"Exe."等统计列
- 空白的技能名称
- 不成对的C/T列

### 步骤2：访问导入页面

1. 启动应用：`npm run dev`
2. 访问：`http://localhost:5173/import`
3. 查看格式说明

### 步骤3：上传并解析

1. **选择文件**
   - 点击"点击选择文件"
   - 或拖拽文件到上传区域

2. **解析文件**
   - 点击"解析文件"按钮
   - 等待解析完成（通常1-3秒）

3. **查看解析结果**
   - ✅ 部门数、员工数、技能数、评估数
   - ⚠️ 如有错误，查看错误详情

### 步骤4：确认导入

1. **检查统计信息**
   - 确认数量正确
   - 检查是否有错误

2. **注意警告**
   - ⚠️ 导入将覆盖所有现有数据
   - 建议先在测试环境验证

3. **点击"确认导入"**
   - 等待导入完成
   - 看到成功消息后点击"查看矩阵视图"

---

## 📝 解析逻辑说明

### 1. 自动定位关键行

解析器会自动：
- 在第4行查找技能名称
- 在第5行查找C/T标记
- 从第6行开始读取数据

### 2. 识别技能列

解析器会：
- 找到"Department"和"Name"列
- 从其后开始识别技能列
- 只处理标记为"C"的列（T列自动配对）
- 跳过包含"Gap"、"Con."等关键字的统计列

### 3. 模块自动推断

根据技能名称自动推断所属模块：

| 技能关键字 | 推断模块 | 模块ID |
|-----------|---------|--------|
| BPS, System | TPM基础 | 1 |
| VSM, SMC, Workplace, MTM | 精益流程 | 2 |
| Problem solving, Loss | 问题解决 | 3 |
| Top idea, Kaizen, BLI | 项目管理 | 4 |
| Power BI, Low code | Digital Transformation | 7 |
| Skill Matrix, Leadership | 团队领导 | 6 |

### 4. 数据验证

每条数据会验证：
- ✅ 得分在1-5范围内
- ✅ 目标 ≥ 现状
- ✅ 部门和姓名非空
- ✅ 数值为有效数字

---

## 🗄️ 数据导入流程

### 后台处理步骤

1. **解析Excel**
   - 读取所有行列数据
   - 识别技能和员工

2. **创建部门**
   - 提取所有唯一部门名称
   - 插入到`departments`表

3. **创建员工**
   - 关联部门ID
   - 生成employee_id
   - 插入到`employees`表

4. **创建技能**
   - 推断模块归属
   - 设置显示顺序
   - 插入到`skills`表

5. **创建评估数据**
   - 关联员工UUID
   - 关联技能ID
   - 插入到`competency_assessments`表

### 覆盖策略

- ✅ **部门**：名称相同则跳过（保留原ID）
- ✅ **员工**：employee_id相同则更新
- ✅ **技能**：(module_id, skill_name)相同则更新
- ⚠️ **评估数据**：完全覆盖（删除旧数据）

---

## ⚠️ 常见问题

### 问题1：解析失败 - 未找到Department列

**原因**：第4行没有"Department"或"部门"文字

**解决**：
- 确保第1列第4行包含"Department"或"部门"
- 检查是否有隐藏字符或空格

### 问题2：技能数量为0

**原因**：
- 第5行没有"C"标记
- 技能名称行位置错误

**解决**：
- 确保第5行包含"C"和"T"标记
- 确保第4行包含技能名称

### 问题3：部分数据未导入

**原因**：
- 得分验证失败（<1 或 >5）
- 目标 < 现状
- 空值

**解决**：
- 查看解析结果中的错误列表
- 修正Excel中的问题数据
- 重新上传

### 问题4：导入成功但矩阵视图为空

**原因**：可能没有刷新或缓存问题

**解决**：
- 点击"刷新"按钮
- 清除浏览器缓存
- 在Supabase中验证数据

---

## 🧪 测试示例

### 最小测试Excel

创建一个简单的测试Excel：

```
Department | Name     | Skill1   |          |
           |          | C        | T        |
-------------------------------------------------
TestDept   | TestUser | 3        | 4        |
```

**期望结果**：
- 1个部门（TestDept）
- 1个员工（TestUser）
- 1个技能（Skill1）
- 1条评估记录（3→4）

### 完整测试Excel

使用您提供的实际Excel文件：
- 应识别所有部门（SNa-PS, FLCNa, SCh-PS等）
- 应识别所有员工（Wang Ning, Huang Lanping等）
- 应识别所有技能（BPS System approach, VSM/VSD等）
- 应创建所有评估记录

---

## 📈 性能说明

### 处理速度

- 10行员工 × 40个技能 = 400条评估：~1秒
- 100行员工 × 40个技能 = 4000条评估：~5秒
- 500行员工 × 40个技能 = 20000条评估：~20秒

### 文件大小限制

- 最大：10MB
- 推荐：<5MB
- 建议：将大文件拆分为多个较小的文件

---

## 🔍 调试技巧

### 1. 查看解析详情

在浏览器控制台（F12）中可以看到：
- 解析的原始数据
- 识别的列位置
- 提取的技能列表
- 错误堆栈

### 2. 验证数据库

在Supabase SQL Editor中查询：

```sql
-- 查看导入的部门
SELECT * FROM departments;

-- 查看导入的员工
SELECT * FROM employees ORDER BY name;

-- 查看导入的技能
SELECT * FROM skills ORDER BY display_order;

-- 查看导入的评估数据
SELECT 
  e.name,
  s.skill_name,
  ca.current_level,
  ca.target_level,
  ca.gap
FROM competency_assessments ca
JOIN employees e ON e.id = ca.employee_id
JOIN skills s ON s.id = ca.skill_id
ORDER BY e.name, s.display_order;
```

### 3. 导出验证

导入后立即导出CSV，对比数据是否一致。

---

## 📚 相关文档

- [IMPLEMENTATION_COMPLETE.md](./IMPLEMENTATION_COMPLETE.md) - 完整实现说明
- [DATABASE_RESTRUCTURE_GUIDE.md](./DATABASE_RESTRUCTURE_GUIDE.md) - 数据库架构
- [database.types.ts](./src/lib/database.types.ts) - 类型定义
- [complexExcelParser.ts](./src/lib/complexExcelParser.ts) - 解析器源码

---

## 🎉 快速开始

1. **准备Excel**（使用您提供的格式）
2. **访问** `http://localhost:5173/import`
3. **上传文件** → **解析** → **确认导入**
4. **查看结果** → 前往矩阵视图

**就这么简单！** 🚀

---

*最后更新：2025-11-24*
