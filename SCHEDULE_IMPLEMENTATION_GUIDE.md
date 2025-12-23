# 📅 BPS工程师日程管理模块 - 完整实施指南

## 🎉 交付总结

**状态**：✅ 100%完成  
**交付时间**：2025-11-24  
**总代码量**：~2000行

---

## 📦 交付清单

### ✅ 数据库层（100%）
- ✅ `SCHEDULE_DATABASE_SCHEMA.sql` - 273行完整SQL
- ✅ 3张数据表：tasks, task_types, factories
- ✅ 自动计算触发器（天数、工时）
- ✅ RLS安全策略

### ✅ 类型定义层（100%）
- ✅ `src/lib/database.types.ts` - 扩展50+行
- ✅ 完整TypeScript接口

### ✅ API服务层（100%）
- ✅ `src/lib/supabaseService.ts` - 扩展260+行
- ✅ 完整CRUD操作
- ✅ 统计计算方法
- ✅ **支持自定义任务类型**

### ✅ 前端页面（100%）
- ✅ `src/pages/Schedule.tsx` - 750+行
- ✅ 任务录入表单
- ✅ 日历视图
- ✅ 团队/个人视图
- ✅ 分析图表
- ✅ CSV导出

### ✅ 路由配置（100%）
- ✅ `src/App.tsx` - 添加schedule路由
- ✅ `src/components/Sidebar.tsx` - 添加导航

---

## 🚀 快速开始（5步）

### 第1步：执行SQL创建数据库表

在Supabase SQL Editor中执行：

```bash
# 打开文件
SCHEDULE_DATABASE_SCHEMA.sql

# 复制所有内容，粘贴到Supabase SQL Editor
# 点击 RUN 按钮
```

**预期结果**：
- ✅ 创建3张表：tasks, task_types, factories
- ✅ 插入8种预设任务类型
- ✅ 插入9个工厂/地点
- ✅ 成功提示："Schedule Management Database Setup Complete!"

---

### 第2步：验证数据库

在Supabase Table Editor中检查：

```sql
-- 验证任务类型表（应有8行）
SELECT * FROM task_types;

-- 验证工厂表（应有9行）
SELECT * FROM factories;

-- 验证任务表（应为空）
SELECT * FROM tasks;
```

---

### 第3步：启动应用

```bash
# 启动开发服务器
npm run dev

# 访问
http://localhost:5173
```

---

### 第4步：导航到日程管理

1. 点击左侧边栏 **"日程管理"**
2. 看到空白的日历页面（正常，因为还没有任务）

---

### 第5步：创建第一个任务

1. 点击 **"新增任务"** 按钮
2. 填写表单：
   - 任务名称：`测试任务1`
   - 任务类型：选择 `Workshop`
   - 任务地点：选择 `FLCNa`
   - 分配工程师：选择任意工程师
   - 开始日期：`2025-01-06`
   - 结束日期：`2025-01-08`
3. 点击 **"保存"**
4. 在日历上看到新任务出现！✨

---

## 📊 核心功能说明

### 1️⃣ 任务录入表单

#### 支持的字段：
| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| 任务名称 | 文本 | ✅ | 自由输入 |
| 任务类型 | 下拉/自定义 | ✅ | 8种预设 + 自定义 |
| 任务地点 | 下拉 | ✅ | 9个工厂 |
| 分配工程师 | 下拉 | ❌ | 可以未分配 |
| 开始日期 | 日期 | ✅ | YYYY-MM-DD |
| 结束日期 | 日期 | ✅ | YYYY-MM-DD |
| 备注 | 文本 | ❌ | 可选 |

#### 自定义任务类型功能：
1. 点击 **"自定义"** 按钮
2. 输入新的任务类型名称（例如：`客户拜访`）
3. 保存后，该类型会自动添加到数据库
4. 下次可以在下拉框中选择

---

### 2️⃣ 团队视图

#### 日历矩阵
```
┌─────────┬────┬────┬────┬────┬─────┐
│ 工程师   │ 1日│ 2日│ 3日│ 4日│ ... │
├─────────┼────┼────┼────┼────┼─────┤
│ 王宁     │[W] │[P] │    │[T] │     │
│ 李华     │    │[W] │[W] │    │[M]  │
│ ...      │    │    │    │    │     │
└─────────┴────┴────┴────┴────┴─────┘

W = Workshop, P = Project, T = Training, M = Meeting
```

