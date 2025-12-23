# 🔧 日程管理模块修复指南

## 📝 问题描述

用户反馈：
1. ❌ 新增任务表单中，任务类型下拉框为空
2. ❌ 新增任务表单中，任务地点下拉框为空

---

## 🔍 问题分析

### 代码检查结果：✅ 代码逻辑正确

```typescript
// 日程管理页面正确查询了数据
const { data: taskTypes = [] } = useQuery({
  queryKey: ['task-types'],
  queryFn: () => supabaseService.getAllTaskTypes(),
});

const { data: factories = [] } = useQuery({
  queryKey: ['factories'],
  queryFn: () => supabaseService.getAllFactories(),
});

// TaskFormModal正确使用了props
{taskTypes.map((type: any) => (
  <option key={type.id} value={type.code}>
    {type.name}
  </option>
))}
```

### 根本原因：❌ 数据库表为空

数据库中 `task_types` 和 `factories` 表可能没有预设数据。

---

## ✅ 解决方案（2步）

### 第1步：插入预设数据（必须！）

在Supabase SQL Editor执行：

```sql
-- 打开文件：FIX_SCHEDULE_DATA.sql
-- 复制全部内容，粘贴到SQL Editor
-- 点击 RUN ▶️
```

**这个脚本会**：
- ✅ 检查现有数据
- ✅ 插入8种任务类型
- ✅ 插入9个工厂/地点
- ✅ 显示验证结果

**预期输出**：
```
✅ task_types表数据: 8
✅ factories表数据: 9
```

---

### 第2步：刷新浏览器并测试

```bash
1. 强制刷新浏览器（Ctrl+Shift+R）
2. 访问"日程管理"模块
3. 点击"新增任务"按钮
4. 查看下拉选项
```

**预期结果**：
- ✅ 任务类型：8个选项（Workshop, Speed week, Project, Training...）
- ✅ 任务地点：9个选项（FLCNa, FLCCh, FCGNa...）

---

## 📊 预设数据明细

### 8种任务类型

| 代码 | 名称 | 颜色 |
|------|------|------|
| workshop | Workshop | 蓝色 #3B82F6 |
| speed_week | Speed week | 紫色 #8B5CF6 |
| project | Project | 绿色 #10B981 |
| training | Training | 橙色 #F59E0B |
| coaching | Coaching | 红色 #EF4444 |
| meeting | Meeting | 靛蓝 #6366F1 |
| leave | Leave | 灰色 #64748B |
| self_develop | Self-develop | 青色 #14B8A6 |

---

### 9个工厂/地点

| 代码 | 名称 | 地区 |
|------|------|------|
| FLCNa | 福特林肯北美 | 北美 |
| FLCCh | 福特林肯中国 | 中国 |
| FCGNa | 福特商用车北美 | 北美 |
| FEDNa | 福特电动北美 | 北美 |
| FCLCh | 福特商用车中国 | 中国 |
| FDCCh | 福特设计中国 | 中国 |
| GPU-SU | GPU供应商 | 全球 |
| EA | EA | 全球 |
| HA | HA | 全球 |

---

## 🔍 验证数据（在Supabase）

执行完SQL后，验证数据是否插入成功：

```sql
-- 查询任务类型
SELECT * FROM task_types WHERE is_active = true;

-- 查询工厂
SELECT * FROM factories WHERE is_active = true;
```

---

## 📅 月份选择功能

**已实现**：✅ 日程管理模块已支持月份选择

位置：顶部筛选区域
```html
<input
  type="month"
  value={selectedDate}
  onChange={(e) => setSelectedDate(e.target.value)}
/>
```

功能：
- ✅ 选择月份（如2025-01）
- ✅ 自动查询该月的任务
- ✅ 更新日历视图
- ✅ 更新统计数据

---

## 🎯 完整测试清单

执行完SQL后，测试以下功能：

### 日程显示
- [ ] 选择不同月份，数据自动更新
- [ ] 日历矩阵正确显示任务
- [ ] 统计卡片显示正确数据

### 新增任务
- [ ] 点击"新增任务"按钮
- [ ] 任务类型下拉框有8个选项
- [ ] 任务地点下拉框有9个选项
- [ ] 工程师下拉框有数据
- [ ] 保存任务成功

### 数据查询
- [ ] 切换月份，查询正确数据
- [ ] 筛选工程师，显示正确数据
- [ ] 导出CSV功能正常

---

## 🚀 立即执行

```bash
1. 在Supabase执行：FIX_SCHEDULE_DATA.sql
2. 刷新浏览器：Ctrl+Shift+R
3. 访问"日程管理"
4. 测试功能
```

---

**执行完告诉我结果！** ✅
