# Database Migration Skill

**Description**: Reference guide for the completed Supabase to SQL Server migration in the BPS platform.

**Usage**: Use this skill when understanding the migration history, comparing old vs new architecture, or maintaining migrated code. **Note**: Migration is complete; this is for reference only.

## Capabilities

### 1. Current Architecture

**Fully Migrated System**:
```
Frontend (React + Vite)
    ↓
Backend (FastAPI)
    ↓
SQL Server Database (10.88.43.154)
├── Competency Assessment ✅
├── Authentication (OTP + JWT) ✅
├── Employees, Departments, Skills ✅
├── Schedule/Calendar ✅
├── Import functionality ✅
└── Resource Planning ✅
```

**Migration Status**: ✅ **Complete**
- All modules migrated from Supabase to SQL Server
- Supabase client code has been replaced with FastAPI endpoints
- Legacy Supabase references are for historical context only

### 2. Schema Differences

**Supabase Schema** (PostgreSQL):
```sql
-- uuid primary keys
CREATE TABLE employees (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    employee_id text UNIQUE NOT NULL,
    name text NOT NULL,
    department_id uuid REFERENCES departments(id),
    email text,
    created_at timestamptz DEFAULT now()
);

-- RLS enabled
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read" ON employees FOR SELECT USING (true);
```

**SQL Server Schema**:
```sql
-- INT IDENTITY primary keys
CREATE TABLE employees (
    id INT IDENTITY(1,1) PRIMARY KEY,
    employee_id NVARCHAR(50) UNIQUE NOT NULL,
    name NVARCHAR(100) NOT NULL,
    department_id INT REFERENCES departments(id),
    email NVARCHAR(255),
    is_active BIT DEFAULT 1,
    created_at DATETIME DEFAULT GETDATE()
);

-- No RLS (use application-level auth)
```

**Key Differences**:

| Feature | Supabase (PostgreSQL) | SQL Server |
|---------|----------------------|------------|
| **Primary Key** | `uuid` (UUID v4) | `INT IDENTITY(1,1)` |
| **String Type** | `text` | `NVARCHAR(n)` |
| **Boolean** | `boolean` | `BIT` (0/1) |
| **Timestamp** | `timestamptz` | `DATETIME` |
| **Auto-timestamp** | `DEFAULT now()` | `DEFAULT GETDATE()` |
| **Auth** | Built-in Auth | Custom JWT + OTP |
| **RLS** | Row-Level Security | Application-level |
| **Case Sensitivity** | Case-sensitive | Case-insensitive (default) |

### 3. Migration Checklist

**All phases completed** ✅

**Phase 1: Schema Setup** ✅
- [x] Run `SQLSERVER_SCHEMA.sql` to create tables
- [x] Verify foreign key relationships
- [x] Create indexes for performance
- [x] Set up test data

**Phase 2: Backend Migration** ✅
- [x] Create FastAPI router for the feature
- [x] Convert Supabase queries to SQL Server
- [x] Update response models (Pydantic)
- [x] Add authentication middleware
- [x] Test all CRUD operations

**Phase 3: Frontend Migration** ✅
- [x] Update API calls from Supabase to FastAPI
- [x] Replace `supabaseService` calls with `axios`
- [x] Update TypeScript interfaces
- [x] Handle new error formats
- [x] Test with React Query

**Phase 4: Testing** ✅
- [x] Unit tests (pytest)
- [x] Integration tests
- [x] Type checking (`npm run typecheck`)
- [x] Manual testing in UI

**Phase 5: Cleanup** ✅
- [x] Remove Supabase dependencies
- [x] Delete old Supabase queries
- [x] Update documentation

**Note**: This checklist is for reference. All modules have been migrated.
**Phase 5: Cleanup** ✅
- [x] Remove Supabase dependencies
- [x] Delete old Supabase queries
- [x] Update documentation

**Note**: This checklist is for reference. All modules have been migrated.

---

### 4. Query Conversion Examples (Reference)

**These examples show how queries were converted during migration. All code now uses SQL Server.**

**Example 1: SELECT with JOIN**

**Before (Supabase)** - `src/lib/supabaseService.ts`:
```typescript
async getAllEmployees() {
  const { data, error } = await supabase
    .from('employees')
    .select(`
      *,
      departments (
        id,
        name,
        code
      )
    `)
    .order('name');

  if (error) throw error;
  return data;
}
```

