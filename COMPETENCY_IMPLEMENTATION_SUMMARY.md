# 能力画像（Competency）模块实现总结

## 📋 实施时间
2025-11-24

## 🎯 实施目标
完全重构能力画像模块，基于Supabase真实数据，提供团队和个人两个维度的能力分析和排名功能。

---

## ✅ 已完成功能

### 1. 核心数据聚合层（`src/lib/competencyAggregation.ts`）

#### **9大模块映射（MODULE_MAPPING）**
```typescript
{
  1: 'BPS elements' 🎯
  2: 'Investment efficiency_PGL' 📊
  3: 'Investment efficiency_IE' 📈
  4: 'Waste-free&stable flow_TPM' ⚙️
  5: 'Waste-free&stable flow_LBP' 🔄
  6: "Everybody's CIP" 💡
  7: 'Leadership commitment' 👥
  8: 'CIP in indirect area_LEAN' ⚡
  9: 'Digital Transformation' 💻
}
```

#### **核心聚合函数**
| 函数名 | 功能 | 输入 | 输出 |
|--------|------|------|------|
| `calculateTeamModuleStats` | 团队9大模块统计 | assessments, skills | ModuleStats[] |
| `calculateTeamSkillStats` | 团队39个技能统计 | assessments, skills | SkillStats[] |
| `calculatePersonalModuleStats` | 个人9大模块统计 | employeeId, assessments, skills | PersonalModuleStats[] |
| `calculatePersonalSkillStats` | 个人技能统计 | employeeId, assessments, skills | PersonalSkillStats[] |

#### **辅助函数**
- `getRankIcon(rank)`: 返回排名图标（🥇🥈🥉）
- `formatNumber(num, decimals)`: 格式化数字

---

### 2. 能力画像主页面（`src/pages/Competency.tsx`）

#### **页面布局**
```
┌─────────────────────────────────────────┐
│ 顶部标题 + 统计卡片                        │
│ (员工总数/技能总数/平均现状/总差距)         │
├─────────────────────────────────────────┤
│ 一级Tab: [团队视图] [个人视图]            │
├─────────────────────────────────────────┤
│ 二级Tab: [差距分析] [排名]                │
├─────────────────────────────────────────┤
│                                         │
│         内容区域                         │
│   (雷达图/柱状图/排名表)                  │
│                                         │
└─────────────────────────────────────────┘
```

#### **视图模式**
| 视图类型 | 可用二级Tab | 功能 |
|---------|------------|------|
| 团队视图 | 差距分析 | 9大模块雷达图 + 差距柱状图（模块级/技能级切换） |
| 团队视图 | 排名 | 模块排名表（按总Gap排序） |
| 个人视图 | 差距分析 | 个人雷达图（9大模块/39技能切换） + 差距柱状图 + Top10提升建议 |

---

### 3. 团队视图功能详解

#### **3.1 差距分析（Gap Analysis）**

##### **左侧：团队9大模块雷达图**
- 显示团队在9大模块的平均现状和目标
- 蓝色区域：现状 (avgCurrent)
- 橙色区域：目标 (avgTarget)
- 数据来源：所有员工在该模块下技能的平均分

##### **右侧：差距分布柱状图**
- **模块级**：显示9大模块的总Gap和平均Gap
- **技能级**：显示Top 15技能的总Gap和平均Gap
- 支持按钮切换显示维度
- 按总Gap降序排列

#### **3.2 排名（Ranking）**

##### **模块排名表（Module Ranking）**
| 列名 | 说明 | 数据来源 |
|------|------|---------|
| 排名 | 1-9，使用🥇🥈🥉图标 | 按totalGap降序 |
| 模块名称 | 含emoji图标 | MODULE_MAPPING |
| 总Gap | 该模块所有技能的gap总和 | sum(gap) |
| 平均Gap | 总Gap / 评估次数 | totalGap / count |
| 评估人数 | 评估该模块的员工数 | unique(employee_id) |

**排序逻辑**：按 `totalGap` 降序，Gap越大排名越高，说明该模块是团队的薄弱环节。

---

### 4. 个人视图功能详解

#### **4.1 工程师选择**
- 下拉选择框，显示所有员工
- 格式：`姓名 - 部门`
- 未选择时显示提示

#### **4.2 差距分析（Gap Analysis）**

