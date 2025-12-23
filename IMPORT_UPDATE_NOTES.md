# 导入功能更新说明

## 问题
用户反馈：数据导入页面只显示单一导入类型，没有显示"能力定义"和"能力评估"两种不同的Excel文件类型导入选项。

## 根本原因
- 用户实际访问的是 `ImportNew.tsx` 页面（侧边栏配置为 `importNew`）
- 之前的修改错误地更新了 `Import.tsx`，但用户看到的是 `ImportNew.tsx`
- 导致双类型导入功能没有生效

## 解决方案
将双类型导入功能正确集成到 `ImportNew.tsx` 中。

---

## ✅ 已实现功能

### 1. **双卡片类型选择器**
用户现在可以在页面顶部看到两个大型卡片：

#### 📋 能力定义导入（蓝色主题）
- **格式**: 编号 | 模块 | 类型 | 工程师
- **用途**: 导入39个能力类型定义
- **示例**: 
  ```
  1 | BPS elements | BPS System approach | Wang Ning
  2 | Investment efficiency_PGL | DFMA | Gu Xuan
  ```

#### 📊 能力评估导入（绿色主题）
- **格式**: 横向矩阵（Department | Name | C/T对...）
- **用途**: 导入员工的能力评估数据
- **特点**: 每个技能占两列（C=Current, T=Target）

### 2. **视觉化区分**
- **选中状态**: 卡片放大、边框高亮、显示"已选择"标签
- **颜色编码**: 蓝色=能力定义，绿色=能力评估
- **动画效果**: 平滑过渡和缩放效果

### 3. **动态格式说明**
根据选择的导入类型，动态显示对应的Excel格式要求：

**能力定义格式说明包含：**
- 表头结构
- 列定义详解
- 9大能力模块列表

**能力评估格式说明包含：**
- 横向矩阵结构
- 列定义说明
- 注意事项（得分范围、覆盖警告）

### 4. **增强的上传体验**
- **大型上传区域**: 更明显的拖拽区
- **文件信息显示**: 文件名 + 大小
- **解析按钮**: 根据选择类型变色（蓝/绿）
- **加载状态**: 旋转动画 + 进度提示

### 5. **详细的解析结果**
#### 能力定义解析结果：
- 能力总数统计
- 模块数统计
- 带图标的卡片展示

#### 能力评估解析结果：
- 部门数
- 员工数
- 技能数
- 评估数
- 4个独立的统计卡片

### 6. **错误处理**
- **错误列表**: 清晰显示所有错误
- **行号定位**: 精确到错误所在行
- **字段标注**: 显示错误相关字段
- **可滚动**: 处理大量错误的情况

### 7. **导入确认**
- **警告提示**: 
  - 能力定义：说明会更新现有记录
  - 能力评估：警告会覆盖所有数据
- **状态反馈**: 成功/失败消息
- **后续操作**: 成功后提供"查看能力评估"和"继续导入"按钮

---

## 🎨 UI/UX 改进

### 卡片选择器
```
┌─────────────────────────────┐  ┌─────────────────────────────┐
│ 📋 能力定义导入 [已选择]     │  │ 📊 能力评估导入              │
│                             │  │                             │
│ 导入9大能力模块和39个       │  │ 导入员工的能力评估数据       │
│ 能力类型定义                │  │ （横向矩阵格式）             │
│                             │  │                             │
│ • 格式：编号|模块|类型...   │  │ • 格式：Dept|Name|C/T...    │
│ • 示例：1|BPS elements...   │  │ • 包含：部门、员工、技能...  │
└─────────────────────────────┘  └─────────────────────────────┘
    (蓝色高亮，放大)                  (灰色，正常大小)
```

### 格式说明面板
- **分层展示**: 表头结构 → 列定义 → 注意事项
- **颜色区分**: 白色卡片 + 彩色边框
- **字体层级**: 标题加粗，内容清晰

### 上传区域
- **大图标**: 12x12的上传图标
- **彩色背景**: 蓝色/绿色圆形背景
- **文件预览**: 显示文件名和大小

---

## 🔄 工作流程

### 导入能力定义
```
1. 点击"📋 能力定义导入"卡片
   ↓
2. 阅读蓝色格式说明面板
   ↓
3. 上传Excel文件（编号|模块|类型|工程师）
   ↓
4. 点击"开始解析"
   ↓
5. 查看解析结果（能力总数、模块数）
   ↓
6. 确认无误后点击"确认导入到数据库"
   ↓
7. 成功：显示"✅ 成功导入 XX 个能力定义"
```

