# Testing Commands Skill

**Description**: Execute tests and validate code quality for the BPS platform.

**Usage**: Use this skill when you need to run tests, validate code, or check for errors.

## Capabilities

### 1. Frontend Testing

#### Type Check
```bash
npm run typecheck
```
**Purpose**: Validate TypeScript types across entire codebase  
**Must Pass**: Before any commit  
**Common Errors**:
- Missing type definitions
- `any` usage without annotation
- Unhandled `null`/`undefined`
- Interface mismatches

#### Linting
```bash
npm run lint
```
**Purpose**: Check code style and potential issues  
**Config**: `eslint.config.js`  
**Rules**:
- React Hooks dependencies
- Component export patterns
- TypeScript recommendations

#### Build Test
```bash
npm run build
```
**Purpose**: Verify production build  
**Output**: `dist/` directory  
**Check For**:
- Bundle size warnings (> 500 KB)
- Dynamic import warnings
- Missing dependencies

### 2. Backend Testing

#### Run All Tests
```bash
cd backend
pytest
```
**Purpose**: Execute full test suite  
**Coverage**: Auth, database, API routes  

#### Run Specific Test
```bash
pytest tests/test_auth.py -v
```
**Flags**:
- `-v`: Verbose output
- `-s`: Show print statements
- `-k "test_name"`: Run specific test by name
- `--watch`: Continuous mode (needs pytest-watch)

#### Test with Coverage
```bash
pytest --cov=backend --cov-report=html
```
**Output**: `htmlcov/index.html`

### 3. Database Testing

#### Test Connection
```bash
python backend/database.py
```
**Purpose**: Validate SQL Server connection  
**Expected**: "✅ 数据库连接正常"

#### Test Auth Flow
```bash
python backend/test_login.py
```
**Purpose**: Test complete OTP authentication  
**Steps**:
1. Generate OTP
2. Verify code
3. Get JWT token

#### Test Matching Data
```bash
python backend/test_matching_data.py
```
**Purpose**: Validate matching algorithm data

### 4. Integration Testing

#### Full Stack Validation
```bash
# Terminal 1: Start backend
cd backend
python main.py

# Terminal 2: Start frontend
npm run dev

# Terminal 3: Run tests
npm run typecheck && cd backend && pytest
```

#### Database Check Page
Navigate to: `http://localhost:5173/debug`  
**Purpose**: Test all table connections  
**Checks**:
- Departments table
- Employees table
- Skills table
- Assessments table
- Supabase connection

### 5. Pre-Commit Checklist

#### Automated Check
```bash
npm run typecheck && npm run lint && cd backend && pytest
```

#### Manual Checklist
- [ ] TypeScript types valid
- [ ] ESLint passes
- [ ] Backend tests pass
- [ ] No `console.log` in production code
- [ ] Database migrations applied
- [ ] API docs updated (if routes changed)

### 6. TDD Workflow

#### Red-Green-Refactor
```bash
# 1. RED: Write failing test
cd backend
pytest tests/test_new_feature.py  # Should fail

# 2. GREEN: Implement minimum code
# Edit code...
pytest tests/test_new_feature.py  # Should pass

# 3. REFACTOR: Clean up
pytest  # All tests still pass
```

#### Frontend TDD
```bash
# 1. Define types first
npm run typecheck  # Should show type errors

# 2. Implement component
# Edit code...
npm run typecheck  # Should pass

# 3. Test in browser
npm run dev
```

## Test Fixtures

### Backend (pytest)
**Location**: `backend/tests/conftest.py`

**Available Fixtures**:
- `db_connection`: Session-level database connection
- `db_cursor`: Function-level cursor with auto-rollback
- `api_base_url`: FastAPI test server URL

**Usage**:
```python
def test_get_employees(db_cursor):
    cursor = db_cursor
    cursor.execute("SELECT * FROM employees")
    results = cursor.fetchall()
    assert len(results) > 0
```

### Frontend
**Location**: React Query cache

**Query Keys**:
```typescript
['employees']           // All employees
['employees', id]       // Single employee
['skills']              // All skills
['assessments', year]   // Assessments for year
```

**Invalidation**:
```typescript
queryClient.invalidateQueries({ queryKey: ['employees'] });
```

## Debugging Tests

### Backend Debug
```bash
# Show print output
pytest -s

# Debug specific test
pytest tests/test_auth.py::test_login_success -v -s

# Drop into debugger on failure
pytest --pdb
```

### Frontend Debug
1. Open Chrome DevTools
2. Go to Sources tab
3. Set breakpoints
4. Run `npm run dev`
5. Check Console for errors

### Database Debug
```bash
# Run in Python REPL
python
>>> from backend.database import get_connection
>>> conn = get_connection()
>>> cursor = conn.cursor()
>>> cursor.execute("SELECT * FROM employees")
>>> cursor.fetchall()
```

## CI/CD Integration

### GitHub Actions (Recommended)
```yaml
name: Test
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Frontend Tests
        run: npm run typecheck
      - name: Backend Tests
        run: cd backend && pytest
```

## Performance Testing

### Frontend Build Size
```bash
npm run build
# Check dist/ size - should be < 2 MB
```

### Backend Response Time
```bash
# Use /api/docs Swagger UI
# Check X-Process-Time header
# Should be < 200ms for queries
```

## Common Issues

### "Module not found"
```bash
# Frontend
npm install

# Backend
cd backend
pip install -r requirements.txt
```

### "Database connection failed"
```bash
# Check config
cat backend/config.py

# Test connection
ping 10.88.43.154
python backend/database.py
```

### "Type error in node_modules"
```bash
# Clear cache
rm -rf node_modules
npm install
```