- 横轴：日期（1-31）
- 纵轴：工程师
- 单元格：显示该天的任务（鼠标悬停查看详情）
- 颜色：自动分配不同颜色

#### 任务类型占比饼图
- 数据：按任务类型聚合总工时
- 切换：月度/季度/年度
- 交互：鼠标悬停显示小时数

#### 任务地点占比柱状图
- 数据：按工厂聚合总工时
- 显示：柱状图
- X轴：工厂代码
- Y轴：小时数

---

### 3️⃣ 个人视图

#### 个人饱和度看板
```
┌─────────────────────────────────┐
│ 王宁 - 工作饱和度                │
│                                 │
│ 本月饱和度: 85% ⚠️               │
│ ████████████████████░░░░░░░░   │
│ 152h / 176h (8个任务)           │
└─────────────────────────────────┘
```

- **绿色 < 70%**：轻松
- **黄色 70-90%**：适中
- **红色 > 90%**：超负荷

#### 个人任务占比
- **任务类型占比**：饼图
- **任务地点占比**：饼图
- 数据：仅该工程师的任务

---

### 4️⃣ 筛选功能

#### 工程师多选
- 点击工程师名称，选择/取消选择
- 点击 **"全选"** 快速全选/取消
- 只显示选中工程师的任务

#### 月度选择
- 使用日期选择器切换月份
- 自动加载该月的任务

---

### 5️⃣ CSV导出

#### 导出内容
| 列名 | 说明 |
|------|------|
| 任务名称 | 任务名 |
| 类型 | 任务类型 |
| 地点 | 工厂 |
| 工程师 | 分配的工程师 |
| 开始日期 | YYYY-MM-DD |
| 结束日期 | YYYY-MM-DD |
| 天数 | 任务天数 |
| 总工时 | 自动计算 |

#### 文件名格式
```
schedule-2025-01.csv
```

---

## 📋 预设任务类型（8种）

| 代码 | 名称 | 颜色 |
|------|------|------|
| workshop | Workshop | 蓝色 #3B82F6 |
| speed_week | Speed week | 紫色 #8B5CF6 |
| project | Project | 绿色 #10B981 |
| training | Training | 黄色 #F59E0B |
| coaching | Coaching | 红色 #EF4444 |
| meeting | Meeting | 靛蓝 #6366F1 |
| leave | Leave | 灰色 #64748B |
| self_develop | Self-develop | 青色 #14B8A6 |

---

## 🏭 预设工厂/地点（9个）

```
1. FLCNa
2. FLCCh
3. FCGNa
4. FEDNa
5. FCLCh
6. FDCCh
7. GPU-SU
8. EA
9. HA
```

---

## 🔢 工时计算逻辑

### 自动计算公式

```typescript
// 任务天数
days_count = end_date - start_date + 1

// 总工时（每天8小时）
total_hours = days_count × 8

// 例子：
// 开始日期：2025-01-06
// 结束日期：2025-01-08
// 天数：3天
// 总工时：24小时
```

### 饱和度计算公式

```typescript
// 标准工时（每月22个工作日）
standard_hours = 22 × 8 = 176小时

// 实际工时
actual_hours = Σ(该工程师所有任务的total_hours)

// 饱和度
saturation = (actual_hours / standard_hours) × 100%

// 例子：
// 实际工时：152小时
// 饱和度：152 / 176 × 100% = 86.4%
```

---

## 🎯 使用场景示例

### 场景1：新建本地任务

**步骤**：
1. 点击 **"新增任务"**
2. 任务名称：`年度规划会议`
3. 任务类型：`Meeting`
4. 任务地点：`FLCNa`（本地工厂）
5. 分配工程师：`王宁`
6. 开始日期：`2025-01-15`
7. 结束日期：`2025-01-15`（当天）
8. 保存

**结果**：
- 任务创建成功
- 日历上王宁1月15日显示任务
- 自动计算：1天 = 8小时

---

### 场景2：跨工厂支持任务

**步骤**：
1. 点击 **"新增任务"**
2. 任务名称：`FCGNa工厂TPM培训`
3. 任务类型：`Training`
4. 任务地点：`FCGNa`（目标工厂）
5. 分配工程师：`李华`
6. 开始日期：`2025-01-20`
7. 结束日期：`2025-01-24`（5天）
8. 备注：`需要住宿安排`
9. 保存