**After (SQL Server)** - `backend/routers/employees.py`:
```python
@router.get("/", response_model=List[EmployeeWithDepartment])
async def get_all_employees(db_cursor = Depends(get_db_cursor)):
    db_cursor.execute("""
        SELECT 
            e.id,
            e.employee_id,
            e.name,
            e.email,
            e.is_active,
            d.id as department_id,
            d.name as department_name,
            d.code as department_code
        FROM employees e
        LEFT JOIN departments d ON e.department_id = d.id
        WHERE e.is_active = 1
        ORDER BY e.name
    """)
    
    rows = db_cursor.fetchall()
    return [dict(zip([col[0] for col in db_cursor.description], row)) for row in rows]
```

**Frontend** (axios):
```typescript
// Old: Supabase
import { supabaseService } from '@/lib/supabaseService';
const employees = await supabaseService.getAllEmployees();

// New: FastAPI
import axios from 'axios';
const response = await axios.get('/api/employees');
const employees = response.data;
```

**Example 2: INSERT**

**Before (Supabase)**:
```typescript
async createEmployee(employee: EmployeeCreate) {
  const { data, error } = await supabase
    .from('employees')
    .insert([employee])
    .select()
    .single();

  if (error) throw error;
  return data;
**After (SQL Server)**:("/", status_code=201)
async def create_employee(
    employee: EmployeeCreate,
    db_cursor = Depends(get_db_cursor)
):
    db_cursor.execute("""
        INSERT INTO employees (employee_id, name, department_id, email, is_active)
        VALUES (?, ?, ?, ?, 1)
    """, (
        employee.employee_id,
        employee.name,
        employee.department_id,
        employee.email
    ))
    
    db_cursor.connection.commit()
    
    # Return created record
    db_cursor.execute(
        "SELECT * FROM employees WHERE employee_id = ?",
        (employee.employee_id,)
    )
    row = db_cursor.fetchone()
    return dict(zip([col[0] for col in db_cursor.description], row))
```

**Example 3: UPDATE**

**Before (Supabase)**:
```typescript
async updateEmployee(id: string, updates: Partial<Employee>) {
  const { data, error } = await supabase
    .from('employees')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
**After (SQL Server)**:("/{employee_id}")
async def update_employee(
    employee_id: str,
    updates: EmployeeUpdate,
    db_cursor = Depends(get_db_cursor)
):
    # Build dynamic UPDATE query
    set_clauses = []
    params = []
    
    if updates.name is not None:
        set_clauses.append("name = ?")
        params.append(updates.name)
    if updates.department_id is not None:
        set_clauses.append("department_id = ?")
        params.append(updates.department_id)
    if updates.email is not None:
        set_clauses.append("email = ?")
        params.append(updates.email)
    
    if not set_clauses:
        raise HTTPException(400, "No fields to update")
    
    params.append(employee_id)
    query = f"UPDATE employees SET {', '.join(set_clauses)} WHERE employee_id = ?"
    
    db_cursor.execute(query, params)
    db_cursor.connection.commit()
    
    # Return updated record
    db_cursor.execute(
        "SELECT * FROM employees WHERE employee_id = ?",
        (employee_id,)
    )
    row = db_cursor.fetchone()
    return dict(zip([col[0] for col in db_cursor.description], row))
```

**Example 4: DELETE (Soft Delete)**

**Before (Supabase)**:
```typescript
async deleteEmployee(id: string) {
  // Soft delete
  const { error } = await supabase
    .from('employees')
    .update({ is_active: false })
    .eq('id', id);

  if (error) throw error;
**After (SQL Server)**:("/{employee_id}")
async def delete_employee(
    employee_id: str,
    soft_delete: bool = True,
    db_cursor = Depends(get_db_cursor)
):
    if soft_delete:
        # Soft delete: set is_active = 0
        db_cursor.execute(
            "UPDATE employees SET is_active = 0 WHERE employee_id = ?",
            (employee_id,)
        )
        message = "Employee deactivated"
    else:
        # Hard delete: physical removal
        db_cursor.execute(
            "DELETE FROM employees WHERE employee_id = ?",
            (employee_id,)
        )
        message = "Employee deleted"
    
    db_cursor.connection.commit()
    return {"message": message}
```

### 5. Authentication Migration (Reference)

**How authentication was migrated:**

