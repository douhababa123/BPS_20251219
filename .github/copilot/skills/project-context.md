# BPS Project Context Skill

**Description**: Understand the overall architecture, business context, and key components of the BPS Capacity & Scheduling Platform.

**Usage**: Use this skill when you need high-level project context or navigating the codebase.

## Project Overview

### Business Domain
**BPS (Bosch Production System)** - Manufacturing competency assessment and resource planning platform

**Key Users**:
- **Admin**: Full system access, data import, configuration
- **Site PS (Production System)**: Department-level management
- **BPS Engineer**: Individual competency tracking, schedule planning

### Core Modules
1. **能力画像 (Competency Intelligence)** - Team/individual skill analysis
2. **能力评估 (Competency Assessment)** - Detailed skill matrix
3. **数据导入 (Data Import)** - Excel import for skills & assessments
4. **资源规划 (Resource Planning)** - Engineer scheduling & task allocation
5. **匹配 (Matching)** - Smart engineer-task matching algorithm
6. **总览 (Dashboard)** - KPI overview and quick insights

## Architecture

### Technology Stack
```
Frontend:
├─ React 18.3.1
├─ TypeScript 5.5.3 (strict mode)
├─ Vite 5.4.2 (dev server + build)
├─ TailwindCSS 3.4.1 (styling)
├─ TanStack Query 5.90.7 (data fetching)
├─ Recharts 3.4.1 (charts)
├─ React Hook Form 7.66.0 (forms)
└─ Zod 4.1.12 (validation)

Backend:
├─ FastAPI (Python) - REST API
├─ pyodbc - SQL Server driver
└─ Custom OTP auth

Database:
```
Backend: FastAPI (Python)
├─ SQL Server 10.88.43.154 (production)
└─ Supabase (fully deprecated)
```

### Migration Status
**Current State**: Fully migrated to SQL Server

| Module | Backend | Status |
|--------|---------|--------|
| Competency Assessment | SQL Server + FastAPI | ✅ Complete |
| Schedule/Calendar | SQL Server + FastAPI | ✅ Complete |
| Import/Skills | SQL Server + FastAPI | ✅ Complete |
| Resource Planning | SQL Server + FastAPI | ✅ Complete |

**All features now use**: SQL Server + FastAPI exclusively

## Data Model

### Core Entities
```
departments (部门)
  ├─ employees (员工)
  │   └─ competency_assessments (能力评估)
  └─ skills (技能)
      ├─ 9 modules (模块)
      └─ 39+ skills (技能项)
```

### 9 Competency Modules
1. BPS elements (BPS 要素)
2. Investment efficiency (PGL/IE) (投资效率)
3. Waste-free flow (TPM/LBP) (无浪费流程)
4. Everybody's CIP (全员改善)
5. Leadership commitment (领导力承诺)
6. CIP indirect LEAN (间接精益)
7. Digital Transformation (数字化转型)
8. Quality Management (质量管理)
9. Problem Solving (问题解决)

**Critical Constraint**: Module list is hardcoded in `src/lib/skillDefinitionParser.ts` - requires multi-file update to extend.

### Competency Levels
```
L1: Know it      - 了解概念
L2: Do it        - 能够执行
L3: Teach it     - 可以教导
L4: Lead it      - 能够领导
L5: Innovate it  - 创新改进
```

## Project Structure

```
BPS_20251219/
├─ .github/
│  ├─ copilot-instructions.md  # AI coding guidelines
│  └─ copilot/skills/          # Agent skills (this folder)
├─ backend/
│  ├─ main.py                  # FastAPI app entry
│  ├─ database.py              # SQL Server connection
│  ├─ config.py                # Configuration
│  ├─ auth.py                  # JWT + OTP logic
│  ├─ routers/                 # API endpoints
│  └─ tests/                   # pytest tests
├─ src/
│  ├─ components/              # Reusable UI (Header, Sidebar)
│  ├─ contexts/                # React Context (PersonaContext)
│  ├─ lib/
│  │  ├─ constants.ts          # Data dictionaries
│  │  ├─ types.ts              # TypeScript types
│  │  ├─ supabaseService.ts    # Supabase wrapper
│  │  ├─ skillDefinitionParser.ts  # Excel skill parser
│  │  ├─ complexExcelParser.ts     # Excel assessment parser
│  │  └─ competencyAggregation.ts  # Stats calculations
│  └─ pages/
│     ├─ Dashboard.tsx         # Main overview
│     ├─ Competency.tsx        # Skill analysis
│     ├─ CompetencyAssessment.tsx  # Skill matrix
│     ├─ ImportNew.tsx         # Data import
│     ├─ Schedule.tsx          # Resource planning
│     └─ Matching.tsx          # Smart matching
├─ SQLSERVER_SCHEMA.sql        # Database schema (authoritative)
├─ SKILL_IMPORT_FORMAT_GUIDE.md  # User import guide
└─ openspec/                   # Spec-driven development
   ├─ AGENTS.md                # OpenSpec workflow
   ├─ project.md               # Project conventions
   └─ specs/                   # Feature specifications