**结果**：
- 任务创建成功
- 李华1月20-24日显示任务
- 自动计算：5天 = 40小时
- 任务地点统计中FCGNa增加40小时

---

### 场景3：自定义任务类型

**步骤**：
1. 点击 **"新增任务"**
2. 任务名称：`客户拜访`
3. 任务类型：点击 **"自定义"**
4. 输入：`Customer Visit`
5. 任务地点：`EA`
6. 分配工程师：`张三`
7. 开始日期：`2025-01-10`
8. 结束日期：`2025-01-12`
9. 保存

**结果**：
- 任务创建成功
- `Customer Visit` 添加到任务类型表
- 下次可以直接从下拉框选择
- 任务类型占比图中显示新类型

---

### 场景4：查看团队饱和度

**步骤**：
1. 选择月份：`2025-01`
2. 点击 **"全选"**（或选择特定工程师）
3. 查看顶部统计卡片：
   - 本月任务：28个
   - 总工时：456h
   - 团队饱和度：72%（黄色）
4. 查看饱和度颜色：
   - < 70%：绿色，轻松
   - 70-90%：黄色，适中 ✅
   - > 90%：红色，超负荷

---

### 场景5：分析个人工作分布

**步骤**：
1. 切换到 **"个人视图"**
2. 选择工程师：`王宁`
3. 查看：
   - 本月饱和度：85%（黄色）
   - 任务类型占比：
     - Training：40%
     - Workshop：30%
     - Project：20%
     - Meeting：10%
   - 任务地点占比：
     - FLCNa：50%（本地）
     - FCGNa：30%（跨工厂）
     - EA：20%（跨工厂）

**分析**：
- 王宁本月培训任务较多（40%）
- 有50%时间在跨工厂支持
- 饱和度85%，负荷适中

---

## 🔍 数据库表结构详解

### tasks表（任务表）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID | 主键 |
| task_name | TEXT | 任务名称 |
| task_type | TEXT | 任务类型 |
| task_location | TEXT | 任务地点 |
| assigned_employee_id | UUID | 分配的工程师ID（外键） |
| start_date | DATE | 开始日期 |
| end_date | DATE | 结束日期 |
| days_count | INT | 天数（自动计算） |
| hours_per_day | INT | 每天工时（默认8） |
| total_hours | INT | 总工时（自动计算） |
| source | TEXT | 来源（manual/system） |
| status | TEXT | 状态（pending/active/completed/cancelled） |
| is_cross_factory | BOOLEAN | 是否跨工厂 |
| request_factory | TEXT | 发起工厂（如果跨工厂） |
| required_skills | TEXT[] | 需要的技能（如果跨工厂） |
| notes | TEXT | 备注 |
| created_at | TIMESTAMP | 创建时间 |
| updated_at | TIMESTAMP | 更新时间 |

### task_types表（任务类型表）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | SERIAL | 主键 |
| code | TEXT | 代码（唯一） |
| name | TEXT | 名称 |
| color_hex | TEXT | 颜色（十六进制） |
| description | TEXT | 描述 |
| is_system | BOOLEAN | 是否系统预设 |
| is_active | BOOLEAN | 是否启用 |
| created_at | TIMESTAMP | 创建时间 |
| updated_at | TIMESTAMP | 更新时间 |

### factories表（工厂表）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | SERIAL | 主键 |
| code | TEXT | 代码（唯一） |
| name | TEXT | 名称 |
| region | TEXT | 地区 |
| is_active | BOOLEAN | 是否启用 |
| created_at | TIMESTAMP | 创建时间 |
| updated_at | TIMESTAMP | 更新时间 |

---

## 🐛 常见问题排查

### Q1：页面显示空白

**原因**：Supabase表未创建  
**解决**：
1. 打开Supabase SQL Editor
2. 执行 `SCHEDULE_DATABASE_SCHEMA.sql`
3. 验证表创建成功

---

### Q2：任务类型下拉框为空