**Before (Supabase Auth)** - built-in authentication:
```typescript
// Sign up
const { data, error } = await supabase.auth.signUp({
  email: 'user@bosch.com',
  password: 'password123'
});

// Sign in
const { data, error } = await supabase.auth.signInWithPassword({
  email: 'user@bosch.com',
  password: 'password123'
});

// Get session
const { data: { session } } = await supabase.auth.getSession();
const token = session?.access_token;

// Use token
const { data } = await supabase
  .from('employees')
  .select('*')
  .headers({ Authorization: `Bearer ${token}` });
```

**After (Custom JWT + OTP)** - current implementation:
```typescript
// Step 1: Request OTP
await axios.post('/api/auth/send-otp', {
  email: 'user@bosch.com'
});

// Step 2: Verify OTP and get JWT
const response = await axios.post('/api/auth/verify-otp', {
  email: 'user@bosch.com',
  code: '123456'
});

const { access_token } = response.data;
localStorage.setItem('authToken', access_token);

// Step 3: Use JWT in requests
const employees = await axios.get('/api/employees', {
  headers: {
    Authorization: `Bearer ${access_token}`
  }
});
```

### 6. Type Conversion (Reference)

**How TypeScript types changed during migration:**

**Before (Supabase Types)** - `src/lib/database.types.ts`:
```typescript
export interface Employee {
  id: string;  // UUID
  employee_id: string;
  name: string;
  department_id: string | null;  // UUID
  email: string | null;
  created_at: string;  // ISO timestamp
}
```

**After (SQL Server Types)** - updated interfaces:
```typescript
export interface Employee {
  id: number;  // INT (changed from string)
  employee_id: string;
  name: string;
  department_id: number | null;  // INT (changed from string)
  email: string | null;
  is_active: boolean;  // BIT (added)
  created_at: string;  // ISO timestamp
  updated_at: string;  // Added
}
```

**Frontend Migration**:
```typescript
// Update all ID references
// Old: id: string
// New: id: number

// Update comparisons
// Old: if (employee.department_id === departmentId)
// New: if (employee.department_id === departmentId) // Already correct if departmentId is number

// Update API calls
// Old: `/api/employees/${uuid}`
// New: `/api/employees/${employee_id}` // Use employee_id (string) not id (int)
```

### 7. Error Handling Differences (Reference)

**How error handling changed:**

**Before (Supabase Errors)**:
```typescript
const { data, error } = await supabase.from('employees').select('*');

if (error) {
  // error.message: "syntax error at..."
  // error.code: "PGRST116"
  throw new Error(error.message);
}
```

**After (FastAPI Errors)** - current error handling:
```typescript
try {
  const response = await axios.get('/api/employees');
} catch (error) {
  if (axios.isAxiosError(error)) {
    // error.response.status: 404
    // error.response.data.detail: "Employee not found"
    const message = error.response?.data?.detail || 'Unknown error';
    toast.error(message);
  }
}
```

### 8. Connection Management (Reference)

**How database connections changed:**

**Before (Supabase)** - singleton client:
```typescript
// src/lib/supabase.ts
import { createClient } from '@supabase/supabase-js';

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

// Connection pooling handled by Supabase
```

**After (SQL Server)** - pyodbc connection pool:
```python
# backend/database.py
import pyodbc
from contextlib import contextmanager

_connection_pool = []

def get_connection():
    """Get connection from pool (or create new)"""
    if _connection_pool:
        return _connection_pool.pop()
    
    return pyodbc.connect(
        f"DRIVER={{ODBC Driver 17 for SQL Server}};"
        f"SERVER={settings.database_server};"
        f"DATABASE={settings.database_name};"
        f"UID={settings.database_username};"
        f"PWD={settings.database_password};"
        f"TrustServerCertificate=yes"
    )

@contextmanager
def get_db_cursor():
    """Context manager for cursor (auto-close)"""
    conn = get_connection()
    cursor = conn.cursor()
    try:
        yield cursor
    finally:
        cursor.close()
        _connection_pool.append(conn)
```

### 9. Data Migration Script Example (Historical Reference)

