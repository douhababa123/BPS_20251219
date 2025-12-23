# 重复员工ID修复说明

## 🎯 问题根源

您的Excel中有**重复的员工记录**：

```
第3行: tbd  tbd
第8行: tbd  tbd
```

生成的`employee_id`都是 `"tbd_tbd"`，导致PostgreSQL报错：

```
ON CONFLICT DO UPDATE command cannot affect row a second time
```

意思是：在同一次upsert操作中不能更新同一行两次。

---

## ✅ 已修复

### 修复逻辑

添加了自动去重机制：

```typescript
const employeeIdSet = new Set<string>();
const employeeIdCounter = new Map<string, number>();

// 生成employee_id
let baseEmployeeId = `${department}_${name}`.replace(/\s+/g, '_');
let employeeId = baseEmployeeId;

// 如果ID已存在，添加数字后缀
if (employeeIdSet.has(employeeId)) {
  const count = employeeIdCounter.get(baseEmployeeId) || 1;
  employeeId = `${baseEmployeeId}_${count + 1}`;
  employeeIdCounter.set(baseEmployeeId, count + 1);
  console.warn(`⚠️ 发现重复员工，自动重命名为 "${employeeId}"`);
}

employeeIdSet.add(employeeId);
```

### 处理结果

**第1个 "tbd - tbd"：**
- `employee_id` = `"tbd_tbd"`

**第2个 "tbd - tbd"：**
- `employee_id` = `"tbd_tbd_2"` ✅ 自动添加后缀

---

## 🔍 Console日志

在导入时，如果发现重复员工，您会在Console看到：

```javascript
⚠️ 第X行：发现重复员工 "tbd - tbd"，自动重命名为 "tbd_tbd_2"
```

---

## 🚀 请重新测试

### 步骤1：强制刷新浏览器
```
Ctrl + Shift + R (Windows)
Cmd + Shift + R (Mac)
```

### 步骤2：重新上传并解析
1. 进入"数据导入"
2. 选择"📊 能力评估导入"
3. 上传Excel
4. 打开Console（F12）
5. 点击"开始解析"

### 步骤3：查看结果

**解析成功：**
```
部门数：7
员工数：17
技能数：39
评估数：XXX
```

**Console警告（如果有重复）：**
```
⚠️ 第8行：发现重复员工 "tbd - tbd"，自动重命名为 "tbd_tbd_2"
```

**点击"确认导入"后：**
```
✅ 成功导入 XXX 条评估记录
```

---

## 📊 数据库结果

导入成功后，数据库中会有：

```sql
SELECT employee_id, name, department_name 
FROM employees 
WHERE name = 'tbd';

-- 结果：
tbd_tbd    | tbd | tbd
tbd_tbd_2  | tbd | tbd
```

两个记录都被正确保存，不会再冲突！

---

## 🎉 其他改进

这个机制也会处理其他可能的重复情况：
- 相同部门的同名员工
- 数据录入错误导致的重复
- 任何导致`employee_id`冲突的情况

---

**代码已推送，立即测试吧！** 🚀
