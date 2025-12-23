# 🔧 应用问题排查指南

## 📋 目录
1. [问题现象](#问题现象)
2. [快速诊断步骤](#快速诊断步骤)
3. [详细排查流程](#详细排查流程)
4. [常见问题解决方案](#常见问题解决方案)
5. [终极解决方案](#终极解决方案)

---

## 问题现象

### 症状：页面空白，什么都不显示

可能的原因：
- ❌ JavaScript错误导致应用崩溃
- ❌ 环境变量配置错误
- ❌ 依赖安装不完整
- ❌ 路由配置问题
- ❌ 构建错误

---

## 快速诊断步骤

### 步骤1：打开浏览器开发者工具 🔍

**Windows/Linux**: 按 `F12` 或 `Ctrl + Shift + I`  
**Mac**: 按 `Cmd + Option + I`

### 步骤2：查看Console（控制台）标签页

**寻找红色错误信息**，常见的错误类型：

#### 错误类型A：环境变量错误
```
❌ Error: Missing Supabase environment variables
```

**解决方案**：跳转到 [环境变量问题](#4-环境变量问题)

#### 错误类型B：模块导入错误
```
❌ Failed to resolve module specifier "xlsx"
❌ Cannot find module '@supabase/supabase-js'
```

**解决方案**：跳转到 [依赖问题](#3-依赖安装问题)

#### 错误类型C：语法错误
```
❌ Uncaught SyntaxError: Unexpected token
```

**解决方案**：跳转到 [代码语法问题](#6-代码语法问题)

#### 错误类型D：网络错误
```
❌ Failed to fetch
❌ Network error
```

**解决方案**：跳转到 [Supabase连接问题](#5-supabase连接问题)

---

## 详细排查流程

### 1. 检查开发服务器状态

#### 1.1 查看终端输出

终端应该显示类似：
```bash
✅ 正常输出：
  VITE v5.4.2  ready in 1234 ms

  ➜  Local:   http://localhost:5173/
  ➜  Network: use --host to expose
  ➜  press h + enter to show help
```

```bash
❌ 异常输出：
  Error: Cannot find module 'vite'
  Error: Port 5173 is already in use
```

#### 1.2 解决端口占用

如果提示端口被占用：

**Windows**:
```bash
# 查找占用5173端口的进程
netstat -ano | findstr :5173

# 结束进程（替换PID为实际的进程ID）
taskkill /PID <PID> /F

# 或者使用其他端口启动
npm run dev -- --port 5174
```

**Mac/Linux**:
```bash
# 查找并结束进程
lsof -ti:5173 | xargs kill -9

# 或者使用其他端口
npm run dev -- --port 5174
```

---

### 2. 检查项目文件完整性

#### 2.1 确认关键文件存在

在项目根目录执行：

```bash
ls -la .env
ls -la package.json
ls -la vite.config.ts
ls -la index.html
ls -la src/main.tsx
```

**应该看到**：
```
✅ .env 文件存在
✅ package.json 存在
✅ vite.config.ts 存在
✅ index.html 存在
✅ src/main.tsx 存在
```

#### 2.2 如果文件缺失

```bash
# 从GitHub重新拉取
git status
git pull origin <分支名>
```

---

### 3. 依赖安装问题

#### 3.1 检查 node_modules 文件夹

```bash
ls -la node_modules
```

**如果不存在或很小**，重新安装依赖：

```bash
# 删除旧的依赖
rm -rf node_modules
rm package-lock.json

# 重新安装
npm install
```

#### 3.2 检查关键依赖

```bash
npm list @supabase/supabase-js
npm list xlsx
npm list react
npm list vite
```

**应该看到版本号**：
```
✅ @supabase/supabase-js@2.57.4
✅ xlsx@0.18.5
✅ react@18.3.1
✅ vite@5.4.2
```

#### 3.3 如果依赖缺失

```bash
# 手动安装缺失的依赖
npm install @supabase/supabase-js xlsx

# 或者重新安装所有依赖
npm install
```

---

### 4. 环境变量问题

#### 4.1 检查 .env 文件

```bash
cat .env
```

**应该看到**：
```env
VITE_SUPABASE_URL=https://wpbgzcmpwsktoaowwkpj.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_ytPCyU2oEoHxYQYBPdC-8A_QskBu-l4
```

#### 4.2 常见错误

**错误1：没有 VITE_ 前缀**
```env
❌ 错误：
SUPABASE_URL=...
SUPABASE_ANON_KEY=...

✅ 正确：
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
```

**错误2：有多余的引号或空格**
```env
❌ 错误：
VITE_SUPABASE_URL = "https://..."  （有空格和引号）

✅ 正确：
VITE_SUPABASE_URL=https://...  （无空格无引号）
```

**错误3：.env 在错误的位置**
```bash
❌ 错误位置：
/workspace/src/.env

✅ 正确位置：
/workspace/.env  （项目根目录）
```

#### 4.3 重启开发服务器

**环境变量修改后必须重启！**

```bash
# 在终端按 Ctrl+C 停止服务器
# 然后重新启动
npm run dev
```

---

### 5. Supabase连接问题

#### 5.1 在浏览器Console测试连接

打开浏览器控制台（F12），粘贴以下代码：

```javascript
// 测试Supabase URL是否可访问
fetch('https://wpbgzcmpwsktoaowwkpj.supabase.co/rest/v1/', {
  headers: {
    'apikey': 'sb_publishable_ytPCyU2oEoHxYQYBPdC-8A_QskBu-l4',
    'Content-Type': 'application/json'
  }
})
.then(response => {
  if (response.ok) {
    console.log('✅ Supabase连接成功');
  } else {
    console.log('❌ Supabase连接失败:', response.status);
  }
})
.catch(error => {
  console.log('❌ 网络错误:', error);
});
```

**如果失败**：
1. 检查网络连接
2. 检查Supabase项目是否激活
3. 检查API密钥是否正确

#### 5.2 检查Supabase项目状态

访问：https://wpbgzcmpwsktoaowwkpj.supabase.co

确认：
- ✅ 项目处于激活状态（Active）
- ✅ 没有暂停（Paused）
- ✅ 数据库已创建

#### 5.3 验证表是否存在

在Supabase仪表盘：
1. 点击 "Table Editor"
2. 查看是否有以下表：
   - `competency_definitions`
   - `competency_assessments`

**如果表不存在**：
- 跳转到 [创建数据表](#7-创建数据表)

---

### 6. 代码语法问题

#### 6.1 检查TypeScript编译

```bash
# 运行类型检查
npm run typecheck
```

**如果有错误**：
```bash
❌ src/lib/supabase.ts(5,10): error TS2345: ...
```

查看具体文件和行号，修复语法错误。

#### 6.2 清除缓存重新构建

```bash
# 删除缓存
rm -rf node_modules/.vite
rm -rf dist

# 重新启动
npm run dev
```

---

### 7. 创建数据表

如果Supabase中没有表，按以下步骤创建：

#### 7.1 访问SQL Editor

```
https://wpbgzcmpwsktoaowwkpj.supabase.co
→ 点击左侧 "SQL Editor"
→ 点击 "New query"
```

#### 7.2 执行建表SQL

**复制粘贴以下SQL，点击 Run**:

```sql
-- 创建能力定义表
CREATE TABLE IF NOT EXISTS public.competency_definitions (
    id BIGSERIAL PRIMARY KEY,
    module_id INTEGER NOT NULL,
    module_name TEXT NOT NULL,
    competency_type TEXT NOT NULL,
    competency_code VARCHAR(50) UNIQUE,
    description TEXT,
    owner_engineer TEXT,
    is_key_competency BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 创建能力评估表
CREATE TABLE IF NOT EXISTS public.competency_assessments (
    id BIGSERIAL PRIMARY KEY,
    engineer_id VARCHAR(50) NOT NULL,
    engineer_name TEXT NOT NULL,
    department TEXT NOT NULL,
    competency_id BIGINT,
    module_name TEXT NOT NULL,
    competency_type TEXT NOT NULL,
    current_score SMALLINT NOT NULL CHECK (current_score >= 1 AND current_score <= 5),
    target_score SMALLINT NOT NULL CHECK (target_score >= 1 AND target_score <= 5),
    gap SMALLINT GENERATED ALWAYS AS (target_score - current_score) STORED,
    assessment_year INTEGER NOT NULL,
    assessment_date DATE DEFAULT CURRENT_DATE,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT check_target_gte_current CHECK (target_score >= current_score)
);

-- 禁用RLS（开发环境）
ALTER TABLE public.competency_definitions DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.competency_assessments DISABLE ROW LEVEL SECURITY;
```

#### 7.3 验证表创建成功

```
点击 "Table Editor"
→ 应该看到两张表
```

---

## 常见问题解决方案

### 问题1：页面完全空白，Console无错误

**可能原因**：路由配置问题

**解决方案**：

1. 访问具体路由而不是根路径：
   ```
   http://localhost:5173/#/dashboard
   http://localhost:5173/#/import
   http://localhost:5173/#/competency-assessment
   ```

2. 如果依然空白，检查 `src/App.tsx`：
   ```bash
   cat src/App.tsx
   ```

3. 确认路由配置正确

### 问题2：显示"Cannot read property of undefined"

**可能原因**：数据结构不匹配

**解决方案**：

1. 打开浏览器Console
2. 查看完整的错误堆栈
3. 定位到具体的文件和行号
4. 告诉我错误信息，我会帮您修复

### 问题3：Supabase相关错误

```
❌ Failed to fetch
❌ Invalid API key
❌ Table not found
```

**解决方案**：

1. **重新检查 .env 文件**：
   ```bash
   cat .env
   ```

2. **验证API密钥格式**：
   - URL应该以 `https://` 开头
   - Key应该是一串长字符串，包含字母、数字、下划线、连字符

3. **测试连接**（在浏览器Console）：
   ```javascript
   console.log('URL:', import.meta.env.VITE_SUPABASE_URL);
   console.log('Key:', import.meta.env.VITE_SUPABASE_ANON_KEY);
   ```

### 问题4：依赖冲突

```
❌ npm ERR! peer dependency conflict
```

**解决方案**：

```bash
# 强制安装（忽略peer依赖冲突）
npm install --legacy-peer-deps

# 或者清除缓存后安装
npm cache clean --force
rm -rf node_modules package-lock.json
npm install
```

---

## 终极解决方案

### 方案1：完全重置项目

如果以上方法都不行，执行完全重置：

```bash
# 1. 停止开发服务器（Ctrl+C）

# 2. 清理所有临时文件
rm -rf node_modules
rm -rf .vite
rm -rf dist
rm package-lock.json

# 3. 重新安装依赖
npm install

# 4. 验证 .env 文件
cat .env

# 5. 重新启动
npm run dev
```

### 方案2：使用详细日志模式

```bash
# 启动时显示详细日志
npm run dev -- --debug
```

查看启动过程中的所有日志，找出问题所在。

### 方案3：检查浏览器兼容性

确保使用现代浏览器：
- ✅ Chrome 90+
- ✅ Firefox 88+
- ✅ Safari 14+
- ✅ Edge 90+

尝试：
1. 清除浏览器缓存（Ctrl+Shift+Delete）
2. 使用无痕/隐私模式
3. 换一个浏览器测试

---

## 🆘 如何获取帮助

### 收集诊断信息

如果问题依然存在，请收集以下信息告诉我：

#### 1. 浏览器Console输出

```
打开 F12 → Console 标签
截图或复制所有红色错误信息
```

#### 2. 终端输出

```
复制终端中npm run dev的完整输出
包括所有警告和错误信息
```

#### 3. 环境信息

```bash
# 查看Node版本
node --version

# 查看npm版本
npm --version

# 查看项目依赖
npm list --depth=0
```

#### 4. .env 文件内容

```bash
cat .env
```

#### 5. 网络请求

```
打开 F12 → Network 标签
刷新页面
截图所有红色（失败）的请求
```

---

## 📊 诊断检查清单

在联系支持前，请确认：

- [ ] 已打开浏览器开发者工具（F12）
- [ ] 已查看Console标签的错误信息
- [ ] 已执行 `npm install`
- [ ] 已确认 `.env` 文件存在且格式正确
- [ ] 已重启开发服务器
- [ ] 已在Supabase中创建数据表
- [ ] 已禁用RLS或配置访问策略
- [ ] 已清除浏览器缓存
- [ ] 已尝试访问具体路由（如 /#/dashboard）
- [ ] 已记录所有错误信息

---

## 🎯 快速诊断命令

一键运行所有诊断检查：

```bash
#!/bin/bash
echo "=== 环境诊断 ==="
echo "Node版本: $(node --version)"
echo "npm版本: $(npm --version)"
echo ""
echo "=== 文件检查 ==="
echo ".env 文件: $([ -f .env ] && echo '✅ 存在' || echo '❌ 不存在')"
echo "package.json: $([ -f package.json ] && echo '✅ 存在' || echo '❌ 不存在')"
echo "node_modules: $([ -d node_modules ] && echo '✅ 存在' || echo '❌ 不存在')"
echo ""
echo "=== .env 内容 ==="
cat .env
echo ""
echo "=== 关键依赖版本 ==="
npm list @supabase/supabase-js xlsx react vite --depth=0
```

**保存为 `diagnose.sh`，然后执行**：
```bash
chmod +x diagnose.sh
./diagnose.sh
```

---

## 💡 预防性建议

### 开发环境最佳实践

1. **定期更新依赖**
   ```bash
   npm update
   ```

2. **使用版本控制**
   ```bash
   git add .env.example
   # 注意：不要提交 .env
   ```

3. **定期备份数据**
   - Supabase自动备份（免费版7天）
   - 手动导出重要数据

4. **文档化配置**
   - 记录Supabase URL和密钥位置
   - 记录特殊配置

---

## 📞 联系支持

如果以上方法都无法解决问题：

1. **收集诊断信息**（见上文）
2. **描述问题**：
   - 什么时候开始出现的
   - 做了什么操作
   - 期望的行为 vs 实际的行为
3. **提供截图**：
   - 浏览器Console
   - 终端输出
   - 错误信息

---

**记住**：大多数问题都是由以下几个原因引起的：
1. 🔴 环境变量配置错误（60%）
2. 🔴 依赖安装不完整（20%）
3. 🔴 Supabase表未创建（10%）
4. 🔴 其他（10%）

**祝您调试顺利！** 🚀

---

*最后更新：2025-11-24*