**原因**：task_types表无数据  
**解决**：
```sql
-- 手动插入预设数据
INSERT INTO task_types (code, name, color_hex, is_system) VALUES
  ('workshop', 'Workshop', '#3B82F6', true),
  ('speed_week', 'Speed week', '#8B5CF6', true),
  ('project', 'Project', '#10B981', true),
  ('training', 'Training', '#F59E0B', true),
  ('coaching', 'Coaching', '#EF4444', true),
  ('meeting', 'Meeting', '#6366F1', true),
  ('leave', 'Leave', '#64748B', true),
  ('self_develop', 'Self-develop', '#14B8A6', true);
```

---

### Q3：工程师下拉框为空

**原因**：employees表无数据  
**解决**：
1. 先导入员工数据（使用数据导入模块）
2. 或手动插入测试数据：
```sql
INSERT INTO employees (employee_id, name, department_id) VALUES
  ('E001', '王宁', 1),
  ('E002', '李华', 1),
  ('E003', '张三', 2);
```

---

### Q4：工时计算不正确

**原因**：触发器未创建或未启用  
**解决**：
```sql
-- 重新创建触发器
CREATE OR REPLACE FUNCTION calculate_task_hours()
RETURNS TRIGGER AS $$
BEGIN
  NEW.days_count := NEW.end_date - NEW.start_date + 1;
  NEW.total_hours := NEW.days_count * NEW.hours_per_day;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_calculate_task_hours ON tasks;
CREATE TRIGGER trigger_calculate_task_hours
  BEFORE INSERT OR UPDATE OF start_date, end_date, hours_per_day
  ON tasks
  FOR EACH ROW
  EXECUTE FUNCTION calculate_task_hours();
```

---

### Q5：日历不显示任务

**原因1**：选择的月份没有任务  
**解决**：创建当前月份的任务

**原因2**：工程师未选中  
**解决**：点击"全选"或选择特定工程师

**原因3**：任务状态不是active  
**解决**：
```sql
-- 检查任务状态
SELECT id, task_name, status FROM tasks;

-- 修改为active
UPDATE tasks SET status = 'active' WHERE id = 'xxx';
```

---

## 🚀 后续优化建议

### 短期（1-2周）
- [ ] 任务编辑功能（点击任务打开编辑弹窗）
- [ ] 任务删除确认对话框
- [ ] 批量导入任务（CSV上传）
- [ ] 任务搜索功能

### 中期（1个月）
- [ ] 跨工厂任务申请流程
- [ ] 任务审批功能
- [ ] 邮件/消息通知
- [ ] 假期管理

### 长期（3个月）
- [ ] 自动任务匹配（基于能力评分）
- [ ] 工作负荷预警
- [ ] 移动端适配
- [ ] 数据报表导出（PDF）

---

## 📝 测试清单

### 基础功能测试
- [ ] 创建任务（所有字段）
- [ ] 创建自定义任务类型
- [ ] 选择工程师
- [ ] 选择月份
- [ ] 工程师多选
- [ ] 切换团队/个人视图

### 日历测试
- [ ] 日历正确显示任务
- [ ] 跨天任务显示正确
- [ ] 单天任务显示正确
- [ ] 多个任务叠加显示

### 统计测试
- [ ] 饱和度计算正确
- [ ] 任务类型占比正确
- [ ] 任务地点占比正确
- [ ] 月度/季度/年度切换

### 导出测试
- [ ] CSV文件生成成功
- [ ] CSV文件内容正确
- [ ] CSV文件名格式正确

---

## 🎉 完成！

您现在拥有了一个**功能完整的BPS工程师日程管理系统**！

### 核心亮点：
- ✅ **双向录入**：手动 + 自动（预留接口）
- ✅ **可视化分析**：日历 + 饱和度 + 占比图
- ✅ **自定义类型**：支持用户自定义任务类型
- ✅ **多维度筛选**：工程师 + 月份
- ✅ **数据导出**：CSV格式
- ✅ **全屏布局**：最大化内容显示

### 使用流程：
1. 执行SQL创建数据库 →
2. 导入员工数据 →
3. 创建任务 →
4. 查看日历和分析 →
5. 导出报告

**开始使用吧！** 🚀

---

## 📞 支持

如有问题，请查阅：
- 本文档的"常见问题排查"部分
- Supabase文档：https://supabase.com/docs
- React Query文档：https://tanstack.com/query/latest

**祝使用愉快！** 😊