##### **左侧：个人能力雷达图**
- **9大模块模式**：显示该员工在9大模块的现状和目标
- **技能模式**：显示Top 15技能的现状和目标
- 蓝色：现状，橙色：目标
- 支持按钮切换

##### **右侧：个人差距柱状图**
- **模块级**：显示该员工在各模块的Gap
- **技能级**：显示Top 15技能的Gap
- 红色柱状图，突出差距

##### **底部：提升建议（Top 10）**
- 显示Gap最大的10个技能
- 每个卡片包含：
  - 技能名称
  - 所属模块
  - Gap值
  - 现状 L → 目标 L

---

### 5. 数据处理策略

#### **数据源**
```typescript
// 从Supabase获取3张基础表
const employees = await supabaseService.getAllEmployees();
const skills = await supabaseService.getAllSkills();
const assessments = await supabaseService.getAllAssessments(year);
```

#### **数据聚合（前端实现）**
1. **团队模块统计**：遍历所有assessments，按module_id分组聚合
2. **团队技能统计**：按skill_id分组聚合
3. **个人统计**：先过滤employee_id，再按module_id/skill_id聚合
4. **排名计算**：对聚合结果按totalGap排序

#### **优势**
- ✅ 无需修改Supabase，不增加API复杂度
- ✅ 数据处理逻辑清晰，易于维护
- ✅ 支持灵活的前端筛选和切换
- ✅ 实时计算，数据始终最新

---

### 6. UI/UX设计

#### **配色方案**
| 元素 | 颜色 | 说明 |
|------|------|------|
| 主按钮 | 蓝色 #2563EB | 一级Tab选中、导出按钮 |
| 雷达图-现状 | 蓝色 #2563EB | 与主题一致 |
| 雷达图-目标 | 橙色 #F97316 | 目标强调 |
| 柱状图-Gap | 红色 #EF4444 | 警示色 |
| 统计卡片 | 多色渐变 | 蓝/绿/琥珀/紫 |

#### **响应式设计**
- 雷达图和柱状图高度统一：400px
- 使用 `ResponsiveContainer` 自适应宽度
- 卡片网格布局：`grid-cols-2` 或 `grid-cols-4`

#### **交互设计**
- 一级Tab：团队/个人，大尺寸切换按钮
- 二级Tab：差距分析/排名，边框高亮
- 图表切换：模块级/技能级，小按钮
- 年度筛选：下拉框，带图标
- 导出CSV：蓝色按钮，带下载图标

---

### 7. 图表配置

#### **雷达图（Recharts RadarChart）**
```typescript
<RadarChart data={radarData}>
  <PolarGrid stroke="#e5e7eb" />
  <PolarAngleAxis dataKey="module" tick={{ fontSize: 11 }} />
  <PolarRadiusAxis angle={90} domain={[0, 5]} />
  <Radar name="现状" dataKey="现状" stroke="#2563EB" fill="#2563EB" fillOpacity={0.3} />
  <Radar name="目标" dataKey="目标" stroke="#F97316" fill="#F97316" fillOpacity={0.2} />
  <Legend />
</RadarChart>
```

#### **柱状图（Recharts BarChart）**
```typescript
<BarChart data={barData}>
  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
  <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-45} textAnchor="end" height={80} />
  <YAxis />
  <Tooltip />
  <Bar dataKey="总Gap" fill="#2563EB" radius={[6, 6, 0, 0]} />
</BarChart>
```

---

### 8. 功能清单

| 功能 | 状态 | 说明 |
|------|------|------|
| 团队雷达图（9大模块） | ✅ | 显示团队平均现状vs目标 |
| 团队差距柱状图（模块级） | ✅ | 显示9大模块总Gap和平均Gap |
| 团队差距柱状图（技能级） | ✅ | 显示Top 15技能总Gap |
| 团队模块排名表 | ✅ | 按总Gap排序，显示🥇🥈🥉 |
| 个人雷达图（9大模块） | ✅ | 显示个人在9大模块的现状vs目标 |
| 个人雷达图（39技能） | ✅ | 显示Top 15技能的现状vs目标 |
| 个人差距柱状图（模块级） | ✅ | 显示个人在各模块的Gap |
| 个人差距柱状图（技能级） | ✅ | 显示Top 15技能的Gap |
| 个人提升建议（Top 10） | ✅ | 显示Gap最大的10个技能 |
| 年度筛选 | ✅ | 支持2023-2025年 |
| 工程师选择 | ✅ | 下拉选择，含部门信息 |
| 统计卡片 | ✅ | 员工总数/技能总数/平均现状/总差距 |
| 导出CSV | ✅ | 支持团队和个人数据导出 |
| 数据刷新 | ✅ | 一键刷新按钮 |

