# Competency Assessment Editing and Quarterly History Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow authorized users to edit 0–5 competency current/target values from the matrix while atomically preserving every change as queryable quarterly history.

**Architecture:** Keep `competency_assessments` as one latest projection per employee and skill, and add an append-only `competency_assessment_history` table. A FastAPI domain module owns identity authorization, validation, quarter calculation and transactional upsert/history insertion; a dedicated matrix endpoint supplies nullable cells and edit hints without changing persisted-only analytics reads. React keeps editing inside an accessible modal opened from the default matrix and reloads the complete assessment page after save.

**Tech Stack:** SQL Server/T-SQL, Python 3/FastAPI/Pydantic/pyodbc/pytest, React 18/TypeScript/Vitest/Testing Library/TailwindCSS, GitHub Actions self-hosted Jetson deployment.

## Global Constraints

- Current and target levels are required integers from 0 through 5 inclusive; zero is assessed data, not missing data.
- Target level must be greater than or equal to current level in both client and server validation.
- Role `admin` may edit/query all employees; role `user` may edit/query only the employee matched by normalized email.
- Every successful save updates one latest projection and appends exactly one history snapshot in one transaction.
- The default matrix is editable; card and table views remain read-only.
- Equal current/target is green with no GAP label; positive GAP is red with `GAP N`, with no magnitude-based color variation.
- Preserve unrelated dirty worktree files, caches, screenshots and user documents.
- Do not execute the production migration until a Jetson SQL Server backup or verified restore point exists.

---

## File Structure

- `backend/migrations/005_competency_assessment_history.sql`: idempotent transactional schema/baseline migration and validations.
- `backend/verify_competency_assessment_history_migration.py`: read-only preflight/postflight report for counts, duplicates and constraints.
- `backend/competency_assessment_history.py`: pure validation/quarter helpers plus authorization and transactional persistence functions.
- `backend/models.py`: save, matrix and history request/response models.
- `backend/routers/competency_assessments.py`: matrix, unified save and history HTTP endpoints; existing persisted-only reads remain compatible.
- `backend/tests/test_competency_assessment_history.py`: focused unit tests using controlled cursor/user fixtures.
- `backend/tests/test_competency_assessment_migration.py`: migration contract and verification-query tests.
- `SQLSERVER_SCHEMA.sql`: clean-install schema matching the migration end state.
- `src/lib/database.types.ts`: matrix cell, edit permission and history types.
- `src/lib/competencyApi.ts`: matrix fetch, save call and zero-inclusive aggregation.
- `src/components/AssessmentEditDialog.tsx`: accessible linked-select editing dialog.
- `src/components/MatrixView.tsx`: editable/read-only cells and uniform GAP presentation.
- `src/pages/CompetencyAssessment.tsx`: dialog save callback and whole-page refresh; card/table remain unchanged.
- `src/components/__tests__/AssessmentEditDialog.test.tsx`: dialog validation/submission tests.
- `src/components/__tests__/MatrixView.test.tsx`: permission, keyboard and color tests.
- `src/lib/__tests__/competencyApi.test.ts`: zero-inclusive matrix aggregation tests.

### Task 1: Transactional schema and baseline migration

**Files:**
- Create: `backend/migrations/005_competency_assessment_history.sql`
- Create: `backend/verify_competency_assessment_history_migration.py`
- Create: `backend/tests/test_competency_assessment_migration.py`
- Modify: `SQLSERVER_SCHEMA.sql:140`

**Interfaces:**
- Produces: `dbo.competency_assessment_history`, unique key `UQ_competency_assessments_employee_skill`, checks `CK_competency_assessments_current_0_5`, `CK_competency_assessments_target_0_5`, and `CK_competency_assessments_target_gte_current`.
- Produces: verification command `python backend/verify_competency_assessment_history_migration.py` that exits nonzero on a failed invariant.

- [ ] **Step 1: Write the failing migration contract test**

```python
# backend/tests/test_competency_assessment_migration.py
from pathlib import Path

SQL = Path("backend/migrations/005_competency_assessment_history.sql").read_text(encoding="utf-8")


def test_migration_declares_history_and_atomic_validation():
    required = [
        "SET XACT_ABORT ON",
        "BEGIN TRANSACTION",
        "competency_assessment_history",
        "MIGRATION_BASELINE",
        "ROW_NUMBER() OVER",
        "UQ_competency_assessments_employee_skill",
        "current_level BETWEEN 0 AND 5",
        "target_level BETWEEN 0 AND 5",
        "target_level >= current_level",
        "THROW",
        "COMMIT TRANSACTION",
    ]
    for fragment in required:
        assert fragment in SQL


def test_migration_preserves_every_legacy_row_before_deduplication():
    copy_at = SQL.index("INSERT INTO dbo.competency_assessment_history")
    delete_at = SQL.index("DELETE ca", copy_at)
    assert copy_at < delete_at
    assert "@legacy_count" in SQL
    assert "@baseline_count" in SQL
```

- [ ] **Step 2: Run the contract test and verify it fails because the migration is absent**

Run: `python -m pytest backend/tests/test_competency_assessment_migration.py -q`

Expected: FAIL with `FileNotFoundError` for `005_competency_assessment_history.sql`.

- [ ] **Step 3: Implement the idempotent migration**

Create the migration with these concrete columns and rules:

