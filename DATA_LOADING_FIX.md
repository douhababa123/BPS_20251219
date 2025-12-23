# 🔧 修复能力评估数据加载问题

## 🐛 问题描述

用户报告：
```
点击能力评估模块，一直显示 正在加载能力评估数据
界面一闪一下，还是停留在 正在加载能力评估数据
```

**Console错误：**
```
Failed to load data: Error: 获取员工失败: TypeError: NetworkError when attempting to fetch resource.
Failed to load data: Error: 获取技能失败: TypeError: NetworkError when attempting to fetch resource.
Failed to load data: Error: 获取评估数据失败: TypeError: NetworkError when attempting to fetch resource.
```

---

## 🔍 根本原因

### 问题1：使用了不存在的数据库视图

```typescript
// ❌ 旧代码
async getAllAssessments(year?: number): Promise<AssessmentFull[]> {
  let query = supabase
    .from('view_assessments_full')  // ← 这个视图可能不存在或权限不足
    .select('*');
  ...
}
```

**为什么会失败：**
1. ❌ `view_assessments_full` 视图可能未创建
2. ❌ 即使创建了，RLS策略可能未配置
3. ❌ 视图依赖的表可能有问题

### 问题2：缺少详细的错误日志

旧代码在出错时只抛出简单的错误信息，无法诊断具体哪一步失败了。

---

## ✅ 解决方案

### 修复1：直接查询表，不使用视图

```typescript
// ✅ 新代码 - 直接查询表
async getAllAssessments(year?: number): Promise<AssessmentFull[]> {
  try {
    console.log('📊 开始获取评估数据...', year ? `年份: ${year}` : '所有年份');
    
    let query = supabase
      .from('competency_assessments')  // ← 直接查询表
      .select(`
        id,
        employee_id,
        skill_id,
        current_level,
        target_level,
        gap,
        assessment_year,
        employees!inner (
          id,
          employee_id,
          name,
          department_id,
          departments (
            id,
            name,
            code
          )
        ),
        skills!inner (
          id,
          module_id,
          module_name,
          skill_name,
          display_order
        )
      `);

    if (year) {
      query = query.eq('assessment_year', year);
    }

    const { data, error } = await query;

    if (error) {
      console.error('❌ 获取评估数据失败:', error);
      throw error;
    }

    console.log(`✅ 成功获取 ${data?.length || 0} 条评估数据`);

    // 转换数据结构为 AssessmentFull 格式
    const assessments: AssessmentFull[] = (data || []).map((item: any) => ({
      id: item.id,
      employee_id: item.employees.id,
      employee_code: item.employees.employee_id,
      employee_name: item.employees.name,
      department_name: item.employees.departments?.name || '',
      department_code: item.employees.departments?.code || '',
      skill_id: item.skill_id,
      module_id: item.skills.module_id,
      module_name: item.skills.module_name,
      skill_name: item.skills.skill_name,
      display_order: item.skills.display_order,
      current_level: item.current_level,
      target_level: item.target_level,
      gap: item.gap,
      assessment_year: item.assessment_year,
      assessment_date: item.assessment_date,
      notes: item.notes,
      created_at: item.created_at,
      updated_at: item.updated_at,
    }));

    return assessments;
  } catch (error: any) {
    console.error('❌ 获取评估数据失败:', error);
    throw new Error(`获取评估数据失败: ${error.message}`);
  }
}
```

**优势：**
- ✅ 不依赖视图（更简单、更可靠）
- ✅ 使用 Supabase 的关联查询（`!inner`）
- ✅ 数据结构转换清晰明确
- ✅ 详细的错误日志

### 修复2：在 getMatrixData 中添加详细日志

```typescript
async getMatrixData(filters?: MatrixFilters): Promise<{...}> {
  try {
    console.log('🔍 开始获取矩阵数据...', filters);
    const year = filters?.year || new Date().getFullYear();

    // 1. 获取所有员工
    console.log('1️⃣ 获取员工数据...');
    // ... 查询代码 ...
    console.log(`✅ 获取到 ${employeesData?.length || 0} 个员工`);

    // 2. 获取所有技能
    console.log('2️⃣ 获取技能数据...');
    // ... 查询代码 ...
    console.log(`✅ 获取到 ${skillsData?.length || 0} 个技能`);

    // 3. 获取所有评估数据
    console.log('3️⃣ 获取评估数据...');
    // ... 查询代码 ...
    console.log(`✅ 获取到 ${assessmentsData?.length || 0} 条评估数据`);

    // 4. 构建矩阵数据结构
    console.log('4️⃣ 构建矩阵结构...');
    // ... 构建代码 ...

    // 5. 计算统计数据
    console.log('5️⃣ 计算统计数据...');
    const stats = await this.getOverallStats(year);

    console.log('✅ 矩阵数据构建完成！', {
      rows: rows.length,
      columns: columns.length,
      stats,
    });

    return { rows, columns, stats };
  } catch (error: any) {
    console.error('❌ 获取矩阵数据失败:', error);
    throw new Error(`获取矩阵数据失败: ${error.message}`);
  }
}
```