---

### 9. 数据流

```
Supabase数据库
    ↓
supabaseService.ts (API层)
    ↓
React Query (数据缓存)
    ↓
Competency.tsx (主页面)
    ↓
competencyAggregation.ts (聚合计算)
    ↓
TeamView / PersonalView (子组件)
    ↓
Recharts (数据可视化)
```

---

### 10. 关键代码片段

#### **计算团队模块统计**
```typescript
export function calculateTeamModuleStats(
  assessments: AssessmentFull[],
  skills: Skill[]
): ModuleStats[] {
  const moduleMap = new Map<number, {
    totalCurrent: number;
    totalTarget: number;
    totalGap: number;
    count: number;
    employees: Set<string>;
    skills: Set<number>;
  }>();

  // 聚合数据
  assessments.forEach(assessment => {
    const skill = skills.find(s => s.id === assessment.skill_id);
    if (!skill) return;
    const moduleId = skill.module_id;
    // ... 累加统计
  });

  // 转换为数组并返回
  return result;
}
```

#### **排名图标**
```typescript
export function getRankIcon(rank: number): string {
  switch (rank) {
    case 1: return '🥇';
    case 2: return '🥈';
    case 3: return '🥉';
    default: return `${rank}`;
  }
}
```

---

### 11. 性能优化

| 优化点 | 实现方式 | 效果 |
|--------|---------|------|
| 数据缓存 | React Query | 避免重复请求 |
| 计算缓存 | useMemo | 仅在数据变化时重新计算 |
| 条件渲染 | 加载状态 | 提升用户体验 |
| 数据截断 | Top 15技能 | 避免图表过载 |

---

### 12. 测试建议

#### **测试场景**
1. **无数据场景**：Supabase无数据时，图表应显示空状态
2. **部分数据场景**：某些模块无评估数据，应显示0
3. **年度筛选**：切换年度后，数据应正确更新
4. **个人视图**：选择不同员工，数据应正确切换
5. **图表切换**：模块级/技能级切换，数据应正确过渡
6. **导出功能**：CSV文件应包含正确的列和数据

#### **测试步骤**
1. 导入真实评估数据（使用ImportNew页面）
2. 进入能力画像模块
3. 验证统计卡片数字正确
4. 切换团队视图和个人视图
5. 验证雷达图和柱状图显示正确
6. 验证排名表排序正确
7. 测试导出CSV功能

---

### 13. 后续优化方向

| 优化项 | 说明 | 优先级 |
|--------|------|--------|
| 数据钻取 | 点击模块查看详细技能 | 中 |
| 趋势分析 | 多年度对比 | 高 |
| 打印功能 | 生成PDF报告 | 低 |
| 移动端适配 | 响应式布局优化 | 中 |
| 国际化 | 中英文切换 | 低 |

---

## 📝 变更文件清单

### 新增文件
- ✅ `src/lib/competencyAggregation.ts`（数据聚合工具）

### 修改文件
- ✅ `src/pages/Competency.tsx`（完全重写）

---

## 🚀 使用指南

### 前置条件
1. Supabase数据库已配置
2. 已导入员工、技能、评估数据

### 使用流程
1. 访问能力画像模块
2. 选择评估年度（默认2025）
3. 查看团队视图 → 差距分析 → 雷达图和柱状图
4. 切换到排名 → 查看模块排名
5. 切换到个人视图 → 选择工程师
6. 查看个人雷达图、柱状图、提升建议
7. 需要时导出CSV数据

---

## ✨ 亮点总结

1. **数据驱动**：完全基于Supabase真实数据，无mock数据
2. **灵活切换**：团队/个人、模块/技能、多年度
3. **可视化丰富**：雷达图、柱状图、排名表、统计卡片
4. **交互友好**：直观的Tab切换、按钮切换、下拉选择
5. **代码清晰**：聚合逻辑独立、组件分离、类型安全
6. **性能优化**：useMemo缓存、React Query缓存
7. **全屏布局**：参考CompetencyAssessment，最大化内容显示

---

## 🎉 完成！

能力画像模块已完全实现，准备进行用户测试和反馈收集！