```sql
SET XACT_ABORT ON;
BEGIN TRY
    BEGIN TRANSACTION;

    DECLARE @legacy_count BIGINT = (SELECT COUNT_BIG(*) FROM dbo.competency_assessments);

    IF OBJECT_ID('dbo.competency_assessment_history', 'U') IS NULL
    BEGIN
        CREATE TABLE dbo.competency_assessment_history (
            id UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_competency_assessment_history PRIMARY KEY DEFAULT NEWID(),
            assessment_id UNIQUEIDENTIFIER NOT NULL,
            source_assessment_id UNIQUEIDENTIFIER NULL,
            employee_id UNIQUEIDENTIFIER NOT NULL,
            skill_id BIGINT NOT NULL,
            current_level INT NOT NULL,
            target_level INT NOT NULL,
            gap AS (target_level - current_level) PERSISTED,
            assessment_date DATETIME2 NOT NULL,
            assessment_year INT NOT NULL,
            assessment_quarter TINYINT NOT NULL,
            notes NVARCHAR(MAX) NULL,
            changed_at DATETIME2 NOT NULL,
            changed_by_user_id UNIQUEIDENTIFIER NULL,
            change_source NVARCHAR(32) NOT NULL,
            CONSTRAINT CK_competency_history_current_0_5 CHECK (current_level BETWEEN 0 AND 5),
            CONSTRAINT CK_competency_history_target_0_5 CHECK (target_level BETWEEN 0 AND 5),
            CONSTRAINT CK_competency_history_target_gte_current CHECK (target_level >= current_level),
            CONSTRAINT CK_competency_history_quarter CHECK (assessment_quarter BETWEEN 1 AND 4),
            CONSTRAINT CK_competency_history_source CHECK (change_source IN ('MIGRATION_BASELINE', 'WEB_EDIT'))
        );
        CREATE INDEX IX_competency_history_employee_skill_changed
            ON dbo.competency_assessment_history(employee_id, skill_id, changed_at DESC);
        CREATE INDEX IX_competency_history_year_quarter
            ON dbo.competency_assessment_history(assessment_year, assessment_quarter, changed_at DESC);
    END;

    SELECT
        ca.id AS source_assessment_id,
        ca.employee_id,
        ca.skill_id,
        ca.current_level,
        ca.target_level,
        ca.assessment_date,
        ca.assessment_year,
        ca.notes,
        ca.created_at,
        ca.updated_at,
        FIRST_VALUE(ca.id) OVER (
            PARTITION BY ca.employee_id, ca.skill_id
            ORDER BY ca.assessment_date DESC, ca.updated_at DESC, ca.created_at DESC, ca.id DESC
        ) AS retained_assessment_id,
        ROW_NUMBER() OVER (
            PARTITION BY ca.employee_id, ca.skill_id
            ORDER BY ca.assessment_date DESC, ca.updated_at DESC, ca.created_at DESC, ca.id DESC
        ) AS rn
    INTO #ranked_assessments
    FROM dbo.competency_assessments ca;

    INSERT INTO dbo.competency_assessment_history (
        assessment_id, source_assessment_id, employee_id, skill_id,
        current_level, target_level, assessment_date, assessment_year,
        assessment_quarter, notes, changed_at, changed_by_user_id, change_source
    )
    SELECT
        r.retained_assessment_id,
        r.source_assessment_id,
        r.employee_id,
        r.skill_id,
        r.current_level,
        r.target_level,
        COALESCE(CAST(r.assessment_date AS DATETIME2), r.updated_at, r.created_at, GETDATE()),
        YEAR(COALESCE(CAST(r.assessment_date AS DATETIME2), r.updated_at, r.created_at, GETDATE())),
        DATEPART(QUARTER, COALESCE(CAST(r.assessment_date AS DATETIME2), r.updated_at, r.created_at, GETDATE())),
        r.notes,
        COALESCE(r.updated_at, CAST(r.assessment_date AS DATETIME2), r.created_at, GETDATE()),
        NULL,
        'MIGRATION_BASELINE'
    FROM #ranked_assessments r
    WHERE NOT EXISTS (
        SELECT 1 FROM dbo.competency_assessment_history h
        WHERE h.source_assessment_id = r.source_assessment_id
          AND h.change_source = 'MIGRATION_BASELINE'
    );

    DELETE ca
    FROM dbo.competency_assessments ca
    INNER JOIN #ranked_assessments r ON r.source_assessment_id = ca.id
    WHERE r.rn > 1;

    DECLARE @baseline_count BIGINT = (
        SELECT COUNT_BIG(*) FROM dbo.competency_assessment_history
        WHERE change_source = 'MIGRATION_BASELINE'
    );
    IF @baseline_count < @legacy_count THROW 51001, 'History baseline count is lower than legacy assessment count', 1;

    DECLARE @constraint_name SYSNAME;
    DECLARE constraint_cursor CURSOR LOCAL FAST_FORWARD FOR
        SELECT cc.name
        FROM sys.check_constraints cc
        WHERE cc.parent_object_id = OBJECT_ID('dbo.competency_assessments')
          AND (
              cc.definition LIKE '%current_level%'
              OR cc.definition LIKE '%target_level%'
          );
    OPEN constraint_cursor;
    FETCH NEXT FROM constraint_cursor INTO @constraint_name;
    WHILE @@FETCH_STATUS = 0
    BEGIN
        EXEC('ALTER TABLE dbo.competency_assessments DROP CONSTRAINT ' + QUOTENAME(@constraint_name));
        FETCH NEXT FROM constraint_cursor INTO @constraint_name;
    END;
    CLOSE constraint_cursor;
    DEALLOCATE constraint_cursor;

    IF EXISTS (
        SELECT 1 FROM sys.key_constraints
        WHERE parent_object_id = OBJECT_ID('dbo.competency_assessments')
          AND name = 'uq_assessments_emp_skill_year'
    ) ALTER TABLE dbo.competency_assessments DROP CONSTRAINT uq_assessments_emp_skill_year;

    IF NOT EXISTS (SELECT 1 FROM sys.key_constraints WHERE name = 'UQ_competency_assessments_employee_skill')
        ALTER TABLE dbo.competency_assessments ADD CONSTRAINT UQ_competency_assessments_employee_skill UNIQUE(employee_id, skill_id);
    IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK_competency_assessments_current_0_5')
        ALTER TABLE dbo.competency_assessments ADD CONSTRAINT CK_competency_assessments_current_0_5 CHECK (current_level BETWEEN 0 AND 5);
    IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK_competency_assessments_target_0_5')
        ALTER TABLE dbo.competency_assessments ADD CONSTRAINT CK_competency_assessments_target_0_5 CHECK (target_level BETWEEN 0 AND 5);
    IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK_competency_assessments_target_gte_current')
        ALTER TABLE dbo.competency_assessments ADD CONSTRAINT CK_competency_assessments_target_gte_current CHECK (target_level >= current_level);

    IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_competency_history_assessment')
        ALTER TABLE dbo.competency_assessment_history ADD CONSTRAINT FK_competency_history_assessment
            FOREIGN KEY (assessment_id) REFERENCES dbo.competency_assessments(id);
    IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_competency_history_employee')
        ALTER TABLE dbo.competency_assessment_history ADD CONSTRAINT FK_competency_history_employee
            FOREIGN KEY (employee_id) REFERENCES dbo.employees(id);
    IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_competency_history_skill')
        ALTER TABLE dbo.competency_assessment_history ADD CONSTRAINT FK_competency_history_skill
            FOREIGN KEY (skill_id) REFERENCES dbo.skills(id);
    IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_competency_history_user')
        ALTER TABLE dbo.competency_assessment_history ADD CONSTRAINT FK_competency_history_user
            FOREIGN KEY (changed_by_user_id) REFERENCES dbo.users(id);

    IF EXISTS (
        SELECT 1 FROM dbo.competency_assessments
        GROUP BY employee_id, skill_id HAVING COUNT_BIG(*) > 1
    ) THROW 51002, 'Duplicate current assessment projections remain', 1;

    COMMIT TRANSACTION;
END TRY
BEGIN CATCH
    IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
    THROW;
END CATCH;
```