### 导入能力评估
```
1. 点击"📊 能力评估导入"卡片
   ↓
2. 阅读绿色格式说明面板
   ↓
3. 上传Excel文件（横向矩阵格式）
   ↓
4. 点击"开始解析"
   ↓
5. 查看解析结果（部门、员工、技能、评估统计）
   ↓
6. 阅读覆盖警告
   ↓
7. 点击"确认导入到数据库"
   ↓
8. 成功：显示"✅ 成功导入 XX 条评估记录"
   ↓
9. 点击"查看能力评估"跳转到评估页面
```

---

## 📊 数据流

```
用户选择导入类型
        │
        ├─→ 能力定义
        │   │
        │   ├─ 上传Excel
        │   ├─ parseSkillDefinition()
        │   ├─ 解析为SkillDefinition[]
        │   ├─ supabaseService.upsertSkills()
        │   └─ 写入skills表
        │
        └─→ 能力评估
            │
            ├─ 上传Excel
            ├─ parseComplexExcel()
            ├─ 解析为ParsedExcelData
            ├─ supabaseService.importFromExcel()
            └─ 写入4张表
                ├─ departments
                ├─ employees
                ├─ skills
                └─ competency_assessments
```

---

## 🚀 技术实现

### 状态管理
```typescript
const [importType, setImportType] = useState<'skills' | 'assessments'>('assessments');
const [file, setFile] = useState<File | null>(null);
const [skillResult, setSkillResult] = useState<SkillParseResult | null>(null);
const [assessmentResult, setAssessmentResult] = useState<AssessmentParseResult | null>(null);
const [isLoading, setIsLoading] = useState(false);
const [uploadStatus, setUploadStatus] = useState<'idle' | 'success' | 'error'>('idle');
```

### 动态类型切换
```typescript
// 切换导入类型时清空所有状态
onClick={() => {
  setImportType('skills'); // or 'assessments'
  setFile(null);
  setSkillResult(null);
  setAssessmentResult(null);
  setUploadStatus('idle');
}}
```

### 条件渲染
```typescript
// 根据importType渲染不同的内容
{importType === 'skills' ? (
  <SkillsFormatGuide />
) : (
  <AssessmentsFormatGuide />
)}
```

### 样式动态切换
```typescript
className={`... ${
  importType === 'skills'
    ? 'border-blue-600 bg-gradient-to-br from-blue-50 to-blue-100'
    : 'border-green-600 bg-gradient-to-br from-green-50 to-green-100'
}`}
```

---

## 📝 代码变更

### 文件修改
- ✅ `src/pages/ImportNew.tsx` - 完全重写，集成双类型导入

### 核心改动
1. **添加导入类型选择**: `ImportType = 'skills' | 'assessments'`
2. **双结果状态**: `skillResult` 和 `assessmentResult`
3. **动态解析逻辑**: 根据类型调用不同的解析器
4. **条件渲染**: 格式说明、统计卡片、确认消息
5. **视觉增强**: 大型卡片选择器、颜色编码、动画效果

---

## ✅ 测试清单

- [x] 编译成功（无TypeScript错误）
- [x] 能力定义卡片可点击切换
- [x] 能力评估卡片可点击切换
- [x] 格式说明动态更新
- [x] 上传按钮颜色跟随类型变化
- [ ] 实际上传能力定义Excel测试
- [ ] 实际上传能力评估Excel测试
- [ ] 错误处理测试
- [ ] 成功导入后跳转测试

---

## 🎉 用户现在可以看到

1. **明确的两个导入选项** - 大型卡片，无法错过
2. **清晰的视觉区分** - 蓝色vs绿色，选中高亮
3. **详细的格式说明** - 每种类型都有完整的指南
4. **友好的上传体验** - 大型拖拽区，文件预览
5. **完整的反馈流程** - 解析结果 → 确认 → 成功/失败

---

## 📖 相关文档
- **完整实现指南**: `FINAL_IMPLEMENTATION_GUIDE.md`
- **能力定义解析器**: `src/lib/skillDefinitionParser.ts`
- **评估数据解析器**: `src/lib/complexExcelParser.ts`

---

**问题已解决！用户现在可以清楚地看到并选择两种不同的导入类型。** ✅
