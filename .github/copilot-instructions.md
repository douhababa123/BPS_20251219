# BPS Capacity & Scheduling Platform - Copilot Instructions

## Architecture Overview

This is a production system for Bosch manufacturing competency assessment and resource planning:

**Frontend**: React 18 + TypeScript + Vite  
**Backend**: FastAPI (Python)  
**Database**: SQL Server (internal network at 10.88.43.154)

**Migration Status**: ✅ **Fully migrated from Supabase to SQL Server**
- All database operations now use SQL Server via FastAPI
- Legacy Supabase code has been replaced
- Authentication uses custom JWT + OTP (replaced Supabase Auth)

## Database Strategy

### SQL Server (Primary - Port 10.88.43.154)
- **Schema**: `SQLSERVER_SCHEMA.sql` (532 lines, authoritative)
- **Connection**: `backend/database.py` uses `pyodbc` with ODBC Driver 17
- **Auth**: Custom OTP via `users` + `otp_tokens` tables (replaces Supabase Auth)
- **Config**: `backend/config.py` with SQL Server credentials

### Legacy Supabase Code (Deprecated)
- **Note**: Supabase-related files may still exist but are no longer used in production
- **Migration Complete**: All features now use SQL Server via FastAPI
- **Cleanup**: Legacy `supabaseService.ts` code should be removed if found

**When adding features**: Always use SQL Server + FastAPI for all new development.

## Core Data Model

**4-table normalized schema** (both databases):
```
departments (id, name, code)
  ├─ employees (id, employee_id, name, department_id)
  │   └─ competency_assessments (employee_id, skill_id, current_level, target_level, gap)
  └─ skills (id, module_id, module_name, skill_name, display_order)
```

**9 Competency Modules**: BPS elements, Investment efficiency (PGL/IE), Waste-free flow (TPM/LBP), Everybody's CIP, Leadership commitment, CIP indirect LEAN, Digital Transformation

**Key Constraint**: `competency_assessments.skill_id` references `skills.id`, NOT module names. Always join through skills table.

## Development Workflows

### Starting the System
```powershell
# Frontend (always)
npm run dev  # Vite dev server → localhost:5173

# Backend (if using SQL Server features)
cd backend
python main.py  # FastAPI → localhost:8000
```

### Type Checking
```bash
npm run typecheck  # Must pass before commit
```

### Database Migrations
1. **Supabase**: Run SQL in Supabase SQL Editor (dashboard)
2. **SQL Server**: Run `.sql` scripts in SSMS or via `backend/database.py`

### Excel Import Format
- **Skills**: `编号 | 模块 | 类型 | 工程师` (see `SKILL_IMPORT_FORMAT_GUIDE.md`)
- **Assessments**: Multi-header matrix format (rows=employees, cols=skills with C/T pairs)
- **Parsers**: `src/lib/skillDefinitionParser.ts` and `src/lib/complexExcelParser.ts`

## Project-Specific Conventions

### Routing Pattern
Single-page app with `react-router-dom` in `src/App.tsx`:
```tsx
const pages = {
  dashboard: { component: Dashboard, title: '总览', subtitle: 'Dashboard' },
  competency: { component: Competency, title: '能力画像', subtitle: 'Competency' },
  // ...Chinese title + English subtitle pattern
}
```

### API Integration Layers
1. **Supabase Features**: Import `supabaseService` → use methods like `getAllEmployees()`
2. **SQL Server Features**: Use `axios` to call `http://localhost:8000/api/*` FastAPI endpoints
3. **Mock Data** (Dashboard only): Uses `src/services/mockApi.ts` for prototyping

### React Query Keys
Always use structured keys for cache invalidation:
```tsx
['employees']           // List all
['employees', id]       // Single item
['tasks', startDate, endDate]  // Filtered list
```

### Component Structure
- **Pages**: `src/pages/` - full-page views with data fetching
- **Components**: `src/components/` - reusable UI (e.g., `TaskCard`, `TimeSlotSelector`)
- **Contexts**: `src/contexts/` - global state (auth, persona switching)

### Color System (TailwindCSS)
Bosch design tokens:
- Primary Blue: `bg-blue-900`, `text-blue-600`
- Topic colors: `bg-yellow-400` (TPM), `bg-red-500` (Lean flow), `bg-green-500` (CIP/PGL)
- Chinese-first UX: All labels show Chinese with English subtitles

## Critical Files to Check First

**Before modifying database queries**:
1. `SQLSERVER_SCHEMA.sql` - SQL Server table structures
2. `src/lib/database.types.ts` - TypeScript interfaces
3. `backend/routers/` - FastAPI route handlers

