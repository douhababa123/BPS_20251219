# 🔴 网络错误诊断指南

## 🐛 错误现象

```
Failed to load data: Error: 获取员工失败: TypeError: NetworkError when attempting to fetch resource.
```

**症状：**
- ✅ 能力评估导入功能正常（说明Supabase配置在导入时是工作的）
- ❌ 能力评估查看页面一直加载
- ❌ 所有fetch请求都失败

---

## 🔍 可能原因

### 1️⃣ **Supabase环境变量未加载**（最有可能）

```bash
# 检查 .env 文件是否存在
ls -la .env

# 检查文件内容
cat .env
```

**应该包含：**
```env
VITE_SUPABASE_URL=https://wpbgzcmpwsktoaowwkpj.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_ytPCyU2oEoHxYQYBPdC-8A_QskBu-l4
```

### 2️⃣ **开发服务器未重启**

即使`.env`文件存在，如果您之前修改过它，需要**重启Vite开发服务器**：

```bash
# 停止当前服务器（Ctrl+C）
# 然后重新启动
npm run dev
```

### 3️⃣ **Supabase RLS策略问题**

如果之前的策略有误，可能导致读取权限被拒绝。

### 4️⃣ **浏览器缓存问题**

有时浏览器会缓存旧的配置。

---

## 🚀 立即排查步骤

### 步骤 1：检查 `.env` 文件

**在项目根目录**运行：

```bash
cat .env
```

**应该看到：**
```env
VITE_SUPABASE_URL=https://wpbgzcmpwsktoaowwkpj.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_ytPCyU2oEoHxYQYBPdC-8A_QskBu-l4
```

**如果文件不存在或内容不对：**

```bash
# 创建 .env 文件
echo 'VITE_SUPABASE_URL=https://wpbgzcmpwsktoaowwkpj.supabase.co' > .env
echo 'VITE_SUPABASE_ANON_KEY=sb_publishable_ytPCyU2oEoHxYQYBPdC-8A_QskBu-l4' >> .env
```

---

### 步骤 2：重启开发服务器

这是**最关键**的一步！Vite只在启动时读取`.env`文件。

```bash
# 1. 停止当前服务器
# 在运行 npm run dev 的终端按 Ctrl+C

# 2. 重新启动
npm run dev
```

**启动后应该看到：**
```
  VITE v5.x.x  ready in xxx ms

  ➜  Local:   http://localhost:5173/
  ➜  Network: use --host to expose
```

---

### 步骤 3：强制刷新浏览器

```
Windows: Ctrl + Shift + R
Mac: Cmd + Shift + R
```

---

### 步骤 4：测试Supabase连接

打开浏览器Console（F12），运行：

```javascript
// 测试环境变量是否加载
console.log('SUPABASE_URL:', import.meta.env.VITE_SUPABASE_URL);
console.log('SUPABASE_KEY:', import.meta.env.VITE_SUPABASE_ANON_KEY?.substring(0, 20) + '...');
```

**应该看到：**
```
SUPABASE_URL: https://wpbgzcmpwsktoaowwkpj.supabase.co
SUPABASE_KEY: sb_publishable_ytPCy...
```

**如果看到 `undefined`：**
- ❌ 环境变量未加载
- ✅ 重启开发服务器（步骤2）

---

### 步骤 5：检查Supabase RLS策略

登录Supabase后台：
1. 进入 **Authentication** → **Policies**
2. 检查以下表的策略：

#### `employees` 表策略
```sql
-- 应该有这个策略
create policy "Public read on active employees" 
  on employees for select using (is_active = true);
```

#### `skills` 表策略
```sql
-- 应该有这个策略
create policy "Public read on active skills" 
  on skills for select using (is_active = true);
```

#### `competency_assessments` 表策略
```sql
-- 应该有这个策略
create policy "Public read on assessments" 
  on competency_assessments for select using (true);
```

**如果策略不存在，在SQL Editor中运行：**

```sql
-- 清理旧策略
drop policy if exists "Public read on departments" on departments;
drop policy if exists "Public read on active employees" on employees;
drop policy if exists "Public read on active skills" on skills;
drop policy if exists "Public read on assessments" on competency_assessments;

-- 重新创建
create policy "Public read on departments" 
  on departments for select using (true);

create policy "Public read on active employees" 
  on employees for select using (is_active = true);

create policy "Public read on active skills" 
  on skills for select using (is_active = true);

create policy "Public read on assessments" 
  on competency_assessments for select using (true);
```

---

## 🔧 快速修复脚本

创建一个诊断脚本：

```bash
#!/bin/bash
echo "🔍 Supabase连接诊断"
echo ""

# 1. 检查 .env 文件
echo "1️⃣ 检查 .env 文件..."
if [ -f .env ]; then
  echo "✅ .env 文件存在"
  echo "内容："
  cat .env
else
  echo "❌ .env 文件不存在！"
  echo "正在创建..."
  cat > .env << 'EOF'
VITE_SUPABASE_URL=https://wpbgzcmpwsktoaowwkpj.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_ytPCyU2oEoHxYQYBPdC-8A_QskBu-l4
EOF
  echo "✅ .env 文件已创建"
fi

echo ""
echo "2️⃣ 下一步："
echo "   请重启开发服务器："
echo "   - 按 Ctrl+C 停止当前服务器"
echo "   - 运行: npm run dev"
echo ""
echo "3️⃣ 然后强制刷新浏览器（Ctrl+Shift+R）"
```

保存为 `diagnose.sh`，然后运行：
```bash
chmod +x diagnose.sh
./diagnose.sh
```

---

## 📊 为什么导入功能正常但查看失败？

这个很关键！说明：

| 功能 | 状态 | 原因分析 |
|------|------|----------|
| 导入数据 | ✅ 正常 | 在导入时Supabase客户端初始化成功 |
| 查看数据 | ❌ 失败 | 页面刷新后环境变量丢失 |

**结论：**
- `.env` 文件可能在导入时存在，但后来被删除或修改
- 或者开发服务器在`.env`创建之前启动，没有重启

---

## 🎯 最可能的解决方案

### ⚠️ 90%的情况是这个问题：

**您需要重启开发服务器！**

```bash
# 1. 在运行 npm run dev 的终端
#    按 Ctrl+C 停止

# 2. 重新启动
npm run dev

# 3. 刷新浏览器（Ctrl+Shift+R）
```

---

## 🧪 验证修复

修复后，打开能力评估页面，应该看到：

```javascript
// Console 日志
正在获取员工数据...
正在获取技能数据...
正在获取评估数据...
✅ 数据加载完成

// 页面显示
能力评估 (17人 | 39技能)
[卡片视图] [表格视图] [总览视图（矩阵）]
```

---

## 🆘 如果还是不行

请提供以下信息：

1. **`.env` 文件内容**
   ```bash
   cat .env
   ```

2. **开发服务器启动日志**
   ```bash
   npm run dev
   ```

3. **浏览器Console中的环境变量值**
   ```javascript
   console.log(import.meta.env.VITE_SUPABASE_URL);
   console.log(import.meta.env.VITE_SUPABASE_ANON_KEY);
   ```

4. **Supabase RLS策略截图**
   - 进入Supabase → Table Editor → 任意表 → Policies标签

---

**🚀 立即执行：重启开发服务器！这应该能解决90%的问题！**