**This script was used during the migration. Kept for reference only.**
```python
# migrate_feature.py
import pyodbc
from supabase import create_client
from config import settings

# Connect to both databases
supabase = create_client(settings.supabase_url, settings.supabase_key)
sql_conn = pyodbc.connect(settings.sql_server_connection_string)
sql_cursor = sql_conn.cursor()

def migrate_employees():
    """Migrate employees from Supabase to SQL Server"""
    print("📥 Fetching employees from Supabase...")
    response = supabase.table('employees').select('*').execute()
    employees = response.data
    
    print(f"Found {len(employees)} employees")
    
    for emp in employees:
        try:
            # Check if already exists
            sql_cursor.execute(
                "SELECT id FROM employees WHERE employee_id = ?",
                (emp['employee_id'],)
            )
            if sql_cursor.fetchone():
                print(f"⚠️  Skipping {emp['employee_id']} (already exists)")
                continue
            
            # Insert into SQL Server
            sql_cursor.execute("""
                INSERT INTO employees (employee_id, name, department_id, email, is_active)
                VALUES (?, ?, ?, ?, 1)
            """, (
                emp['employee_id'],
                emp['name'],
                emp['department_id'],  # May need ID conversion
                emp.get('email')
            ))
            
            print(f"✅ Migrated {emp['employee_id']}")
            
        except Exception as e:
            print(f"❌ Error migrating {emp['employee_id']}: {e}")
    
    sql_conn.commit()
    print("✅ Migration complete")

if __name__ == '__main__':
    migrate_employees()
```

### 10. Migration Testing (Historical Reference)

**These tests were used during migration. No longer needed as migration is complete.**

```python
# backend/test_migration.py (deprecated)
import pytest
import pyodbc

def test_sql_server_connection():
    """Test SQL Server connection"""
    conn = pyodbc.connect(settings.sql_server_connection_string)
    cursor = conn.cursor()
    cursor.execute("SELECT COUNT(*) FROM employees")
    count = cursor.fetchone()[0]
    assert count >= 0
    print(f"✅ SQL Server: {count} employees")

def test_data_integrity():
    """Verify data integrity after migration"""
    conn = pyodbc.connect(settings.sql_server_connection_string)
    cursor = conn.cursor()
    
    # Check employees
    cursor.execute("SELECT COUNT(*) FROM employees")
    emp_count = cursor.fetchone()[0]
    
    # Check assessments
    cursor.execute("SELECT COUNT(*) FROM competency_assessments")
    assess_count = cursor.fetchone()[0]
    
    print(f"✅ Employees: {emp_count}, Assessments: {assess_count}")
    assert emp_count > 0
    assert assess_count > 0
```

---

## Best Practices (Lessons Learned)

### 1. Incremental Migration
- ✅ Migrate one feature at a time
- ✅ Keep both systems running in parallel
- ✅ Test thoroughly before removing legacy code
- ❌ Don't migrate everything at once

### 2. Data Consistency
- ✅ Run data validation scripts
- ✅ Compare record counts
- ✅ Verify foreign key relationships
- ❌ Don't assume data is identical

### 3. Backwards Compatibility
- ✅ Keep old API endpoints during transition
- ✅ Use feature flags for gradual rollout
- ✅ Maintain documentation for both systems
- ❌ Don't break existing functionality

### 4. Testing
- ✅ Write tests for both old and new implementations
- ✅ Test with real data
- ✅ Perform load testing
- ❌ Don't skip integration tests

### 5. Error Handling
- ✅ Handle different error formats
- ✅ Provide clear migration error messages
- ✅ Log migration issues
- ❌ Don't silently fail

---

## Common Issues Encountered (All Resolved)

**Issue: UUID vs INT Primary Keys** ✅
- **Solution Applied**: Use `employee_id` (string) as the stable identifier instead of `id`

**Issue: Case Sensitivity** ✅
- **Solution Applied**: SQL Server is case-insensitive by default; maintained consistent casing

**Issue: DATETIME Format** ✅
- **Solution Applied**: Use ISO 8601 format in all API responses

**Issue: Connection Pooling** ✅
- **Solution Applied**: Implemented connection pool in `backend/database.py`

**Issue: Authentication Migration** ✅
- **Solution Applied**: Custom JWT + OTP fully replaced Supabase Auth

---

## Summary

**Migration Complete**: This document serves as a historical reference for understanding:
- How the system was migrated from Supabase to SQL Server
- Key architectural differences between the two systems
- Code patterns that changed during migration
- Lessons learned for future reference

**Current State**: All features now use SQL Server + FastAPI exclusively. No Supabase dependencies remain in production code.