**Before adding import features**:
1. `src/lib/complexExcelParser.ts` - Assessment matrix parsing logic
2. `src/lib/skillDefinitionParser.ts` - Skill definition parsing
3. `SKILL_IMPORT_FORMAT_GUIDE.md` - User-facing format spec

**Before modifying auth**:
1. `backend/auth.py` - JWT + OTP logic
2. `backend/routers/auth.py` - Auth endpoints
3. `src/contexts/NewAuthContext.tsx` - Frontend auth state

## OpenSpec Spec-Driven Development

**This project uses OpenSpec** (see `openspec/AGENTS.md`). Before implementing features:
1. Check `openspec/changes/` for active proposals
2. For new capabilities: scaffold proposal → validate → get approval → implement
3. For existing capabilities: modify specs in `openspec/specs/`
4. Run `openspec validate --strict` before committing

**Triggers for proposals**: Breaking changes, new features, architecture shifts

## Known Gotchas

1. **Supabase RLS**: Row-level security is DISABLED in dev. Enable for production via `DATABASE_RESTRUCTURE_FIXED.sql`
2. **CORS**: Frontend must run on `localhost:5173` or update `backend/config.py` allowed_origins
3. **OTP Email**: SMTP config in `backend/config.py` points to `smtp.bosch.com` (internal network)
4. **Excel Parsing**: Multi-header files must have C/T markers in row 5, skills in row 4 (see `IMPORT_BUG_FIXES.md`)
5. **SQL Server Connection**: Uses Windows Auth by default; switch to UID/PWD in `database.py` if needed
6. **Module ID Mapping**: Hard-coded in `skillDefinitionParser.ts` - don't change without updating DB

## Testing Checklist

**After DB changes**:
- ✅ Run `backend/tests/` (pytest)
- ✅ Check `src/pages/DatabaseCheck.tsx` for connection validation

**After import changes**:
- ✅ Test with sample files in `docs/` or download templates from Import page
- ✅ Verify error reporting (must show row numbers and field names)

**After auth changes**:
- ✅ Test OTP flow: signup → verify code → login → JWT in localStorage

## Documentation Structure

- **`README.md`**: Quick start for developers
- **`backend/README.md`**: FastAPI setup and routes
- **`*_GUIDE.md`**: User-facing guides (e.g., `SKILL_IMPORT_FORMAT_GUIDE.md`)
- **`*_MIGRATION.md`**: Technical migration logs (Supabase → SQL Server)
- **`ACCEPTANCE_CHECKLIST.md`**: Feature acceptance criteria

When in doubt, search `.md` files - this project is heavily documented.

## Testing Strategy & TDD Principles

### TDD 工作流（Test-Driven Development）

本项目遵循 **测试驱动开发** 原则。在编写任何新功能前：

#### Red-Green-Refactor 循环

1. **🔴 Red（编写失败的测试）**
   ```bash
   # 后端：先写测试（backend/tests/test_xxx.py）
   cd backend
   pytest tests/test_new_feature.py  # 应该失败
   
   # 前端：先写类型定义和接口
   npm run typecheck  # 验证类型正确性
   ```

2. **🟢 Green（实现最小可用代码）**
   ```bash
   # 实现功能，直到测试通过
   pytest tests/test_new_feature.py  # 应该通过
   npm run typecheck  # 无类型错误
   ```

3. **♻️ Refactor（重构优化）**
   ```bash
   # 重构代码，保持测试通过
   pytest  # 所有测试仍然通过
   npm run typecheck && npm run lint  # 代码质量检查
   ```

#### TDD 实践规则

**后端开发（FastAPI）**:
- ✅ **新增 API 路由前**: 在 `backend/tests/test_routers/` 写测试
- ✅ **数据库操作前**: 在 `backend/tests/test_database.py` 写查询测试
- ✅ **认证功能前**: 参考 `test_login.py` 的完整流程测试
- ✅ **使用 fixtures**: 利用 `conftest.py` 的 `db_cursor` 自动回滚

**前端开发（React + TypeScript）**:
- ✅ **新增组件前**: 定义 TypeScript 接口和 props 类型
- ✅ **API 集成前**: 在 `src/lib/supabaseService.ts` 定义方法签名
- ✅ **数据流变更前**: 使用 React Query 的 `queryKey` 约定
- ✅ **运行 typecheck**: 每次修改后运行 `npm run typecheck`

#### 测试优先级

**必须测试（P0）**:
- [ ] 认证流程（OTP 生成、验证、JWT）
- [ ] 数据库 CRUD 操作（departments, employees, skills, assessments）
- [ ] Excel 导入解析（skills 和 assessments 格式）
- [ ] 匹配算法计算（skill score + availability score）

