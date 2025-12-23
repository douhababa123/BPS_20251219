# Supabase数据库配置指南

## 📚 目录
1. [Supabase简介](#supabase简介)
2. [创建Supabase账户和项目](#创建supabase账户和项目)
3. [数据库表结构设计](#数据库表结构设计)
4. [创建数据表步骤](#创建数据表步骤)
5. [配置访问权限](#配置访问权限)
6. [测试数据库连接](#测试数据库连接)
7. [后期迁移到SQL Server](#后期迁移到sql-server)

---

## Supabase简介

### 什么是Supabase？
Supabase是一个开源的Firebase替代品，提供：
- ✅ PostgreSQL数据库（非常强大的关系型数据库）
- ✅ 自动生成的REST API
- ✅ 实时订阅功能
- ✅ 用户认证和授权
- ✅ 文件存储
- ✅ 免费套餐（适合开发和测试）

### 为什么选择Supabase作为调试工具？
- 🚀 快速搭建，无需自己管理服务器
- 💰 免费额度充足（500MB数据库 + 1GB文件存储）
- 🔧 可视化界面，易于操作
- 📊 内置SQL编辑器
- 🔄 后续可轻松导出数据迁移到SQL Server

---

## 创建Supabase账户和项目

### 步骤1：注册Supabase账户

1. **访问Supabase官网**
   - 打开浏览器，访问：https://supabase.com
   
2. **点击"Start your project"按钮**
   - 位于首页右上角

3. **选择注册方式**
   - 推荐使用 **GitHub账户** 登录（最快）
   - 或使用 **邮箱** 注册
   
4. **验证邮箱**（如果使用邮箱注册）
   - 检查收件箱，点击验证链接

### 步骤2：创建新项目

1. **进入Dashboard**
   - 登录后会自动跳转到仪表盘

2. **点击"New Project"按钮**
   - 位于左侧边栏或中间的空白区域

3. **选择Organization**
   - 如果是第一次使用，需要先创建Organization
   - 点击"New organization"
   - 输入名称，例如：`BPS-Development`

4. **填写项目信息**
   ```
   Project Name: BPS-Competency-System
   Database Password: [设置一个强密码，务必保存好！]
   Region: Northeast Asia (Seoul) [选择离您最近的区域]
   Pricing Plan: Free [免费套餐]
   ```

5. **点击"Create new project"**
   - 等待1-2分钟，Supabase会自动配置数据库

6. **项目创建成功**
   - 您会看到项目仪表盘，包含API URL、密钥等信息

---

## 数据库表结构设计

### 表1：能力定义表 (competency_definitions)

**用途**：存储9大能力模块和39种能力类型的定义

**表结构设计**：

| 字段名 | 数据类型 | 说明 | 约束 |
|--------|---------|------|------|
| `id` | `bigint` | 主键ID | PRIMARY KEY, AUTO INCREMENT |
| `module_id` | `integer` | 能力模块ID (1-9) | NOT NULL |
| `module_name` | `text` | 能力模块名称 | NOT NULL |
| `competency_type` | `text` | 能力类型名称 | NOT NULL |
| `competency_code` | `varchar(50)` | 能力编码 | UNIQUE |
| `description` | `text` | 能力描述 | NULL |
| `owner_engineer` | `text` | 负责工程师 | NULL |
| `is_key_competency` | `boolean` | 是否关键能力 | DEFAULT false |
| `created_at` | `timestamptz` | 创建时间 | DEFAULT now() |
| `updated_at` | `timestamptz` | 更新时间 | DEFAULT now() |

**9大能力模块参考**：
1. BPS elements - BPS基础元素
2. Investment efficiency - 投资效率
3. Team Competence Elements - 团队能力要素
4. TPM (Total Productive Maintenance) - 全面生产维护
5. IE (Industrial Engineering) - 工业工程
6. LRP (Lean Realization Process) - 精益实现流程
7. Everybody's CIP - 全员持续改进
8. Leadership commitment - 领导力承诺
9. CIP in indirect area / Digital Transformation - 间接领域改进/数字化转型

### 表2：能力评估表 (competency_assessments)

**用途**：存储工程师的能力评估数据

**表结构设计**：

| 字段名 | 数据类型 | 说明 | 约束 |
|--------|---------|------|------|
| `id` | `bigint` | 主键ID | PRIMARY KEY, AUTO INCREMENT |
| `engineer_id` | `varchar(50)` | 工程师ID | NOT NULL |
| `engineer_name` | `text` | 工程师姓名 | NOT NULL |
| `department` | `text` | 部门 | NOT NULL |
| `competency_id` | `bigint` | 能力定义ID（外键） | FOREIGN KEY → competency_definitions(id) |
| `module_name` | `text` | 能力模块 | NOT NULL |
| `competency_type` | `text` | 能力类型 | NOT NULL |
| `current_score` | `smallint` | 现状得分 (1-5) | NOT NULL, CHECK (current_score >= 1 AND current_score <= 5) |
| `target_score` | `smallint` | 目标得分 (1-5) | NOT NULL, CHECK (target_score >= 1 AND target_score <= 5) |
| `gap` | `smallint` | 差距值 | GENERATED ALWAYS AS (target_score - current_score) STORED |
| `assessment_year` | `integer` | 评估年度 | NOT NULL |
| `assessment_date` | `date` | 评估日期 | DEFAULT now() |
| `notes` | `text` | 备注 | NULL |
| `created_at` | `timestamptz` | 创建时间 | DEFAULT now() |
| `updated_at` | `timestamptz` | 更新时间 | DEFAULT now() |

**关键约束**：
- `current_score` 和 `target_score` 必须在1-5之间
- `target_score` 必须 >= `current_score`（通过触发器或应用层验证）
- `gap` 是计算列，自动计算 = target_score - current_score

### 表关系

```
competency_definitions (1) ←→ (N) competency_assessments
              ↑
              └── 通过 competency_id 关联
```

---

## 创建数据表步骤

### 方法1：使用SQL编辑器（推荐）

#### 步骤1：打开SQL编辑器

1. 在Supabase项目仪表盘，点击左侧菜单的 **"SQL Editor"**
2. 点击 **"New query"** 创建新查询

#### 步骤2：创建能力定义表

复制以下SQL代码到编辑器：

```sql
-- ============================================
-- 创建能力定义表 (competency_definitions)
-- ============================================

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

-- 添加注释
COMMENT ON TABLE public.competency_definitions IS '能力定义表 - 存储9大能力模块和39种能力类型';
COMMENT ON COLUMN public.competency_definitions.module_id IS '能力模块ID (1-9)';
COMMENT ON COLUMN public.competency_definitions.module_name IS '能力模块名称（如：TPM基础、精益流程等）';
COMMENT ON COLUMN public.competency_definitions.competency_type IS '能力类型名称';
COMMENT ON COLUMN public.competency_definitions.competency_code IS '能力编码（唯一标识）';
COMMENT ON COLUMN public.competency_definitions.owner_engineer IS '负责该能力的工程师';

-- 创建索引以提高查询性能
CREATE INDEX idx_competency_definitions_module_id ON public.competency_definitions(module_id);
CREATE INDEX idx_competency_definitions_module_name ON public.competency_definitions(module_name);

-- 创建更新时间的自动触发器
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_competency_definitions_updated_at 
    BEFORE UPDATE ON public.competency_definitions 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();
```

**操作**：
- 点击右下角的 **"Run"** 按钮（或按 Ctrl+Enter）
- 看到 "Success. No rows returned" 表示创建成功

#### 步骤3：创建能力评估表

在同一个SQL编辑器，创建新查询（或清空上一个），复制以下SQL：

```sql
-- ============================================
-- 创建能力评估表 (competency_assessments)
-- ============================================

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
    
    -- 外键约束（可选，如果不需要强关联可以去掉）
    CONSTRAINT fk_competency_id 
        FOREIGN KEY (competency_id) 
        REFERENCES public.competency_definitions(id) 
        ON DELETE SET NULL,
    
    -- 约束：目标得分必须大于等于现状得分
    CONSTRAINT check_target_gte_current 
        CHECK (target_score >= current_score)
);

-- 添加注释
COMMENT ON TABLE public.competency_assessments IS '能力评估表 - 存储工程师的能力评估数据';
COMMENT ON COLUMN public.competency_assessments.engineer_id IS '工程师工号或唯一ID';
COMMENT ON COLUMN public.competency_assessments.current_score IS '现状得分 (1-5): 1=Know it, 2=Do it, 3=Lead it, 4=Shape it, 5=Master';
COMMENT ON COLUMN public.competency_assessments.target_score IS '目标得分 (1-5)，必须 >= current_score';
COMMENT ON COLUMN public.competency_assessments.gap IS '能力差距，自动计算 = target_score - current_score';

-- 创建索引以提高查询性能
CREATE INDEX idx_competency_assessments_engineer_id ON public.competency_assessments(engineer_id);
CREATE INDEX idx_competency_assessments_engineer_name ON public.competency_assessments(engineer_name);
CREATE INDEX idx_competency_assessments_department ON public.competency_assessments(department);
CREATE INDEX idx_competency_assessments_module_name ON public.competency_assessments(module_name);
CREATE INDEX idx_competency_assessments_assessment_year ON public.competency_assessments(assessment_year);

-- 创建更新时间的自动触发器
CREATE TRIGGER update_competency_assessments_updated_at 
    BEFORE UPDATE ON public.competency_assessments 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();
```

**操作**：
- 点击 **"Run"** 按钮
- 看到成功提示

#### 步骤4：插入示例数据（可选）

插入一些测试数据以验证表结构：

```sql
-- ============================================
-- 插入示例数据 - 能力定义表
-- ============================================

INSERT INTO public.competency_definitions (module_id, module_name, competency_type, competency_code, owner_engineer, is_key_competency) 
VALUES 
    (1, 'TPM基础', 'TPM八大支柱', 'TPM-001', 'Zhang Wei', true),
    (1, 'TPM基础', 'OEE计算与分析', 'TPM-002', 'Li Na', true),
    (1, 'TPM基础', '自主保全体系', 'TPM-003', 'Chen Ming', false),
    (2, '精益流程', '价值流分析', 'LEAN-001', 'Wang Pei', true),
    (2, '精益流程', '流程映射技术', 'LEAN-002', 'Liu Yang', false),
    (3, '问题解决', '8D问题解决', 'PS-001', 'Zhao Jun', true),
    (3, '问题解决', '根因分析方法', 'PS-002', 'Zhou Li', true),
    (4, '项目管理', '项目计划编制', 'PM-001', 'Wu Gang', false),
    (5, '数据分析', '统计过程控制', 'DA-001', 'Sun Yan', true);

-- ============================================
-- 插入示例数据 - 能力评估表
-- ============================================

INSERT INTO public.competency_assessments 
    (engineer_id, engineer_name, department, module_name, competency_type, current_score, target_score, assessment_year) 
VALUES 
    ('ENG001', 'Zhang Wei', 'Quality Team', 'TPM基础', 'TPM八大支柱', 2, 4, 2025),
    ('ENG001', 'Zhang Wei', 'Quality Team', 'TPM基础', 'OEE计算与分析', 3, 4, 2025),
    ('ENG001', 'Zhang Wei', 'Quality Team', '精益流程', '价值流分析', 3, 4, 2025),
    ('ENG001', 'Zhang Wei', 'Quality Team', '问题解决', '8D问题解决', 4, 5, 2025),
    
    ('ENG002', 'Li Na', 'Process Engineering', 'TPM基础', 'TPM八大支柱', 3, 5, 2025),
    ('ENG002', 'Li Na', 'Process Engineering', '精益流程', '价值流分析', 4, 5, 2025),
    ('ENG002', 'Li Na', 'Process Engineering', '项目管理', '项目计划编制', 3, 4, 2025),
    
    ('ENG003', 'Chen Ming', 'TPM Center', 'TPM基础', '自主保全体系', 2, 4, 2025),
    ('ENG003', 'Chen Ming', 'TPM Center', 'TPM基础', 'OEE计算与分析', 2, 3, 2025),
    ('ENG003', 'Chen Ming', 'TPM Center', '数据分析', '统计过程控制', 3, 5, 2025);
```

---

### 方法2：使用可视化界面（Table Editor）

如果您不熟悉SQL，也可以使用Supabase的可视化界面：

#### 步骤1：打开Table Editor

1. 点击左侧菜单的 **"Table Editor"**
2. 点击 **"Create a new table"**

#### 步骤2：创建能力定义表

1. **填写表信息**：
   - Table name: `competency_definitions`
   - Description: 能力定义表
   - 勾选 "Enable Row Level Security (RLS)" （稍后配置）

2. **添加列（Columns）**：
   
   点击 "Add column"，依次添加以下列：
   
   | 列名 | 类型 | 默认值 | 可空 | 备注 |
   |-----|------|--------|-----|------|
   | id | int8 | AUTO | NO | Primary Key（自动添加） |
   | module_id | int4 | - | NO | - |
   | module_name | text | - | NO | - |
   | competency_type | text | - | NO | - |
   | competency_code | varchar | - | YES | Unique constraint |
   | description | text | - | YES | - |
   | owner_engineer | text | - | YES | - |
   | is_key_competency | bool | false | NO | - |
   | created_at | timestamptz | now() | NO | - |
   | updated_at | timestamptz | now() | NO | - |

3. **点击 "Save"**

#### 步骤3：创建能力评估表

重复上述步骤，创建 `competency_assessments` 表，添加相应的列。

**注意**：可视化界面创建外键和约束较复杂，建议使用SQL方式。

---

## 配置访问权限

### 步骤1：了解Row Level Security (RLS)

Supabase默认启用RLS（行级安全），这意味着：
- 未授权的用户无法访问数据
- 需要创建策略（Policy）来允许访问

对于**调试和开发阶段**，我们可以暂时禁用RLS或创建允许所有操作的策略。

### 步骤2：禁用RLS（仅用于开发）

**方法A：通过SQL**

```sql
-- 禁用RLS（仅用于开发环境）
ALTER TABLE public.competency_definitions DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.competency_assessments DISABLE ROW LEVEL SECURITY;
```

**方法B：通过界面**

1. 进入 **"Authentication" → "Policies"**
2. 找到对应的表
3. 点击表名旁的设置图标
4. 关闭 "Enable RLS"

### 步骤3：创建访问策略（生产环境推荐）

如果要保持RLS开启，创建允许所有操作的策略：

```sql
-- 允许所有用户读取能力定义表
CREATE POLICY "Allow public read access on competency_definitions"
ON public.competency_definitions
FOR SELECT
TO public
USING (true);

-- 允许所有用户写入能力定义表
CREATE POLICY "Allow public write access on competency_definitions"
ON public.competency_definitions
FOR ALL
TO public
USING (true);

-- 允许所有用户读取能力评估表
CREATE POLICY "Allow public read access on competency_assessments"
ON public.competency_assessments
FOR SELECT
TO public
USING (true);

-- 允许所有用户写入能力评估表
CREATE POLICY "Allow public write access on competency_assessments"
ON public.competency_assessments
FOR ALL
TO public
USING (true);
```

### 步骤4：获取API密钥

1. 进入 **"Settings" → "API"**
2. 您会看到两个重要信息：
   - **Project URL**：例如 `https://xxxxx.supabase.co`
   - **anon public key**：公开密钥（用于前端）
   - **service_role key**：服务密钥（用于后端，权限更高）

**⚠️ 重要**：
- `anon public key` 可以放在前端代码中
- `service_role key` 绝对不能暴露，只能在服务器端使用
- 将这些密钥保存在 `.env` 文件中

---

## 测试数据库连接

### 方法1：使用Supabase内置查询

1. 进入 **"Table Editor"**
2. 点击表名 `competency_definitions`
3. 您应该能看到刚才插入的示例数据
4. 点击 "Insert row" 可以手动添加数据
5. 点击任意行可以编辑或删除

### 方法2：使用SQL查询

在 **SQL Editor** 中运行：

```sql
-- 查询所有能力定义
SELECT * FROM public.competency_definitions;

-- 查询所有能力评估
SELECT * FROM public.competency_assessments;

-- 查询特定工程师的能力评估
SELECT 
    engineer_name,
    department,
    module_name,
    competency_type,
    current_score,
    target_score,
    gap
FROM public.competency_assessments
WHERE engineer_name = 'Zhang Wei'
ORDER BY module_name, competency_type;

-- 统计各部门的平均能力差距
SELECT 
    department,
    COUNT(*) as total_assessments,
    AVG(current_score)::numeric(3,1) as avg_current,
    AVG(target_score)::numeric(3,1) as avg_target,
    AVG(gap)::numeric(3,1) as avg_gap
FROM public.competency_assessments
GROUP BY department
ORDER BY avg_gap DESC;
```

### 方法3：使用Supabase客户端（准备代码测试时）

后续在代码中测试连接时，可以使用以下代码片段：

```javascript
// 这只是示例，现在不需要运行
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'YOUR_PROJECT_URL',
  'YOUR_ANON_KEY'
)

// 测试查询
const { data, error } = await supabase
  .from('competency_definitions')
  .select('*')
  
console.log('数据:', data)
console.log('错误:', error)
```

---

## 后期迁移到SQL Server

### 数据导出

#### 方法1：使用Supabase导出功能

1. 进入 **"Database" → "Backups"**
2. 点击 **"Download backup"**
3. 会下载一个 `.sql` 文件

#### 方法2：使用pg_dump（推荐）

如果您安装了PostgreSQL客户端：

```bash
pg_dump -h db.xxxxx.supabase.co -U postgres -d postgres -t competency_definitions -t competency_assessments --data-only > data_export.sql
```

#### 方法3：导出为CSV

在SQL Editor中运行：

```sql
-- 导出能力定义表（复制结果粘贴到Excel）
COPY (SELECT * FROM public.competency_definitions) TO STDOUT WITH CSV HEADER;

-- 导出能力评估表
COPY (SELECT * FROM public.competency_assessments) TO STDOUT WITH CSV HEADER;
```

或使用Table Editor的导出功能：
- 点击表名
- 点击右上角的 "..." 菜单
- 选择 "Export to CSV"

### SQL Server迁移映射

| PostgreSQL类型 | SQL Server类型 | 说明 |
|----------------|----------------|------|
| `BIGSERIAL` | `BIGINT IDENTITY(1,1)` | 自增主键 |
| `TEXT` | `NVARCHAR(MAX)` | 文本 |
| `VARCHAR(n)` | `NVARCHAR(n)` | 可变长度字符串 |
| `SMALLINT` | `SMALLINT` | 小整数 |
| `INTEGER` | `INT` | 整数 |
| `BOOLEAN` | `BIT` | 布尔值 |
| `TIMESTAMPTZ` | `DATETIMEOFFSET` | 带时区的时间戳 |
| `DATE` | `DATE` | 日期 |

### SQL Server表创建示例

```sql
-- SQL Server版本的能力定义表
CREATE TABLE competency_definitions (
    id BIGINT IDENTITY(1,1) PRIMARY KEY,
    module_id INT NOT NULL,
    module_name NVARCHAR(MAX) NOT NULL,
    competency_type NVARCHAR(MAX) NOT NULL,
    competency_code NVARCHAR(50) UNIQUE,
    description NVARCHAR(MAX),
    owner_engineer NVARCHAR(MAX),
    is_key_competency BIT DEFAULT 0,
    created_at DATETIMEOFFSET DEFAULT GETDATE(),
    updated_at DATETIMEOFFSET DEFAULT GETDATE()
);

-- SQL Server版本的能力评估表
CREATE TABLE competency_assessments (
    id BIGINT IDENTITY(1,1) PRIMARY KEY,
    engineer_id NVARCHAR(50) NOT NULL,
    engineer_name NVARCHAR(MAX) NOT NULL,
    department NVARCHAR(MAX) NOT NULL,
    competency_id BIGINT,
    module_name NVARCHAR(MAX) NOT NULL,
    competency_type NVARCHAR(MAX) NOT NULL,
    current_score SMALLINT NOT NULL CHECK (current_score >= 1 AND current_score <= 5),
    target_score SMALLINT NOT NULL CHECK (target_score >= 1 AND target_score <= 5),
    gap AS (target_score - current_score) PERSISTED,
    assessment_year INT NOT NULL,
    assessment_date DATE DEFAULT GETDATE(),
    notes NVARCHAR(MAX),
    created_at DATETIMEOFFSET DEFAULT GETDATE(),
    updated_at DATETIMEOFFSET DEFAULT GETDATE(),
    
    CONSTRAINT fk_competency_id FOREIGN KEY (competency_id) 
        REFERENCES competency_definitions(id) ON DELETE SET NULL,
    CONSTRAINT check_target_gte_current CHECK (target_score >= current_score)
);
```

---

## 常见问题 FAQ

### Q1: Supabase免费套餐够用吗？
**A**: 对于调试和开发，免费套餐完全够用：
- 500MB数据库存储
- 50,000次API请求/月
- 2GB文件存储
- 50MB文件上传限制

### Q2: 如何重置数据库？
**A**: 
1. 进入 "Database" → "Tables"
2. 点击表名旁的 "..." 菜单
3. 选择 "Truncate table"（清空数据）或 "Delete table"（删除表）

### Q3: 如何查看数据库连接数？
**A**: 
进入 "Database" → "Connection Pooling"，可以看到当前连接数和配置

### Q4: 忘记数据库密码怎么办？
**A**: 
1. 进入 "Settings" → "Database"
2. 点击 "Reset database password"
3. 输入新密码并保存

### Q5: 如何备份数据？
**A**: 
- 免费套餐：每天自动备份，保留7天
- 付费套餐：可自定义备份策略

### Q6: 能否直接连接PostgreSQL客户端？
**A**: 
可以！在 "Settings" → "Database" 找到连接字符串：
```
Host: db.xxxxx.supabase.co
Port: 5432
Database: postgres
User: postgres
Password: [您的密码]
```

---

## 下一步操作建议

完成Supabase配置后，您可以：

1. ✅ **验证表结构**：在Table Editor中查看表和数据
2. ✅ **测试SQL查询**：在SQL Editor中运行各种查询
3. ✅ **导入真实数据**：将您的Excel数据导入到数据库
4. ✅ **集成到应用**：在React应用中连接Supabase
5. ✅ **配置环境变量**：将API密钥保存到 `.env` 文件

---

## 相关资源

- 📚 [Supabase官方文档](https://supabase.com/docs)
- 🎓 [Supabase JavaScript客户端文档](https://supabase.com/docs/reference/javascript/introduction)
- 🔧 [PostgreSQL官方文档](https://www.postgresql.org/docs/)
- 🎬 [Supabase视频教程](https://www.youtube.com/c/Supabase)

---

**准备好了吗？**

按照上述步骤，您应该能够成功创建Supabase数据库并建立两张表。如果遇到任何问题，请随时告诉我！

完成配置后，我们可以开始编写代码将您的应用连接到Supabase数据库。 🚀
