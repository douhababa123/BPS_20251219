# Excel Import Operations Skill

**Description**: Handle Excel file parsing and data import for skills definitions, competency assessments, and resource planning.

**Usage**: Use this skill when working with Excel import functionality or troubleshooting import errors.

## Capabilities

### 1. Skills Definition Import
**Format**: Vertical format with columns `编号 | 模块 | 类型 | 工程师`

**Parser**: `src/lib/skillDefinitionParser.ts`

**Key Requirements**:
- Column headers must match exactly (Chinese)
- Module names must map to one of 9 predefined modules
- Uses `MODULE_MAPPING` constant for module ID lookup

**Example**:
```
编号  模块                          类型                      工程师
1     BPS elements                 BPS System approach       Wang Ning
2     Investment efficiency        Workplace design          Li Ming
```

### 2. Competency Assessment Import
**Format**: Matrix format with C/T pairs

**Parser**: `src/lib/complexExcelParser.ts`

**Key Requirements**:
- Row 4 (index 3): Department header
- Row 5 (index 4): Skill names
- Row 6 (index 5): C/T markers ("C" for current, "T" for target)
- Row 7+ (index 6+): Employee data

**Structure**:
```
Row 5: Department  Name      [Skill1 C] [Skill1 T] [Skill2 C] [Skill2 T]
Row 6: SNa-PS      Wang Ning  4          4          3          3
```

**Validation**:
- Current level (C) must be 1-5
- Target level (T) must be >= Current level
- Gap = Target - Current

### 3. Resource Planning Import
**Format**: Weekly task assignment matrix

**Parser**: `src/lib/excelResourceParser.ts`

**Key Requirements**:
- Row 1: Headers `姓名 | CW1 | CW2 | CW3...`
- Row 2+: Employee name + task codes
- Supports merged cells for continuous tasks
- Task codes: WS, SW, P, T, C, M, L, SD, A, S, O

**Example**:
```
姓名      CW1  CW2  CW3  CW4
Wang Ning WS   WS   P    T
Li Ming   SW   SW   SW   L
```

## Common Errors & Solutions

### Skills Import
- **"模块不存在"**: Module name doesn't match `MODULE_MAPPING`
- **Solution**: Use exact module names from the 9 predefined modules

### Assessments Import
- **"未找到技能列"**: Wrong row indices for skill names or C/T markers
- **Solution**: Verify Row 5 = skills, Row 6 = C/T markers

### Resource Planning Import
- **"未找到员工"**: Employee name mismatch
- **Solution**: Import employees first, ensure exact name match

## Best Practices
1. Always provide template download function
2. Log parsing steps with emoji (🔍, ✅, ❌)
3. Return detailed error messages with row/column numbers
4. Show preview before final save
5. Validate data types and ranges

## Example Code Patterns

### Skills Definition Parser
```typescript
import { MODULE_MAPPING } from './skillDefinitionParser';

const moduleId = MODULE_MAPPING[moduleName];
if (!moduleId) {
  throw new Error(`模块不存在: ${moduleName}`);
}
```

### Assessment Parser
```typescript
const skillNameRow = 4;
const ctMarkerRow = 5;
const dataStartRow = 6;

// Extract C/T pairs
if (worksheet[cellAddress] === 'C') {
  const current = Number(worksheet[currentCell]);
  const target = Number(worksheet[targetCell]);
  const gap = target - current;
}
```

### Resource Parser
```typescript
// Detect merged cells for continuous tasks
for (let col = 1; col < maxCol; col++) {
  const taskCode = worksheet[cellAddress];
  if (taskCode && TASK_TYPES.includes(taskCode)) {
    // Create task
  }
}
```

## Testing Checklist
- [ ] Handles empty cells gracefully
- [ ] Validates data types (numbers 1-5)
- [ ] Reports row/column of errors
- [ ] Prevents duplicate imports
- [ ] Shows import summary