**推荐测试（P1）**:
- [ ] API 端点返回格式
- [ ] 权限验证（JWT token 有效性）
- [ ] 数据验证（Pydantic models）
- [ ] 边界条件（空数据、大量数据）

**可选测试（P2）**:
- [ ] UI 组件渲染
- [ ] CSV 导出格式
- [ ] 错误提示文案

### Backend Tests (pytest)
- **Location**: `backend/tests/`
- **Fixtures**: `conftest.py` provides session-level DB connection and function-level cursors
- **Run tests**: `cd backend && pytest`
- **Watch mode**: `pytest --watch` (需安装 pytest-watch)
- **Key fixtures**:
  - `db_connection` (session) - reused across tests
  - `db_cursor` (function) - auto-rollback after each test
  - `api_base_url` - points to `http://localhost:8000/api`

### Frontend Tests
- **Quick validation**: `npm run typecheck` (must pass before commit)
- **Debug pages**:
  - `src/pages/DatabaseCheck.tsx` - tests all table connections
  - `src/pages/DebugPage.tsx` - validates environment variables

### Manual Testing Scripts
- `backend/test_login.py` - full OTP auth flow test
- `backend/test_matching_data.py` - validates matching algorithm data

### 测试命令速查

```bash
# 完整测试流程（提交前必做）
cd backend && pytest && cd .. && npm run typecheck && npm run lint

# 快速验证（开发中）
npm run typecheck  # 前端类型检查
cd backend && pytest -k "test_name"  # 运行特定测试

# 调试单个测试
cd backend && pytest tests/test_xxx.py -v -s  # 显示 print 输出
```

## Network & Deployment

### Development Environment
- **SQL Server**: `10.88.43.154` - 内网服务器，需要 Bosch 网络访问
- **SMTP**: `smtp.bosch.com` - 内网邮件服务器（OTP 发送）
- **CORS**: 仅允许 `localhost:5173` 和 `localhost:3000`

### Build & Deployment Commands
```bash
# 前端构建
npm run build        # 输出到 dist/
npm run preview      # 预览生产构建

# 后端启动
cd backend
python main.py       # 开发模式（debug=True）

# 类型检查（必须通过）
npm run typecheck
```

### Environment Variables
**前端** (`.env` 在项目根目录):
```env
VITE_SUPABASE_URL=https://wpbgzcmpwsktoaowwkpj.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_xxx
```
⚠️ **必须使用 `VITE_` 前缀**，否则 Vite 不会注入变量

**后端** (`backend/config.py` 或 `.env`):
- SQL Server 凭证默认硬编码在 `config.py`
- 生产环境应使用 `.env` 覆盖

### Production Checklist
- [ ] 启用 Supabase RLS 策略 (`DATABASE_RESTRUCTURE_FIXED.sql`)
- [ ] 配置 Bosch SMTP 服务器（`backend/config.py`）
- [ ] 限制注册域名为 `@bosch.com` (见 `backend/config.py` allowed_email_domains)
- [ ] 更新 CORS 白名单为生产域名
- [ ] 切换 SQL Server 为生产实例
- [ ] 运行 `npm run build` 并部署 `dist/` 目录

## Module Extension Policy

**9 大能力模块是固定的** - 硬编码在多个位置：
1. `src/lib/skillDefinitionParser.ts` - `MODULE_MAPPING` 常量
2. `SQLSERVER_SCHEMA.sql` - 初始化数据
3. 多个文档引用 "9大模块39技能"

**如需添加第 10 个模块**，必须：
1. 更新 `MODULE_MAPPING` (添加新 key-value)
2. 在 SQL Server 的 `skills` 表插入新模块的技能记录
3. 更新所有 "9大模块" 的文档说明
4. 考虑影响的视图：雷达图（最多支持多少边？）
5. 通知前端团队更新 UI（可能需要调整布局）

**推荐做法**：新增技能应归入现有 9 大模块，而非创建新模块。

## Code Style & Naming Conventions

### TypeScript/Frontend
**严格模式**: `strict: true` in `tsconfig.json` - 所有类型必须显式声明

**命名规范**:
- **组件**: PascalCase - `CompetencyAssessment.tsx`, `LoginScreen.tsx`
- **函数/变量**: camelCase - `handleSubmit`, `userData`, `getAllEmployees`
- **常量**: UPPER_SNAKE_CASE - `TASK_TYPES`, `MODULE_MAPPING` (in `src/lib/constants.ts`)
- **文件**: PascalCase for components, camelCase for utils
- **接口**: PascalCase with `I` prefix optional - `Database`, `Employee`
- **类型别名**: PascalCase - `Json`, `TaskType`