### 修复3：添加数据库诊断页面

创建了 `DatabaseCheck.tsx` 页面，用于：
- ✅ 测试Supabase连接
- ✅ 检查所有表的数据
- ✅ 验证关联查询
- ✅ 显示样例数据

**访问方式：**
```
在浏览器Console运行：
window.location.hash = '#dbcheck'

或在代码中临时修改 App.tsx 的 currentPage 初始值为 'dbcheck'
```

---

## 🚀 修复后的使用流程

### 1️⃣ 强制刷新浏览器
```
Windows: Ctrl + Shift + R
Mac: Cmd + Shift + R
```

### 2️⃣ 访问数据库诊断页面

**方法1：在Console执行**
```javascript
// 在浏览器Console（F12）中运行
const pages = document.querySelector('[data-page]');
// 或者直接修改URL（如果使用路由）
```

**方法2：临时修改代码**
```typescript
// 在 src/App.tsx 中临时修改：
const [currentPage, setCurrentPage] = useState<keyof typeof pages>('dbcheck'); // ← 改为 'dbcheck'
```

### 3️⃣ 点击"开始检查"按钮

应该看到：
```
📡 连接状态
  URL: https://wpbgzcmpwsktoaowwkpj.supabase.co
  Key: sb_publishable_ytPCy...
  状态: ✅ 正常

📊 数据表状态
  departments ✅
    记录数: 9
  
  employees ✅
    记录数: 17
  
  skills ✅
    记录数: 39
  
  competency_assessments ✅
    记录数: 563

✅ 所有检查通过！
```

### 4️⃣ 访问能力评估页面

切换到能力评估页面，应该看到：

**Console日志：**
```javascript
🔍 开始获取矩阵数据...
1️⃣ 获取员工数据...
✅ 获取到 17 个员工
2️⃣ 获取技能数据...
✅ 获取到 39 个技能
3️⃣ 获取评估数据...
✅ 获取到 563 条评估数据
4️⃣ 构建矩阵结构...
5️⃣ 计算统计数据...
📊 开始获取评估数据... 年份: 2025
✅ 成功获取 563 条评估数据
✅ 矩阵数据构建完成！

📊 开始获取评估数据... 所有年份
✅ 成功获取 563 条评估数据
```

**页面显示：**
```
能力评估 (17人 | 39技能)
[卡片视图] [表格视图] [总览视图（矩阵）]

← 应该能看到数据！
```

---

## 🔍 如果还是失败

### 检查1：环境变量
```javascript
// 在Console运行
console.log('URL:', import.meta.env.VITE_SUPABASE_URL);
console.log('KEY:', import.meta.env.VITE_SUPABASE_ANON_KEY);

// 应该看到：
// URL: https://wpbgzcmpwsktoaowwkpj.supabase.co
// KEY: sb_publishable_ytPCyU2oEoHxYQYBPdC-8A_QskBu-l4
```

### 检查2：数据库中是否有数据
```sql
-- 在Supabase SQL Editor中运行
select 'employees' as table_name, count(*) as count from employees
union all
select 'skills', count(*) from skills
union all
select 'competency_assessments', count(*) from competency_assessments;

-- 应该看到：
-- employees: 17
-- skills: 39
-- competency_assessments: 563 (或其他非0值)
```

### 检查3：RLS策略
```sql
-- 检查RLS策略
select tablename, policyname 
from pg_policies 
where schemaname = 'public';

-- 应该至少包含：
-- employees | Public read on active employees
-- skills | Public read on active skills
-- competency_assessments | Public read on assessments
```

---

## 📋 技术细节

### Supabase 关联查询语法

```typescript
// !inner 表示 INNER JOIN
.select(`
  id,
  employees!inner (
    id,
    name,
    departments (  // 嵌套关联
      name
    )
  )
`)

// 等价于SQL：
SELECT 
  ca.id,
  e.id, e.name,
  d.name
FROM competency_assessments ca
INNER JOIN employees e ON ca.employee_id = e.id
LEFT JOIN departments d ON e.department_id = d.id
```

### 为什么不用视图？

| 方案 | 优势 | 劣势 |
|------|------|------|
| **视图** | 复杂逻辑封装 | 需要额外创建、RLS配置复杂、调试困难 |
| **直接查询** | 简单明了、易调试、不需要额外设置 | 查询稍长 |

**结论：** 对于当前需求，直接查询表更合适。

---

## 🎉 总结

| 修复项 | 修复前 | 修复后 |
|--------|--------|--------|
| 数据查询 | 依赖视图 ❌ | 直接查询表 ✅ |
| 错误日志 | 简单错误信息 ❌ | 详细步骤日志 ✅ |
| 诊断工具 | 无 ❌ | 数据库检查页面 ✅ |
| 错误处理 | 部分缺失 ❌ | 完整try-catch ✅ |

**✅ 现在强制刷新浏览器，访问数据库诊断页面，然后再尝试能力评估页面！**
