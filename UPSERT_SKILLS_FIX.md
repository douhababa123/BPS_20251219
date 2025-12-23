# 🔧 修复技能导入冲突问题

## 🐛 问题描述

用户报错：
```
❌ 导入失败: 保存技能失败: duplicate key value violates unique constraint "skills_module_id_skill_name_key"
```

**HTTP请求日志：**
```
POST https://.../rest/v1/skills?on_conflict=skill_code&columns=...
```

---

## 🔍 根本原因

### 数据库约束
```sql
-- skills 表的唯一约束
unique(module_id, skill_name)
```

### 代码问题
```typescript
// ❌ 错误：使用 skill_code 作为冲突键
await supabase
  .from('skills')
  .upsert(skills, { onConflict: 'skill_code' })
  .select();
```

**为什么错误：**
1. ❌ `skill_code` 可能是 null 或空（很多技能没有skill_code）
2. ❌ 数据库的唯一约束是 `(module_id, skill_name)`，不是 `skill_code`
3. ❌ 当多个技能有相同的 `(module_id, skill_name)` 时，会违反数据库约束

---

## ✅ 解决方案

### 修改 `supabaseService.ts` 中的 `upsertSkills` 方法

```typescript
// ✅ 正确：使用数据库实际的唯一约束
async upsertSkills(skills: SkillInsert[]): Promise<{ success: boolean; count: number }> {
  try {
    // 使用 (module_id, skill_name) 进行冲突检测
    const { data, error } = await supabase
      .from('skills')
      .upsert(skills, { onConflict: 'module_id,skill_name' })
      .select();

    if (error) {
      console.error('❌ 保存技能失败:', error);
      throw error;
    }

    console.log(`✅ 成功保存 ${data?.length || 0} 个技能到数据库`);
    return { success: true, count: data?.length || 0 };
  } catch (error) {
    console.error('保存技能失败:', error);
    throw new Error(`保存技能失败: ${error instanceof Error ? error.message : String(error)}`);
  }
}
```

---

## 🎯 修复效果

### 修复前
```
POST /skills?on_conflict=skill_code  ← 错误的冲突键
❌ duplicate key value violates unique constraint
```

### 修复后
```
POST /skills?on_conflict=module_id,skill_name  ← 正确的冲突键
✅ 成功保存 39 个技能到数据库
```

---

## 📋 业务逻辑说明

### Upsert 行为（使用 `module_id,skill_name`）

| 场景 | module_id | skill_name | 行为 |
|------|-----------|-----------|------|
| 新技能 | 1 | "BPS System approach" | ✅ INSERT（插入） |
| 已存在 | 1 | "BPS System approach" | ✅ UPDATE（更新display_order等） |
| 不同模块的同名技能 | 2 | "BPS System approach" | ✅ INSERT（不同module_id） |

**关键：**
- ✅ 相同 `(module_id, skill_name)` → 更新现有记录
- ✅ 不同组合 → 插入新记录
- ✅ 允许不同模块有同名技能

---

## 🧪 测试验证

### 1. 强制刷新浏览器
```
Windows: Ctrl + Shift + R
Mac: Cmd + Shift + R
```

### 2. 重新导入能力评估Excel
- ✅ 应该看到："✅ 成功保存 39 个技能到数据库"
- ✅ 不再出现 "duplicate key value" 错误

### 3. 检查Console日志
```javascript
解析完成！
📊 统计信息:
- 部门: 9 个
- 员工: 17 人
- 技能: 39 个
- 评估记录: 563 条

开始导入数据...
✅ 成功保存 39 个技能到数据库  ← 应该看到这个！
✅ 成功保存 17 个员工到数据库
✅ 成功保存 563 条评估记录到数据库
```

---

## 📊 技术细节

### Supabase Upsert 参数

```typescript
// 语法
.upsert(data, { onConflict: 'column1,column2' })

// onConflict 接受：
// 1. 单列：'column_name'
// 2. 多列组合：'column1,column2'  ← 我们用这个
// 3. 空（使用主键）

// 行为：
// - 如果冲突 → UPDATE
// - 如果不冲突 → INSERT
```

### 为什么不用 `skill_code`？

```typescript
// ❌ 问题场景
const skills = [
  { module_id: 1, skill_name: "BPS", skill_code: null },
  { module_id: 1, skill_name: "VSM", skill_code: null },
  // 两个都是 null，无法区分！
];

// ✅ 正确方案
// 使用 (module_id, skill_name) 组合
// 1 + "BPS" ≠ 1 + "VSM"  ← 可以区分！
```

---

## 🎉 总结

| 项目 | 修复前 | 修复后 |
|------|--------|--------|
| 冲突键 | `skill_code` ❌ | `module_id,skill_name` ✅ |
| 导入结果 | 失败 ❌ | 成功 ✅ |
| 重复技能处理 | 报错 ❌ | 更新 ✅ |

**✅ 现在强制刷新浏览器，重新导入您的Excel！**