Create the two history indexes with `IF NOT EXISTS` guards before the validation block. This exact ordering ensures every legacy row is copied before duplicate projections are removed and makes a rerun leave baseline rows unchanged.

- [ ] **Step 4: Add the read-only verification script**

```python
# backend/verify_competency_assessment_history_migration.py
from database import db

CHECKS = {
    "history_table": "SELECT COUNT(*) FROM sys.tables WHERE object_id = OBJECT_ID('dbo.competency_assessment_history')",
    "current_duplicates": """SELECT COUNT(*) FROM (
        SELECT employee_id, skill_id FROM dbo.competency_assessments
        GROUP BY employee_id, skill_id HAVING COUNT(*) > 1
    ) d""",
    "invalid_current": """SELECT COUNT(*) FROM dbo.competency_assessments
        WHERE current_level NOT BETWEEN 0 AND 5 OR target_level NOT BETWEEN 0 AND 5
           OR target_level < current_level""",
    "invalid_history": """SELECT COUNT(*) FROM dbo.competency_assessment_history
        WHERE current_level NOT BETWEEN 0 AND 5 OR target_level NOT BETWEEN 0 AND 5
           OR target_level < current_level OR assessment_quarter NOT BETWEEN 1 AND 4""",
}


def main() -> int:
    with db.get_cursor() as cursor:
        results = {}
        for name, sql in CHECKS.items():
            cursor.execute(sql)
            results[name] = int(cursor.fetchone()[0])
    print(results)
    return 0 if results["history_table"] == 1 and all(
        results[name] == 0 for name in ("current_duplicates", "invalid_current", "invalid_history")
    ) else 1


if __name__ == "__main__":
    raise SystemExit(main())
```

- [ ] **Step 5: Update the clean-install schema and run tests**

Change `SQLSERVER_SCHEMA.sql` so current level accepts 0, target accepts 0, the unique key is `(employee_id, skill_id)`, and the history table matches the migration exactly.

Run: `python -m pytest backend/tests/test_competency_assessment_migration.py -q`

Expected: PASS.

- [ ] **Step 6: Commit the migration task**

```bash
git add backend/migrations/005_competency_assessment_history.sql backend/verify_competency_assessment_history_migration.py backend/tests/test_competency_assessment_migration.py SQLSERVER_SCHEMA.sql
git commit -m "feat: add competency assessment history schema"
```

### Task 2: Backend validation, authorization, atomic save and history query

**Files:**
- Create: `backend/competency_assessment_history.py`
- Create: `backend/tests/test_competency_assessment_history.py`
- Modify: `backend/models.py:352`
- Modify: `backend/routers/competency_assessments.py`

**Interfaces:**
- Produces: `quarter_for(value: datetime) -> int`.
- Produces: `resolve_employee_scope(cursor, current_user: dict, employee_id: UUID, allow_all_admin: bool = True) -> None` raising HTTP 403/404.
- Produces: `save_latest_assessment(cursor, employee_id: UUID, skill_id: int, payload: CompetencyAssessmentSave, current_user: dict) -> dict`.
- Produces: `PUT /api/competency-assessments/employee/{employee_id}/skill/{skill_id}`.
- Produces: `GET /api/competency-assessments/matrix` and `GET /api/competency-assessments/history`.

- [ ] **Step 1: Write failing domain tests**