```

## Key Files Reference

### Must-Read Before Coding
1. `.github/copilot-instructions.md` - Development guidelines
2. `SQLSERVER_SCHEMA.sql` - Database structure
3. `src/lib/database.types.ts` - TypeScript interfaces
4. `backend/config.py` - Environment configuration

### Import Functionality
1. `SKILL_IMPORT_FORMAT_GUIDE.md` - User-facing format docs
2. `src/lib/skillDefinitionParser.ts` - Skills import
3. `src/lib/complexExcelParser.ts` - Assessments import
4. `src/lib/excelResourceParser.ts` - Resource planning import

### Testing
1. `backend/tests/conftest.py` - Pytest fixtures
2. `backend/test_login.py` - Auth flow test
3. `src/pages/DatabaseCheck.tsx` - Frontend DB validation

## Business Rules

### Role Gating
```typescript
// Engineers need minimum competency thresholds by role
ROLE_THRESHOLDS = {
  Member: { keyItem: 2.5, moduleMean: 2.0 },
  Coach: { keyItem: 3.0, moduleMean: 2.5 },
  Lead: { keyItem: 4.0, moduleMean: 3.5 },
  Expert: { keyItem: 4.5, moduleMean: 4.0 }
}
```

### Task Types (Resource Planning)
11 standard types: WS, SW, P, T, C, M, L, SD, A, S, O  
Users can add custom types via UI

### Assessment Constraints
- Current level: 1-5 (integer)
- Target level >= Current level
- Gap = Target - Current
- Gap >= 2 = "Critical" priority

## Development Workflows

### Adding New Feature
1. Check if requires OpenSpec proposal (`openspec/AGENTS.md`)
2. If breaking change → create proposal
3. If bug fix → implement directly
4. Update `.github/copilot-instructions.md` if architecture changes

### Database Changes
1. Update `SQLSERVER_SCHEMA.sql`
2. Update `src/lib/database.types.ts`
3. Update `backend/routers/` API if needed
4. Run migrations on SQL Server
5. Test with `backend/database.py`

### Import Changes
1. Update parser (`skillDefinitionParser.ts` or `complexExcelParser.ts`)
2. Update `SKILL_IMPORT_FORMAT_GUIDE.md`
3. Test with sample Excel files
4. Verify error reporting shows row/column numbers

## Common Patterns

### React Query Usage
```typescript
const { data, isLoading, error } = useQuery({
  queryKey: ['employees'],
  queryFn: getAllEmployees,
  staleTime: 5 * 60 * 1000
});
```

### FastAPI Route Pattern
```python
@router.get("/api/employees")
async def get_employees(db_cursor=Depends(get_db_cursor)):
    cursor.execute("SELECT * FROM employees WHERE is_active = 1")
    return cursor.fetchall()
```

### Error Handling
```typescript
// Frontend: Show toast, don't throw
if (error) {
  toast.error(error.message);
  return;
}

// Backend: Use HTTPException
raise HTTPException(status_code=404, detail="员工未找到")
```

## Contact & Resources

**Documentation Hub**: Project root `.md` files  
**API Docs**: `http://localhost:8000/api/docs`  
**Dev Server**: `http://localhost:5173`  
**Database**: Internal Bosch network required for SQL Server

**Key Concepts**:
- **Migrated architecture** = Fully on SQL Server (from Supabase)
- **9 modules** = hardcoded, requires special procedure to extend
- **TDD** = Write tests first (see `testing-commands.md`)
- **Copilot skills** = This folder!