**ESLint 配置** (`eslint.config.js`):
- React Hooks 规则强制执行
- `react-refresh/only-export-components` 警告
- TypeScript 推荐规则启用

**注释**:
- 中文注释主导 - 关键业务逻辑用中文解释
- JSDoc 用于公共 API 和复杂函数
- 示例: `/** 提取任务类型代码 */`

### Python/Backend
**PEP 8 合规**: 遵循 Python 官方风格指南

**命名规范**:
- **函数/变量**: snake_case - `get_all_employees`, `task_type`
- **类**: PascalCase - `AuthService`, `DatabaseManager`
- **常量**: UPPER_SNAKE_CASE - `DATABASE_CONFIG`, `SMTP_SERVER`
- **私有成员**: 前缀 `_` - `_internal_method`
- **模块**: snake_case - `auth.py`, `database.py`

**Docstrings**:
- 使用三引号 `"""..."""`
- 关键函数必须包含参数和返回值说明
- 示例: `"""请求日志中间件"""`

## Error Handling & Logging

### Frontend Error Patterns
**React Query 错误处理**:
```tsx
const { data, error, isError } = useQuery({
  queryKey: ['employees'],
  queryFn: getAllEmployees,
  // ❌ 不要在这里 console.error
});

if (isError) {
  // ✅ 使用 UI 反馈而非控制台
  return <ErrorMessage message={error.message} />;
}
```

**Axios 错误处理** (FastAPI 调用):
```tsx
try {
  const response = await axios.post('/api/login', data);
} catch (error) {
  if (axios.isAxiosError(error)) {
    // ✅ 提取后端错误信息
    const message = error.response?.data?.detail || '网络错误';
    toast.error(message);
  }
}
```

**调试日志**:
- 开发环境使用 `console.log` (浏览器 Console)
- 生产环境移除所有 `console.*` 调用
- 使用 emoji 前缀: 🔍 (调试), ✅ (成功), ❌ (错误)

### Backend Error Patterns
**FastAPI HTTPException**:
```python
from fastapi import HTTPException

# ✅ 标准格式
raise HTTPException(
    status_code=404,
    detail="员工未找到"  # 中文错误信息
)

# ❌ 避免暴露内部错误
except Exception as e:
    raise HTTPException(500, "服务器内部错误")  # 不要返回 str(e)
```

**日志记录** (`backend/main.py`):
```python
import logging
logger = logging.getLogger(__name__)

# ✅ 结构化日志
logger.info(f"📥 {request.method} {request.url.path}")
logger.error(f"❌ 未处理的错误: {e}", exc_info=True)

# 日志级别: INFO (默认), ERROR (异常), WARNING (边界情况)
```

**中间件统一处理**:
- 请求日志: 自动记录所有 HTTP 请求
- 错误捕获: 全局 `error_handler` 中间件
- 响应头: `X-Process-Time` 显示处理时间

## Git Workflow & Commit Guidelines

### Branch Strategy
```bash
main/master     # 生产分支 - 保护分支，需 PR 合并
├─ feature/*    # 新功能 - feature/competency-sql-migration
├─ fix/*        # Bug 修复 - fix/excel-import-error
├─ refactor/*   # 重构 - refactor/auth-service
└─ docs/*       # 文档更新 - docs/api-guide
```

### Commit Message Format
**推荐格式** (中英文结合):
```
<type>: <subject> | <中文描述>

[可选的详细说明]
```

**Type 类型**:
- `feat`: 新功能 - `feat: add SQL Server auth | 添加 SQL Server 认证`
- `fix`: Bug 修复 - `fix: Excel import error | 修复 Excel 导入错误`
- `refactor`: 重构 - `refactor: extract competency logic | 提取能力评估逻辑`
- `docs`: 文档 - `docs: update Copilot instructions | 更新 Copilot 指令`
- `test`: 测试 - `test: add auth flow tests | 添加认证流程测试`
- `chore`: 构建/工具 - `chore: update dependencies | 更新依赖`

**示例**:
```bash
git commit -m "feat: implement OTP email verification | 实现 OTP 邮箱验证

- Add SMTP configuration in backend/config.py
- Create OTP token generation logic
- Integrate with Bosch email server"
```

### Pull Request Workflow
1. **创建功能分支**: `git checkout -b feature/your-feature`
2. **开发并提交**: 遵循 commit message 格式
3. **拉取最新代码**: `git pull origin main` (解决冲突)
4. **推送分支**: `git push origin feature/your-feature`
5. **创建 PR**: 使用 PR 模板，包含测试清单
6. **代码审查**: 至少 1 人审核通过
7. **合并**: Squash merge 保持历史整洁