```python
# backend/tests/test_competency_assessment_history.py
from datetime import datetime, timezone
from unittest.mock import MagicMock
from uuid import uuid4
import pytest
from fastapi import HTTPException
from pydantic import ValidationError

from models import CompetencyAssessmentSave
from competency_assessment_history import quarter_for, resolve_employee_scope


@pytest.mark.parametrize(("month", "quarter"), [(1, 1), (3, 1), (4, 2), (6, 2), (7, 3), (9, 3), (10, 4), (12, 4)])
def test_quarter_for_calendar_boundaries(month, quarter):
    assert quarter_for(datetime(2026, month, 1, tzinfo=timezone.utc)) == quarter


def test_save_model_rejects_target_below_current():
    with pytest.raises(ValidationError):
        CompetencyAssessmentSave(current_level=4, target_level=3)


def test_save_model_accepts_zero():
    value = CompetencyAssessmentSave(current_level=0, target_level=0)
    assert value.current_level == 0


def test_normal_user_cannot_access_other_employee():
    cursor = MagicMock()
    cursor.fetchone.return_value = (str(uuid4()), "other@bosch.com")
    with pytest.raises(HTTPException) as exc:
        resolve_employee_scope(cursor, {"role": "user", "email": "self@bosch.com"}, uuid4())
    assert exc.value.status_code == 403


def test_admin_can_access_any_existing_employee():
    cursor = MagicMock()
    cursor.fetchone.return_value = (str(uuid4()), "other@bosch.com")
    resolve_employee_scope(cursor, {"role": "admin", "email": "admin@bosch.com"}, uuid4())
```

- [ ] **Step 2: Run the domain tests and verify missing models/module failures**

Run: `python -m pytest backend/tests/test_competency_assessment_history.py -q`

Expected: FAIL importing `CompetencyAssessmentSave` or `competency_assessment_history`.

- [ ] **Step 3: Add Pydantic save/matrix/history models**

```python
# backend/models.py
from pydantic import model_validator

class CompetencyAssessmentSave(BaseModel):
    current_level: int = Field(..., ge=0, le=5)
    target_level: int = Field(..., ge=0, le=5)
    notes: Optional[str] = Field(None, max_length=2000)

    @model_validator(mode="after")
    def validate_target(self):
        if self.target_level < self.current_level:
            raise ValueError("目标能力必须大于或等于能力现状")
        return self


class CompetencyAssessmentHistoryResponse(BaseModel):
    id: UUID
    assessment_id: UUID
    employee_id: UUID
    skill_id: int
    current_level: int
    target_level: int
    gap: int
    assessment_year: int
    assessment_quarter: int
    notes: Optional[str] = None
    changed_at: datetime
    changed_by_user_id: Optional[UUID] = None
    change_source: str
```

- [ ] **Step 4: Implement domain helpers and atomic persistence**

```python
# backend/competency_assessment_history.py
from datetime import datetime
from fastapi import HTTPException


def quarter_for(value: datetime) -> int:
    return ((value.month - 1) // 3) + 1


def resolve_employee_scope(cursor, current_user: dict, employee_id, allow_all_admin: bool = True) -> None:
    cursor.execute("SELECT id, LOWER(LTRIM(RTRIM(email))) FROM dbo.employees WHERE id = ? AND is_active = 1", str(employee_id))
    employee = cursor.fetchone()
    if not employee:
        raise HTTPException(status_code=404, detail="员工不存在")
    if allow_all_admin and str(current_user.get("role", "")).lower() == "admin":
        return
    user_email = str(current_user.get("email", "")).strip().lower()
    if not employee[1] or employee[1] != user_email:
        raise HTTPException(status_code=403, detail="只能访问本人的能力评估")


def save_latest_assessment(cursor, employee_id, skill_id: int, payload, current_user: dict) -> str:
    resolve_employee_scope(cursor, current_user, employee_id)
    cursor.execute("SELECT id FROM dbo.skills WHERE id = ? AND ISNULL(is_active, 1) = 1", skill_id)
    if not cursor.fetchone():
        raise HTTPException(status_code=404, detail="技能不存在")
    now = datetime.now()
    cursor.execute("""SELECT id FROM dbo.competency_assessments WITH (UPDLOCK, HOLDLOCK)
                      WHERE employee_id = ? AND skill_id = ?""", str(employee_id), skill_id)
    row = cursor.fetchone()
    if row:
        assessment_id = str(row[0])
        cursor.execute("""UPDATE dbo.competency_assessments
            SET current_level=?, target_level=?, assessment_year=?, assessment_date=?, notes=?, updated_at=?
            WHERE id=?""", payload.current_level, payload.target_level, now.year, now, payload.notes, now, assessment_id)
    else:
        cursor.execute("SELECT NEWID()")
        assessment_id = str(cursor.fetchone()[0])
        cursor.execute("""INSERT INTO dbo.competency_assessments
            (id, employee_id, skill_id, current_level, target_level, assessment_year, assessment_date, notes, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            assessment_id, str(employee_id), skill_id, payload.current_level, payload.target_level,
            now.year, now, payload.notes, now, now)
    cursor.execute("""INSERT INTO dbo.competency_assessment_history
        (assessment_id, employee_id, skill_id, current_level, target_level, assessment_date,
         assessment_year, assessment_quarter, notes, changed_at, changed_by_user_id, change_source)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'WEB_EDIT')""",
        assessment_id, str(employee_id), skill_id, payload.current_level, payload.target_level, now,
        now.year, quarter_for(now), payload.notes, now, current_user.get("user_id"))
    return assessment_id
```

Do not call `commit()` inside this helper. The existing `get_db()` context commits only after the route finishes and rolls back any exception, preserving atomicity.

- [ ] **Step 5: Add endpoint tests for one history row and rollback**

Extend the test file with a cursor fixture that records SQL and returns an existing assessment. Assert the successful call contains exactly one `UPDATE dbo.competency_assessments` and one `INSERT INTO dbo.competency_assessment_history`. Configure the history `execute` call to raise `RuntimeError`, call through a test transaction wrapper, and assert `rollback()` is called while `commit()` is not.

Run: `python -m pytest backend/tests/test_competency_assessment_history.py -q`

