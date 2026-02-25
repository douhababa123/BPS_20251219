# Competency Calculations Skill

**Description**: Calculate competency statistics, gaps, and rankings for team and individual analysis.

**Usage**: Use this skill when implementing or debugging competency analysis features.

## Capabilities

### 1. Team Module Stats
**Function**: `calculateTeamModuleStats(assessments, skills)`

**Calculation**:
```typescript
// Group assessments by module
const moduleGroups = assessments.reduce((acc, assessment) => {
  const skill = skills.find(s => s.id === assessment.skill_id);
  const moduleName = skill?.module_name;
  
  if (!acc[moduleName]) {
    acc[moduleName] = {
      totalCurrent: 0,
      totalTarget: 0,
      totalGap: 0,
      count: 0,
      employeeIds: new Set()
    };
  }
  
  acc[moduleName].totalCurrent += assessment.current_level;
  acc[moduleName].totalTarget += assessment.target_level;
  acc[moduleName].totalGap += assessment.gap;
  acc[moduleName].count++;
  acc[moduleName].employeeIds.add(assessment.employee_id);
  
  return acc;
}, {});

// Calculate averages
return Object.entries(moduleGroups).map(([moduleName, stats]) => ({
  moduleName,
  avgCurrent: stats.totalCurrent / stats.count,
  avgTarget: stats.totalTarget / stats.count,
  totalGap: stats.totalGap,
  avgGap: stats.totalGap / stats.count,
  employeeCount: stats.employeeIds.size,
  skillCount: skills.filter(s => s.module_name === moduleName).length
}));
```

### 2. Personal Module Stats
**Function**: `calculatePersonalModuleStats(employeeId, assessments, skills)`

**Key Metrics**:
- Current level per module
- Target level per module
- Total gap per module
- Average gap per module
- Skill count per module

### 3. Skill-Level Stats
**Function**: `calculateTeamSkillStats(assessments, skills)`

**Returns**:
```typescript
{
  skillId: number,
  skillName: string,
  moduleName: string,
  avgCurrent: number,
  avgTarget: number,
  avgGap: number,
  assessmentCount: number
}
```

### 4. Gap Analysis
**Severity Levels**:
- `totalGap === 0`: ✓ 已达标 (Achieved)
- `totalGap < 5`: ⚠ 轻微差距 (Minor gap)
- `totalGap >= 5`: ⚡ 需提升 (Need improvement)

**Priority Ranking**:
1. Sort by total gap (descending)
2. Show top 10 for recommendations
3. Include module context

## Data Structures

### Assessment Record
```typescript
{
  employee_id: string,
  skill_id: number,
  current_level: 1 | 2 | 3 | 4 | 5,
  target_level: 1 | 2 | 3 | 4 | 5,
  gap: number // target - current
}
```

### Module Stats
```typescript
{
  moduleName: string,
  avgCurrent: number,
  avgTarget: number,
  totalGap: number,
  avgGap: number,
  employeeCount: number,
  skillCount: number
}
```

## Visualization Patterns

### Radar Chart (Module View)
```typescript
const radarData = moduleStats.map(m => ({
  module: m.moduleName,
  current: m.avgCurrent,
  target: m.avgTarget,
  fullMark: 5
}));

<RadarChart data={radarData}>
  <Radar name="Current" dataKey="current" stroke="#3B82F6" fill="#3B82F6" fillOpacity={0.5} />
  <Radar name="Target" dataKey="target" stroke="#EF4444" fill="#EF4444" fillOpacity={0.3} />
</RadarChart>
```

### Bar Chart (Skill View)
```typescript
const barData = skillStats.slice(0, 10).map(s => ({
  name: s.skillName,
  gap: s.avgGap
}));

<BarChart data={barData}>
  <Bar dataKey="gap" fill="#EF4444" />
</BarChart>
```

## Common Calculations

### Average Calculation
```typescript
const avg = values.reduce((sum, v) => sum + v, 0) / values.length;
const formatted = formatNumber(avg, 1); // "3.5"
```

### Ranking
```typescript
const ranked = items
  .sort((a, b) => b.totalGap - a.totalGap)
  .map((item, index) => ({
    ...item,
    rank: index + 1,
    icon: getRankIcon(index + 1) // 🥇 🥈 🥉 or number
  }));
```

### Aggregation
```typescript
const summary = {
  totalEmployees: new Set(assessments.map(a => a.employee_id)).size,
  totalSkills: skills.length,
  avgCurrent: assessments.reduce((sum, a) => sum + a.current_level, 0) / assessments.length,
  avgTarget: assessments.reduce((sum, a) => sum + a.target_level, 0) / assessments.length,
  totalGap: assessments.reduce((sum, a) => sum + a.gap, 0)
};
```

## Performance Tips
1. Use `useMemo` for expensive calculations
2. Cache results by `[assessments, skills]` dependency
3. Debounce filter changes
4. Limit top-N results (e.g., top 10)
5. Pre-calculate in backend for large datasets

## Testing Scenarios
- Empty assessments array
- Single employee vs. team
- All gaps = 0 (fully achieved)
- Mixed modules with varying skill counts
- Edge case: No assessments for a module