### Code Review Checklist
**审查重点**:
- [ ] 类型检查通过 (`npm run typecheck`)
- [ ] 测试通过 (`pytest`, `npm test`)
- [ ] 遵循命名规范 (见上文)
- [ ] 错误处理完整 (不暴露内部错误)
- [ ] 中文注释清晰 (关键逻辑必须有)
- [ ] 无 `console.log` 残留 (生产代码)
- [ ] 数据库操作使用参数化查询 (防 SQL 注入)
- [ ] API 端点有文档 (FastAPI 自动生成)

## Performance & Security Best Practices

### Frontend Performance
**代码分割**:
```tsx
// ✅ 懒加载大型组件
const Competency = lazy(() => import('./pages/Competency'));

// ✅ React Query 缓存策略
staleTime: 5 * 60 * 1000,  // 5分钟内不重新请求
cacheTime: 30 * 60 * 1000, // 缓存保留30分钟
```

**避免**:
- ❌ 在 render 中进行大量计算 → 使用 `useMemo`
- ❌ 不必要的 re-render → 使用 `React.memo`
- ❌ 全局状态滥用 → 优先局部 state

### Backend Performance
**数据库查询优化**:
```python
# ✅ 使用索引字段查询
SELECT * FROM employees WHERE employee_id = ?  # employee_id 有索引

# ✅ 限制返回字段
SELECT id, name, department_id FROM employees

# ❌ 避免 SELECT *
# ❌ 避免 N+1 查询问题
```

**连接池管理**:
- 使用 `backend/database.py` 的连接池
- 单次请求不超过 3 个查询 (考虑合并)
- 长时间操作使用后台任务

### Security Guidelines
**SQL 注入防护**:
```python
# ✅ 参数化查询
cursor.execute("SELECT * FROM users WHERE email = ?", (email,))

# ❌ 字符串拼接
# cursor.execute(f"SELECT * FROM users WHERE email = '{email}'")
```

**XSS 防护**:
- React 自动转义输出 (默认安全)
- 使用 `dangerouslySetInnerHTML` 时必须消毒 HTML

**CORS 配置**:
- 生产环境仅允许特定域名 (见 `backend/config.py`)
- 不要使用 `allow_origins=["*"]`

**敏感信息**:
- ❌ 不要在前端存储密码
- ✅ JWT token 存储在 localStorage (HTTPS only)
- ✅ OTP 有效期 10 分钟
- ✅ SQL Server 密码在 `.env` 或 `config.py` (不提交到 Git)

## Debugging & Troubleshooting

### Common Issues
**"类型检查失败"**:
```bash
npm run typecheck  # 查看具体错误
# 常见原因: 缺少类型定义、any 使用、未处理 null/undefined
```

**"数据库连接失败"**:
1. 检查 `backend/config.py` 的 SQL Server 配置
2. 验证网络连接: `ping 10.88.43.154`
3. 运行测试脚本: `python backend/database.py`

**"Excel 导入失败"**:
- 检查格式: 参考 `SKILL_IMPORT_FORMAT_GUIDE.md`
- 验证列头: C/T 标记在第 6 行 (索引 5)
- 查看浏览器 Console 的 🔍 日志

**"Supabase RLS 错误"**:
- 开发环境 RLS 已禁用
- 生产环境运行 `DATABASE_RESTRUCTURE_FIXED.sql`

### Debug Tools
- **Frontend**: Chrome DevTools + React Query DevTools
- **Backend**: FastAPI `/api/docs` Swagger UI
- **Database**: SSMS (SQL Server Management Studio)
- **Network**: Chrome Network tab (观察 API 请求)

## Documentation Maintenance

**新功能必须包含**:
1. 代码注释 (中文关键逻辑)
2. API 文档 (FastAPI 自动生成)
3. 用户指南 (如有 UI 变更)
4. 更新 Copilot 指令 (如有架构变更)

**文档命名规范**:
- `*_GUIDE.md` - 用户指南
- `*_README.md` - 模块说明
- `*_MIGRATION.md` - 迁移记录
- `*_FIX.md` - Bug 修复记录

## Quick References

**Backend API**: `http://localhost:8000/api/docs` (FastAPI Swagger UI)  
**Frontend Dev Server**: `http://localhost:5173`  
**SQL Server**: `10.88.43.154` / `DCCT_BPS_Debug` database (内网专用)  
**Supabase**: `https://wpbgzcmpwsktoaowwkpj.supabase.co` (legacy)