Expected: PASS for validation, scope, SQL call count and rollback cases.

- [ ] **Step 6: Add routes with static paths before `/{assessment_id}`**

Implement these routes before the generic UUID route so FastAPI does not interpret `matrix` or `history` as an assessment ID:

```python
@router.get("/matrix")
def get_assessment_matrix(cursor=Depends(get_db), current_user=Depends(get_current_user)):
    cursor.execute("""SELECT e.id, e.employee_id, e.name, d.name, LOWER(LTRIM(RTRIM(e.email)))
                      FROM dbo.employees e LEFT JOIN dbo.departments d ON d.id=e.department_id
                      WHERE e.is_active=1 ORDER BY e.name""")
    employees = cursor.fetchall()
    cursor.execute("""SELECT id, module_id, module_name, skill_name, COALESCE(display_order, 0)
                      FROM dbo.skills WHERE ISNULL(is_active, 1)=1
                      ORDER BY module_id, display_order, id""")
    skill_rows = cursor.fetchall()
    cursor.execute("""SELECT employee_id, skill_id, current_level, target_level,
                             COALESCE(gap, target_level-current_level)
                      FROM dbo.competency_assessments""")
    cells = {(str(row[0]), row[1]): row for row in cursor.fetchall()}
    is_admin = str(current_user.get("role", "")).lower() == "admin"
    email = str(current_user.get("email", "")).strip().lower()
    rows = []
    for employee in employees:
        employee_id = str(employee[0])
        skills = {}
        for skill in skill_rows:
            cell = cells.get((employee_id, skill[0]))
            if cell:
                skills[skill[0]] = {
                    "skillId": skill[0], "currentLevel": cell[2],
                    "targetLevel": cell[3], "gap": cell[4],
                }
        rows.append({
            "employeeId": employee_id,
            "employeeCode": employee[1] or "",
            "employeeName": employee[2] or "",
            "departmentName": employee[3],
            "canEdit": is_admin or bool(employee[4] and employee[4] == email),
            "skills": skills,
        })
    columns = [{
        "skillId": row[0], "moduleId": row[1], "moduleName": row[2] or "",
        "skillName": row[3] or "", "displayOrder": row[4],
    } for row in skill_rows]
    values = list(cells.values())
    total_gap = sum(row[4] for row in values)
    return {
        "rows": rows,
        "columns": columns,
        "stats": {
            "totalEmployees": len(rows), "totalSkills": len(columns),
            "totalAssessments": len(values),
            "avgCurrentLevel": round(sum(row[2] for row in values) / len(values), 1) if values else 0,
            "avgTargetLevel": round(sum(row[3] for row in values) / len(values), 1) if values else 0,
            "avgGap": round(total_gap / len(values), 1) if values else 0,
            "totalGapScore": total_gap,
        },
    }


@router.put("/employee/{employee_id}/skill/{skill_id}")
def save_assessment(employee_id: UUID, skill_id: int, payload: CompetencyAssessmentSave,
                    cursor=Depends(get_db), current_user=Depends(get_current_user)):
    assessment_id = save_latest_assessment(cursor, employee_id, skill_id, payload, current_user)
    return get_competency_assessment(UUID(assessment_id), cursor)


@router.get("/history", response_model=list[CompetencyAssessmentHistoryResponse])
def get_history(employee_id: UUID, skill_id: int | None = None, year: int | None = None,
                quarter: int | None = Query(None, ge=1, le=4), latest_per_quarter: bool = False,
                cursor=Depends(get_db), current_user=Depends(get_current_user)):
    resolve_employee_scope(cursor, current_user, employee_id)
    filters = ["employee_id = ?"]
    params = [str(employee_id)]
    if skill_id is not None:
        filters.append("skill_id = ?")
        params.append(skill_id)
    if year is not None:
        filters.append("assessment_year = ?")
        params.append(year)
    if quarter is not None:
        filters.append("assessment_quarter = ?")
        params.append(quarter)
    where_sql = " AND ".join(filters)
    columns = """id, assessment_id, employee_id, skill_id, current_level, target_level,
                 gap, assessment_year, assessment_quarter, notes, changed_at,
                 changed_by_user_id, change_source"""
    if latest_per_quarter:
        sql = f"""WITH ranked AS (
            SELECT {columns}, ROW_NUMBER() OVER (
                PARTITION BY employee_id, skill_id, assessment_year, assessment_quarter
                ORDER BY changed_at DESC, id DESC
            ) AS rn
            FROM dbo.competency_assessment_history WHERE {where_sql}
        ) SELECT {columns} FROM ranked WHERE rn=1 ORDER BY changed_at DESC, id DESC"""
    else:
        sql = f"""SELECT {columns} FROM dbo.competency_assessment_history
                  WHERE {where_sql} ORDER BY changed_at DESC, id DESC"""
    cursor.execute(sql, params)
    return [{
        "id": row[0], "assessment_id": row[1], "employee_id": row[2], "skill_id": row[3],
        "current_level": row[4], "target_level": row[5], "gap": row[6],
        "assessment_year": row[7], "assessment_quarter": row[8], "notes": row[9],
        "changed_at": row[10], "changed_by_user_id": row[11], "change_source": row[12],
    } for row in cursor.fetchall()]
```

Keep history sorting as `changed_at DESC, id DESC` for deterministic quarterly-final selection. The only dynamically composed SQL fragments are fixed server-owned filter clauses; all user values remain bound parameters.

- [ ] **Step 7: Run backend tests and commit**

Run: `python -m pytest backend/tests/test_competency_assessment_history.py backend/tests/test_competency_assessments.py -q`

Expected: PASS; existing persisted-only endpoints remain compatible.

