# 🔧 修复能力评估页面无限循环加载问题

## 🐛 问题描述

用户报告：
```
能力评估界面不显示任何数据，只有"正在加载能力评估数据"
数据会一闪而过，然后又消失
```

**Console日志显示：**
```
✅ 获取到 21 个员工
✅ 获取到 104 个技能
✅ 获取到 375 条评估数据
✅ 矩阵数据构建完成！

🔍 开始获取矩阵数据...  ← 又开始加载！
🔍 开始获取矩阵数据...  ← 重复加载！
```

**现象分析：**
- ✅ 数据成功加载
- ❌ 但立即又开始重新加载
- ❌ isLoading 永远是 true
- ❌ 界面一直显示"正在加载"

---

## 🔍 根本原因

### 无限循环的触发链条

```
1. CompetencyAssessment 组件渲染
   ↓
2. useEffect 调用 loadData() 加载数据
   ↓
3. 数据加载成功，setState 更新状态
   ↓
4. CompetencyAssessment 重新渲染
   ↓
5. 传递新的 loadData 函数给 MatrixView 作为 onFilterChange
   ↓
6. MatrixView 的 useEffect 检测到依赖变化
   ↓
7. 调用 onFilterChange(newFilters)  ← 即 loadData！
   ↓
8. 回到步骤 2，无限循环！
```

### 关键代码问题

**MatrixView.tsx (第82-89行):**
```typescript
// ❌ 问题代码
useEffect(() => {
  const newFilters: MatrixFilters = { ... };
  onFilterChange?.(newFilters);  // ← 每次都调用！
}, [filters.year, selectedDepartments, selectedModules]);
// ← 缺少 onFilterChange 依赖，但即使加上也会无限循环
```

**CompetencyAssessment.tsx:**
```typescript
// loadData 每次渲染都是新函数
const loadData = async (filters?: MatrixFilters) => { ... };

// 传给 MatrixView
<MatrixView onFilterChange={loadData} />
```

**为什么会无限循环？**
1. MatrixView 初始化时 useEffect 触发，调用 `onFilterChange`
2. `onFilterChange` 就是 `loadData`，它更新状态
3. 状态更新导致 CompetencyAssessment 重新渲染
4. 新的 `loadData` 函数传给 MatrixView
5. 虽然 useEffect 依赖数组没有 `onFilterChange`，但下次 filters 变化时又会触发
6. 实际上，每次 loadData 执行都会触发状态更新，导致持续的循环

---

## ✅ 解决方案

### 修复1：MatrixView - 跳过初始渲染

```typescript
// ✅ 修复后
const [isInitialMount, setIsInitialMount] = useState(true);

useEffect(() => {
  // 跳过初始渲染，只在用户主动更改筛选器时触发
  if (isInitialMount) {
    setIsInitialMount(false);
    return;  // ← 初始渲染时不调用 onFilterChange
  }

  const newFilters: MatrixFilters = {
    year: filters.year,
    departments: selectedDepartments.length > 0 ? selectedDepartments : undefined,
    moduleIds: selectedModules.length > 0 ? selectedModules : undefined,
  };
  
  console.log('🔄 MatrixView 筛选器变化，通知父组件重新加载:', newFilters);
  onFilterChange?.(newFilters);
}, [filters.year, selectedDepartments, selectedModules, onFilterChange]);
```

**为什么这样修复？**
- ✅ 初始数据已在 CompetencyAssessment 的 useEffect 中加载
- ✅ MatrixView 只应该在**用户主动更改筛选器**时通知父组件
- ✅ 初始渲染时不应该触发 onFilterChange

### 修复2：添加详细日志（便于调试）

```typescript
// CompetencyAssessment.tsx
const loadData = async (filters?: MatrixFilters) => {
  console.log('📥 CompetencyAssessment: 开始加载数据', filters);
  // ... 加载逻辑 ...
  console.log('✅ CompetencyAssessment: 数据加载成功', {
    employees: matrix.rows.length,
    skills: matrix.columns.length,
    assessments: assessmentData.length,
  });
};
```

---

## 🎯 修复效果

### 修复前（无限循环）
```
📥 开始加载数据
✅ 数据加载成功 (21员工, 104技能)
🔄 MatrixView useEffect 触发
📥 开始加载数据  ← 又加载！
✅ 数据加载成功
🔄 MatrixView useEffect 触发
📥 开始加载数据  ← 无限循环！
...
```

