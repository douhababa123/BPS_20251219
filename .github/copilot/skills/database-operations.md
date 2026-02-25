# Database Operations Skill

**Description**: Execute SQL Server database operations for the BPS platform (migrated from Supabase).

**Usage**: Use this skill when you need to query or modify database data related to employees, skills, competency assessments, or resource planning.

## Capabilities

### 1. Query Employee Data
```sql
-- Get all employees with department info
SELECT e.id, e.employee_id, e.name, d.name as department_name
FROM employees e
LEFT JOIN departments d ON e.department_id = d.id
WHERE e.is_active = 1;

-- Get employee by name
SELECT * FROM employees WHERE name = ?;
```

### 2. Query Skills Data
```sql
-- Get all skills grouped by module
SELECT module_name, COUNT(*) as skill_count
FROM skills
GROUP BY module_name
ORDER BY display_order;

-- Get skills for specific module
SELECT * FROM skills WHERE module_name = ?;
```

### 3. Query Competency Assessments
```sql
-- Get assessment summary for employee
SELECT s.skill_name, ca.current_level, ca.target_level, ca.gap
FROM competency_assessments ca
JOIN skills s ON ca.skill_id = s.id
WHERE ca.employee_id = ?;

-- Get team gap analysis
SELECT s.module_name, AVG(ca.gap) as avg_gap, COUNT(*) as assessment_count
FROM competency_assessments ca
JOIN skills s ON ca.skill_id = s.id
GROUP BY s.module_name;
```

### 4. Common Patterns
- Always use parameterized queries to prevent SQL injection
- Use `backend/database.py` connection for SQL Server
- Use `src/lib/supabaseService.ts` for Supabase operations
- Include `WHERE is_active = 1` for employee queries
- Join through `skills` table for assessment queries

## Context
- **SQL Server**: Primary database at `10.88.43.154`, database `DCCT_BPS_Debug`
- **Supabase**: Legacy system, being phased out
- **Schema**: See `SQLSERVER_SCHEMA.sql` for complete structure
- **9 Modules**: BPS elements, Investment efficiency, Waste-free flow, Everybody's CIP, Leadership commitment, CIP indirect LEAN, Digital Transformation

## Example Workflows

### Add New Employee
1. Check if department exists
2. Insert into `employees` table
3. Optionally create initial assessments

### Import Skills
1. Validate module_id exists
2. Insert into `skills` table with correct `display_order`
3. Verify no duplicates

### Calculate Team Gaps
1. Query all assessments for year
2. Join with skills and employees
3. Group by module or skill
4. Calculate avg/total gaps