```bash
git add backend/competency_assessment_history.py backend/models.py backend/routers/competency_assessments.py backend/tests/test_competency_assessment_history.py
git commit -m "feat: persist competency edits with quarterly history"
```

### Task 3: Frontend API types and zero-inclusive aggregation

**Files:**
- Modify: `src/lib/database.types.ts:438`
- Modify: `src/types/api.ts:250`
- Modify: `src/lib/competencyApi.ts`
- Create: `src/lib/__tests__/competencyApi.test.ts`

**Interfaces:**
- Produces: `AssessmentSaveInput { current_level: number; target_level: number; notes?: string }`.
- Produces: `saveAssessment(employeeId: string, skillId: number, input: AssessmentSaveInput): Promise<AssessmentFull>`.
- Produces: `getAssessmentMatrix(): Promise<{ rows: MatrixRow[]; columns: MatrixColumn[]; stats: AssessmentStats }>`.
- Extends: `MatrixRow.canEdit: boolean`; skill cells remain absent when not assessed.

- [ ] **Step 1: Write failing zero and API tests**

```typescript
// src/lib/__tests__/competencyApi.test.ts
import { describe, expect, it, vi } from 'vitest';
import { apiClient } from '../api-client';
import { getMatrixData, saveAssessment } from '../competencyApi';

vi.mock('../api-client', () => ({ apiClient: { put: vi.fn() } }));

describe('competencyApi', () => {
  it('includes assessed zero values in averages and GAP', async () => {
    const matrix = await getMatrixData([
      { employee_id: 'e1', employee_code: 'E1', employee_name: 'A', department_name: null,
        skill_id: 1, module_id: 1, module_name: 'M', skill_name: 'S', display_order: 1,
        current_level: 0, target_level: 2, gap: 2 } as never,
      { employee_id: 'e2', employee_code: 'E2', employee_name: 'B', department_name: null,
        skill_id: 1, module_id: 1, module_name: 'M', skill_name: 'S', display_order: 1,
        current_level: 4, target_level: 4, gap: 0 } as never,
    ]);
    expect(matrix.stats.avgCurrentLevel).toBe(2);
    expect(matrix.stats.totalGapScore).toBe(2);
  });

  it('sends the unified employee-skill save request', async () => {
    vi.mocked(apiClient.put).mockResolvedValue({ data: { id: 'a1' } });
    await saveAssessment('e1', 7, { current_level: 0, target_level: 3, notes: 'Q3' });
    expect(apiClient.put).toHaveBeenCalledWith('/competency-assessments/employee/e1/skill/7', {
      current_level: 0, target_level: 3, notes: 'Q3',
    });
  });
});
```

- [ ] **Step 2: Run the focused test and verify it fails**

Run: `npm test -- src/lib/__tests__/competencyApi.test.ts`

Expected: FAIL because zero is filtered and `saveAssessment` is missing.

- [ ] **Step 3: Add types and minimal API implementation**

```typescript
export interface AssessmentSaveInput {
  current_level: number;
  target_level: number;
  notes?: string;
}

export async function saveAssessment(employeeId: string, skillId: number, input: AssessmentSaveInput) {
  const response = await apiClient.put(
    `/competency-assessments/employee/${employeeId}/skill/${skillId}`,
    input,
  );
  return response.data as AssessmentFull;
}

export async function getAssessmentMatrix() {
  const response = await apiClient.get('/competency-assessments/matrix');
  return response.data as { rows: MatrixRow[]; columns: MatrixColumn[]; stats: AssessmentStats };
}
```

Replace positive-only filters in `getMatrixData` with these exact collections:

```typescript
const currentValues = assessments.map(assessment => assessment.current_level);
const targetValues = assessments.map(assessment => assessment.target_level);
const completeAssessments = assessments;
const totalGap = completeAssessments.reduce((sum, assessment) => sum + assessment.gap, 0);
```

In `CompetencyAssessment.calculateSummaries`, replace `averagePositive` with:

```typescript
const averageAll = (values: number[]) => values.length > 0
  ? values.reduce((sum, value) => sum + value, 0) / values.length
  : 0;
const averageGap = (items: AssessmentFull[]) => items.length > 0
  ? items.reduce((sum, item) => sum + item.gap, 0) / items.length
  : 0;
```

Use `averageAll` for every persisted current/target collection. Add `canEdit` to `MatrixRow` and map the matrix endpoint's `can_edit` to it.

- [ ] **Step 4: Run tests, typecheck and commit**

Run: `npm test -- src/lib/__tests__/competencyApi.test.ts src/lib/__tests__/competencyAggregation.test.ts`

Expected: PASS.

Run: `npm run typecheck`

Expected: PASS.

```bash
git add src/lib/database.types.ts src/types/api.ts src/lib/competencyApi.ts src/lib/__tests__/competencyApi.test.ts src/pages/CompetencyAssessment.tsx
git commit -m "feat: add competency matrix editing API client"
```

### Task 4: Accessible edit dialog and editable matrix cells

**Files:**
- Create: `src/components/AssessmentEditDialog.tsx`
- Create: `src/components/__tests__/AssessmentEditDialog.test.tsx`
- Modify: `src/components/MatrixView.tsx`
- Modify: `src/components/__tests__/MatrixView.test.tsx`
- Modify: `src/pages/CompetencyAssessment.tsx`

**Interfaces:**
- Consumes: `AssessmentSaveInput`, `MatrixRow.canEdit`, `saveAssessment()` and `getAssessmentMatrix()` from Task 3.
- Produces: `AssessmentEditDialogProps` with `employeeName`, `skillName`, optional initial levels/notes, `onCancel()` and async `onSave(input)`.
- Extends: `MatrixView` with `onSaveAssessment(employeeId, skillId, input): Promise<void>`.

- [ ] **Step 1: Write failing dialog interaction tests**