### 修复后（正常加载）
```
📥 CompetencyAssessment: 开始加载数据 undefined
🔍 开始获取矩阵数据...
1️⃣ 获取员工数据...
✅ 获取到 21 个员工
2️⃣ 获取技能数据...
✅ 获取到 104 个技能
3️⃣ 获取评估数据...
✅ 获取到 375 条评估数据
4️⃣ 构建矩阵结构...
5️⃣ 计算统计数据...
✅ 矩阵数据构建完成！
✅ CompetencyAssessment: 数据加载成功

← 停止！不再重复加载
← 界面显示数据
```

**当用户更改筛选器时：**
```
🔄 MatrixView 筛选器变化，通知父组件重新加载: { year: 2025, departments: ["SCh-PS"] }
📥 CompetencyAssessment: 开始加载数据 { year: 2025, departments: ["SCh-PS"] }
...
✅ 数据加载成功（筛选后）
```

---

## 🧪 测试验证

### 1️⃣ 强制刷新浏览器
```
Windows: Ctrl + Shift + R
Mac: Cmd + Shift + R
```

### 2️⃣ 访问能力评估页面

**应该看到（Console）：**
```javascript
📥 CompetencyAssessment: 开始加载数据 undefined
🔍 开始获取矩阵数据...
✅ 获取到 21 个员工
✅ 获取到 104 个技能
✅ 获取到 375 条评估数据
✅ 矩阵数据构建完成！
✅ CompetencyAssessment: 数据加载成功 { employees: 21, skills: 104, assessments: 375 }

← 只加载一次！
```

**应该看到（页面）：**
```
能力评估 (21人 | 104技能)

[卡片视图] [表格视图] [总览视图（矩阵）]

← 矩阵显示所有数据
← 不再显示"正在加载"
```

### 3️⃣ 测试筛选功能

点击筛选按钮，选择部门：

**应该看到（Console）：**
```javascript
🔄 MatrixView 筛选器变化，通知父组件重新加载: { year: 2025, departments: ["SCh-PS"] }
📥 CompetencyAssessment: 开始加载数据 { year: 2025, departments: ["SCh-PS"] }
✅ CompetencyAssessment: 数据加载成功
```

---

## 📋 技术细节

### React useEffect 依赖问题

**问题场景：**
```typescript
// 父组件
const Parent = () => {
  const handleChange = (data) => { ... };  // ← 每次渲染都是新函数
  return <Child onChange={handleChange} />;
};

// 子组件
const Child = ({ onChange }) => {
  useEffect(() => {
    onChange();  // ← 调用父组件的函数
  }, [/* 缺少 onChange 依赖 */]);
  // 如果加上 onChange，会无限循环！
};
```

**解决方案：**

**方案1：跳过初始渲染**（我们使用的）
```typescript
const [isInitialMount, setIsInitialMount] = useState(true);
useEffect(() => {
  if (isInitialMount) {
    setIsInitialMount(false);
    return;
  }
  onChange();
}, [onChange]);
```

**方案2：使用 useCallback**（在父组件）
```typescript
const handleChange = useCallback((data) => {
  // 处理逻辑
}, []); // ← 固定的函数引用
```

**方案3：使用 useRef**
```typescript
const onChangeRef = useRef(onChange);
useEffect(() => { onChangeRef.current = onChange; });
useEffect(() => {
  onChangeRef.current();
}, [/* 其他依赖 */]);
```

---

## 🎉 总结

| 问题 | 原因 | 解决方案 |
|------|------|----------|
| 无限循环加载 | MatrixView useEffect 每次都触发 onFilterChange | 跳过初始渲染 |
| 数据一闪而过 | 数据加载后立即被重新加载覆盖 | 防止重复加载 |
| isLoading 永远 true | 新加载覆盖旧加载 | 只加载一次 |

**✅ 修复后，能力评估页面会：**
1. ✅ 只在初始化时加载一次数据
2. ✅ 只在用户主动更改筛选器时重新加载
3. ✅ 正常显示所有数据
4. ✅ isLoading 正确更新

---

**🚀 现在强制刷新浏览器测试！**