```tsx
// src/components/__tests__/AssessmentEditDialog.test.tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import AssessmentEditDialog from '../AssessmentEditDialog';

it('offers only targets at or above current and accepts zero', async () => {
  const user = userEvent.setup();
  render(<AssessmentEditDialog employeeName="Xue Ting" skillName="WAS" onCancel={() => {}} onSave={vi.fn()} />);
  await user.selectOptions(screen.getByLabelText('能力现状'), '3');
  const options = screen.getAllByRole('option', { name: /^[0-5]$/ }).map(node => (node as HTMLOptionElement).value);
  expect(options).toEqual(expect.arrayContaining(['3', '4', '5']));
  expect(screen.queryByRole('option', { name: '2' })).not.toBeInTheDocument();
});

it('clears an invalid target when current is raised', async () => {
  const user = userEvent.setup();
  render(<AssessmentEditDialog employeeName="Xue Ting" skillName="WAS"
    initial={{ current_level: 2, target_level: 3, notes: '' }} onCancel={() => {}} onSave={vi.fn()} />);
  await user.selectOptions(screen.getByLabelText('能力现状'), '4');
  expect(screen.getByText('请重新选择不低于现状的能力目标')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: '保存' })).toBeDisabled();
});

it('retains values and shows a server error', async () => {
  const user = userEvent.setup();
  const onSave = vi.fn().mockRejectedValue(new Error('只能修改本人的能力评估'));
  render(<AssessmentEditDialog employeeName="Xue Ting" skillName="WAS" onCancel={() => {}} onSave={onSave} />);
  await user.selectOptions(screen.getByLabelText('能力现状'), '0');
  await user.selectOptions(screen.getByLabelText('能力目标'), '2');
  await user.click(screen.getByRole('button', { name: '保存' }));
  expect(await screen.findByText('只能修改本人的能力评估')).toBeInTheDocument();
  expect(screen.getByLabelText('能力现状')).toHaveValue('0');
});
```

- [ ] **Step 2: Run the dialog test and verify it fails because the component is absent**

Run: `npm test -- src/components/__tests__/AssessmentEditDialog.test.tsx`

Expected: FAIL resolving `AssessmentEditDialog`.

- [ ] **Step 3: Implement the dialog**

Use a native `<dialog open role="dialog" aria-modal="true">` or the project's modal shell. Maintain `current: number | ''`, `target: number | ''`, `notes`, `error`, and `isSaving`. Derive target options exactly as:

```tsx
const targetOptions = current === ''
  ? []
  : Array.from({ length: 6 - current }, (_, index) => current + index);

const handleCurrentChange = (next: number) => {
  setCurrent(next);
  if (target !== '' && target < next) {
    setTarget('');
    setError('请重新选择不低于现状的能力目标');
  } else {
    setError(null);
  }
};

const submit = async () => {
  if (current === '' || target === '' || target < current) return;
  setIsSaving(true);
  setError(null);
  try {
    await onSave({ current_level: current, target_level: target, notes: notes.trim() || undefined });
  } catch (reason) {
    setError(reason instanceof Error ? reason.message : '保存失败，请重试');
  } finally {
    setIsSaving(false);
  }
};
```

Employee and skill labels are read-only; Cancel is disabled during save; Save is disabled until both levels are valid and while saving. Move focus to the current select on open and return focus to the originating cell on close.

- [ ] **Step 4: Write failing matrix permission, keyboard and color tests**

Append tests that assert:

```tsx
it('opens an editable cell with Enter and leaves unauthorized cells non-interactive', async () => {
  const user = userEvent.setup();
  const onSaveAssessment = vi.fn();
  render(<MatrixView rows={[{ ...rows[0], canEdit: true }]} columns={columns} stats={stats}
    onSaveAssessment={onSaveAssessment} />);
  const cell = screen.getByRole('button', { name: /Gu Xuan.*WAS.*编辑能力评估/ });
  cell.focus();
  await user.keyboard('{Enter}');
  expect(screen.getByRole('dialog')).toBeInTheDocument();
});

it('uses green only for equality and red for every positive gap', () => {
  const colorRows = [
    { ...rows[0], employeeId: 'e0', employeeName: 'Equal', canEdit: false,
      skills: { 1: { skillId: 1, currentLevel: 0, targetLevel: 0, gap: 0 } } },
    { ...rows[0], employeeId: 'e1', employeeName: 'Small', canEdit: false,
      skills: { 1: { skillId: 1, currentLevel: 2, targetLevel: 3, gap: 1 } } },
    { ...rows[0], employeeId: 'e2', employeeName: 'Large', canEdit: false,
      skills: { 1: { skillId: 1, currentLevel: 1, targetLevel: 5, gap: 4 } } },
  ];
  render(<MatrixView rows={colorRows} columns={columns} stats={stats} onSaveAssessment={vi.fn()} />);
  expect(screen.getByText('0/0').closest('td')).toHaveClass('bg-green-50');
  expect(screen.getByText('GAP 1').closest('td')).toHaveClass('bg-red-50');
  expect(screen.getByText('GAP 4').closest('td')).toHaveClass('bg-red-50');
  expect(screen.queryByText('GAP 0')).not.toBeInTheDocument();
});
```

- [ ] **Step 5: Implement matrix editing and uniform presentation**

For editable cells, render a full-cell `<button>` with a descriptive `aria-label`; for read-only cells, keep semantic table content without click handlers. Missing editable cells render `点击录入`. Replace existing incomplete/amber logic with:

```tsx
const hasAssessment = Boolean(skill);
const positiveGap = hasAssessment && skill.gap > 0;
const cellColor = !hasAssessment
  ? 'bg-gray-50 text-gray-500'
  : positiveGap
    ? 'bg-red-50 text-red-700'
    : 'bg-green-50 text-green-700';
```

Display numeric zero directly. Update the legend to only “目标 = 现状（已达标）”, “目标 > 现状（存在 GAP）”, and “暂未录入”.

- [ ] **Step 6: Wire page refresh and preserve read-only alternate views**

Load the default matrix through `getAssessmentMatrix()`. Pass an async handler to `MatrixView`:

```tsx
const handleSaveAssessment = async (employeeId: string, skillId: number, input: AssessmentSaveInput) => {
  await saveAssessment(employeeId, skillId, input);
  await loadData();
};
```

Keep the existing card and table render branches unchanged and do not pass editing callbacks into them. Ensure `loadData()` refreshes persisted assessments, the complete matrix and all summaries after one successful save.

- [ ] **Step 7: Run frontend checks and commit**

Run: `npm test -- src/components/__tests__/AssessmentEditDialog.test.tsx src/components/__tests__/MatrixView.test.tsx src/lib/__tests__/competencyApi.test.ts`

Expected: PASS.

Run: `npm run typecheck`

Expected: PASS.

```bash
git add src/components/AssessmentEditDialog.tsx src/components/MatrixView.tsx src/components/__tests__/AssessmentEditDialog.test.tsx src/components/__tests__/MatrixView.test.tsx src/pages/CompetencyAssessment.tsx
git commit -m "feat: edit competency levels from matrix"
```

### Task 5: Full verification, migration rehearsal and Jetson release

**Files:**
- Modify: `openspec/changes/add-competency-assessment-editing-history/tasks.md`
- Create: `docs/verification/2026-07-15-competency-assessment-editing-history.md`

**Interfaces:**
- Consumes: migration, API and UI from Tasks 1–4.
- Produces: reproducible test/deployment evidence and completed OpenSpec checklist.

- [ ] **Step 1: Run the complete automated verification suite**

Run:

```bash
python -m pytest backend/tests/test_competency_assessment_migration.py backend/tests/test_competency_assessment_history.py backend/tests/test_competency_assessments.py -q
npm test
npm run typecheck
npx eslint src/components/AssessmentEditDialog.tsx src/components/MatrixView.tsx src/pages/CompetencyAssessment.tsx src/lib/competencyApi.ts
npm run build
openspec validate add-competency-assessment-editing-history --strict
```

Expected: every command exits 0; Vite produces `dist/`; OpenSpec reports the change valid.

- [ ] **Step 2: Perform read-only production preflight before migration**

Confirm the Jetson runner/service is online, then record:

```powershell
python backend/verify_competency_assessment_history_migration.py
```

Before the migration this command is expected to report `history_table: 0`; separately query and record current assessment count and duplicate employee-skill groups. Confirm a dated SQL Server backup or restore point in the verification document. Do not continue without it.

- [ ] **Step 3: Rehearse migration against a disposable/restored database**

Run the migration twice against the rehearsal database. After each run execute the verifier and these SQL assertions:

```sql
SELECT COUNT_BIG(*) AS current_count FROM dbo.competency_assessments;
SELECT COUNT_BIG(*) AS baseline_count
FROM dbo.competency_assessment_history WHERE change_source = 'MIGRATION_BASELINE';
SELECT employee_id, skill_id, COUNT_BIG(*) AS duplicate_count
FROM dbo.competency_assessments GROUP BY employee_id, skill_id HAVING COUNT_BIG(*) > 1;
```

Expected: second run changes no baseline count; duplicate query returns zero rows; verifier exits 0.

- [ ] **Step 4: Verify local administrator and engineer flows in Firefox**

Use administrator `admin@bosch.com` to save one equal-level and one positive-GAP record, and use a normal engineer account to save self and attempt another employee. Record screenshots and API results showing:

- equal values are green with no GAP;
- positive values are red with the exact GAP;
- current 0 displays as 0;
- ordinary user receives 403 for another employee;
- each successful save increments history by one and failed save increments neither table;
- card and table views have no editing action.

- [ ] **Step 5: Update OpenSpec tasks and commit release evidence**

Only after each item is evidenced, change all applicable task boxes to `[x]` and write exact commands, counts, screenshots and backup reference in `docs/verification/2026-07-15-competency-assessment-editing-history.md`.

```bash
git add openspec/changes/add-competency-assessment-editing-history/tasks.md docs/verification/2026-07-15-competency-assessment-editing-history.md
git commit -m "docs: record competency editing verification"
```

- [ ] **Step 6: Push DEV and monitor the existing GitHub Actions Jetson pipeline**

Run: `git push origin DEV`

Expected: code-quality/test job succeeds, Jetson self-hosted deployment succeeds, and `http://10.70.80.183:3000/api/health` reports healthy after deployment. If the runner loses communication, stop deployment diagnosis at infrastructure recovery and rerun the unchanged failed job; do not rewrite business code without a code-related failure.

- [ ] **Step 7: Execute deployed smoke tests and document rollback readiness**

Repeat the administrator/self/forbidden checks on Jetson. Query the saved assessment and its history to prove latest projection and history agree. If application verification fails, revert the feature commits and redeploy while leaving the compatible history table intact; if migration invariants fail, restore from the confirmed backup rather than running ad hoc destructive SQL.

## Self-Review

- Spec coverage: Tasks 1–5 cover authorization, 0–5 validation, target ordering, uniform colors, atomic history, quarterly final queries, existing-data baseline migration, read-only alternate views and Jetson verification.
- Placeholder scan: the plan contains no deferred implementation placeholders; Pydantic's `Field(...)` and TypeScript object spread are language syntax rather than omissions.
- Type consistency: `AssessmentSaveInput` maps to `CompetencyAssessmentSave`; the unified route path, `MatrixRow.canEdit`, history quarter fields and save callback signatures are consistent across backend and frontend tasks.
