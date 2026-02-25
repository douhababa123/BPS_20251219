# React Patterns Skill

**Description**: Modern React patterns using React Query (TanStack Query) and Context API for state management.

**Usage**: Use this skill when building React components, managing server state, or implementing global state patterns.

## Capabilities

### 1. React Query Fundamentals

**Installation** (`package.json`):
```json
{
  "dependencies": {
    "@tanstack/react-query": "^5.90.7",
    "axios": "^1.6.7"
  }
}
```

**Setup Query Client** (`src/main.tsx`):
```tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,      // 5分钟内不重新请求
      cacheTime: 30 * 60 * 1000,     // 缓存保留30分钟
      refetchOnWindowFocus: false,    // 窗口聚焦不自动刷新
      retry: 1,                       // 失败重试1次
    },
  },
});

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  );
}
```

### 2. useQuery Pattern

**Basic Query**:
```tsx
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';

interface Employee {
  id: string;
  employee_id: string;
  name: string;
  department_id: number;
  email: string;
}

function EmployeeList() {
  const { 
    data: employees, 
    isLoading, 
    isError, 
    error,
    refetch 
  } = useQuery({
    queryKey: ['employees'],  // 缓存键
    queryFn: async () => {
      const response = await axios.get<Employee[]>('/api/employees');
      return response.data;
    },
  });

  if (isLoading) {
    return <div className="flex justify-center p-8">加载中...</div>;
  }

  if (isError) {
    return (
      <div className="text-red-500 p-4">
        错误: {error instanceof Error ? error.message : '未知错误'}
        <button onClick={() => refetch()} className="ml-4">重试</button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {employees?.map((emp) => (
        <div key={emp.id} className="border p-4 rounded">
          {emp.name} - {emp.employee_id}
        </div>
      ))}
    </div>
  );
}
```

**Query with Parameters**:
```tsx
function DepartmentEmployees({ departmentId }: { departmentId: number }) {
  const { data, isLoading } = useQuery({
    queryKey: ['employees', departmentId],  // 键包含参数
    queryFn: async () => {
      const response = await axios.get(`/api/employees`, {
        params: { department_id: departmentId }
      });
      return response.data;
    },
    enabled: departmentId > 0,  // 仅当有有效 departmentId 时查询
  });

  // ...
}
```

**Dependent Queries**:
```tsx
function EmployeeDetails({ employeeId }: { employeeId: string }) {
  // Query 1: Get employee basic info
  const { data: employee } = useQuery({
    queryKey: ['employee', employeeId],
    queryFn: () => axios.get(`/api/employees/${employeeId}`).then(r => r.data),
  });

  // Query 2: Get assessments (depends on employee)
  const { data: assessments } = useQuery({
    queryKey: ['assessments', employeeId],
    queryFn: () => axios.get(`/api/assessments`, {
      params: { employee_id: employeeId }
    }).then(r => r.data),
    enabled: !!employee,  // 等employee加载完成
  });

  return (
    <div>
      <h2>{employee?.name}</h2>
      {assessments?.map(a => <div key={a.id}>{a.skill_name}</div>)}
    </div>
  );
}
```

### 3. useMutation Pattern

**Basic Mutation**:
```tsx
import { useMutation, useQueryClient } from '@tanstack/react-query';

interface CreateEmployeeRequest {
  employee_id: string;
  name: string;
  department_id?: number;
  email?: string;
}

function CreateEmployeeForm() {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState<CreateEmployeeRequest>({
    employee_id: '',
    name: '',
  });

  const mutation = useMutation({
    mutationFn: async (data: CreateEmployeeRequest) => {
      const response = await axios.post('/api/employees', data);
      return response.data;
    },
    onSuccess: () => {
      // 成功后刷新员工列表
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      
      // 清空表单
      setFormData({ employee_id: '', name: '' });
      
      // 显示成功提示
      toast.success('员工创建成功');
    },
    onError: (error) => {
      if (axios.isAxiosError(error)) {
        const message = error.response?.data?.detail || '创建失败';
        toast.error(message);
      }
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    mutation.mutate(formData);
  };

  return (
    <form onSubmit={handleSubmit}>
      <input
        value={formData.employee_id}
        onChange={(e) => setFormData({ ...formData, employee_id: e.target.value })}
        placeholder="员工ID"
        disabled={mutation.isPending}
      />
      <input
        value={formData.name}
        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
        placeholder="姓名"
        disabled={mutation.isPending}
      />
      <button type="submit" disabled={mutation.isPending}>
        {mutation.isPending ? '创建中...' : '创建员工'}
      </button>
    </form>
  );
}
```

**Update Mutation**:
```tsx
function EditEmployee({ employeeId }: { employeeId: string }) {
  const queryClient = useQueryClient();

  const updateMutation = useMutation({
    mutationFn: async (data: Partial<Employee>) => {
      const response = await axios.put(`/api/employees/${employeeId}`, data);
      return response.data;
    },
    onSuccess: (updatedEmployee) => {
      // 精确更新缓存中的单个员工
      queryClient.setQueryData(
        ['employee', employeeId],
        updatedEmployee
      );
      
      // 刷新列表
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      
      toast.success('更新成功');
    },
  });

  return (
    <button onClick={() => updateMutation.mutate({ name: '新名字' })}>
      更新
    </button>
  );
}
```

**Delete Mutation**:
```tsx
function DeleteEmployeeButton({ employeeId }: { employeeId: string }) {
  const queryClient = useQueryClient();

  const deleteMutation = useMutation({
    mutationFn: async () => {
      await axios.delete(`/api/employees/${employeeId}`);
    },
    onMutate: async () => {
      // 乐观更新：立即从UI移除
      await queryClient.cancelQueries({ queryKey: ['employees'] });
      
      const previousEmployees = queryClient.getQueryData(['employees']);
      
      queryClient.setQueryData(['employees'], (old: Employee[] | undefined) =>
        old?.filter(emp => emp.id !== employeeId)
      );
      
      return { previousEmployees };
    },
    onError: (err, variables, context) => {
      // 回滚
      if (context?.previousEmployees) {
        queryClient.setQueryData(['employees'], context.previousEmployees);
      }
      toast.error('删除失败');
    },
    onSuccess: () => {
      toast.success('删除成功');
    },
  });

  return (
    <button 
      onClick={() => deleteMutation.mutate()}
      className="text-red-500"
      disabled={deleteMutation.isPending}
    >
      {deleteMutation.isPending ? '删除中...' : '删除'}
    </button>
  );
}
```

### 4. Context API Pattern

**Create Context** (`src/contexts/PersonaContext.tsx`):
```tsx
import { createContext, useContext, useState, ReactNode } from 'react';

type Persona = 'Admin' | 'Site PS' | 'BPS Engineer';

interface PersonaContextType {
  persona: Persona;
  setPersona: (persona: Persona) => void;
}

const PersonaContext = createContext<PersonaContextType | undefined>(undefined);

export function PersonaProvider({ children }: { children: ReactNode }) {
  const [persona, setPersona] = useState<Persona>('BPS Engineer');

  return (
    <PersonaContext.Provider value={{ persona, setPersona }}>
      {children}
    </PersonaContext.Provider>
  );
}

// Custom hook for consuming context
export function usePersona() {
  const context = useContext(PersonaContext);
  
  if (context === undefined) {
    throw new Error('usePersona must be used within PersonaProvider');
  }
  
  return context;
}
```

**Use Context in Component**:
```tsx
import { usePersona } from '@/contexts/PersonaContext';

function PersonaSwitcher() {
  const { persona, setPersona } = usePersona();

  return (
    <select value={persona} onChange={(e) => setPersona(e.target.value as Persona)}>
      <option value="Admin">管理员</option>
      <option value="Site PS">Site PS</option>
      <option value="BPS Engineer">BPS工程师</option>
    </select>
  );
}

function PersonaContent() {
  const { persona } = usePersona();

  return (
    <div>
      {persona === 'Admin' && <AdminDashboard />}
      {persona === 'Site PS' && <SitePSDashboard />}
      {persona === 'BPS Engineer' && <EngineerDashboard />}
    </div>
  );
}
```

**Wrap App with Provider** (`src/App.tsx`):
```tsx
import { PersonaProvider } from './contexts/PersonaContext';

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <PersonaProvider>
        <RouterProvider router={router} />
      </PersonaProvider>
    </QueryClientProvider>
  );
}
```

### 5. Auth Context Pattern

**Auth Context** (`src/contexts/AuthContext.tsx`):
```tsx
import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import axios from 'axios';

interface User {
  id: string;
  email: string;
  role: string;
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  login: (email: string, code: string) => Promise<void>;
  logout: () => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Check for existing token on mount
  useEffect(() => {
    const token = localStorage.getItem('authToken');
    const userId = localStorage.getItem('userId');
    const userEmail = localStorage.getItem('userEmail');
    
    if (token && userId && userEmail) {
      setUser({ id: userId, email: userEmail, role: 'user' });
    }
    
    setIsLoading(false);
  }, []);

  const login = async (email: string, code: string) => {
    const response = await axios.post('/api/auth/verify-otp', { email, code });
    const { access_token, user_id, email: userEmail } = response.data;
    
    localStorage.setItem('authToken', access_token);
    localStorage.setItem('userId', user_id);
    localStorage.setItem('userEmail', userEmail);
    
    setUser({ id: user_id, email: userEmail, role: 'user' });
  };

  const logout = () => {
    localStorage.removeItem('authToken');
    localStorage.removeItem('userId');
    localStorage.removeItem('userEmail');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{
      user,
      isAuthenticated: !!user,
      login,
      logout,
      isLoading
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
```

**Protected Route**:
```tsx
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

function ProtectedRoute({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return <div>加载中...</div>;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

// Usage in router
const router = createBrowserRouter([
  {
    path: '/login',
    element: <LoginPage />
  },
  {
    path: '/dashboard',
    element: (
      <ProtectedRoute>
        <Dashboard />
      </ProtectedRoute>
    )
  }
]);
```

### 6. Custom Hooks

**useDebounce Hook**:
```tsx
import { useState, useEffect } from 'react';

function useDebounce<T>(value: T, delay: number = 500): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

// Usage: Search with debounce
function SearchEmployees() {
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearchTerm = useDebounce(searchTerm, 500);

  const { data } = useQuery({
    queryKey: ['employees', 'search', debouncedSearchTerm],
    queryFn: () => axios.get('/api/employees', {
      params: { search: debouncedSearchTerm }
    }).then(r => r.data),
    enabled: debouncedSearchTerm.length > 0,
  });

  return (
    <div>
      <input
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        placeholder="搜索员工..."
      />
      {/* Results */}
    </div>
  );
}
```

**usePagination Hook**:
```tsx
import { useState } from 'react';

function usePagination(initialPage = 1, pageSize = 20) {
  const [page, setPage] = useState(initialPage);

  const nextPage = () => setPage(p => p + 1);
  const prevPage = () => setPage(p => Math.max(1, p - 1));
  const goToPage = (page: number) => setPage(Math.max(1, page));

  return {
    page,
    pageSize,
    skip: (page - 1) * pageSize,
    nextPage,
    prevPage,
    goToPage,
  };
}

// Usage
function PaginatedEmployees() {
  const { page, pageSize, skip, nextPage, prevPage } = usePagination(1, 20);

  const { data, isLoading } = useQuery({
    queryKey: ['employees', page],
    queryFn: () => axios.get('/api/employees', {
      params: { skip, limit: pageSize }
    }).then(r => r.data),
  });

  return (
    <div>
      {/* Employee list */}
      <div className="flex gap-2">
        <button onClick={prevPage} disabled={page === 1}>上一页</button>
        <span>第 {page} 页</span>
        <button onClick={nextPage}>下一页</button>
      </div>
    </div>
  );
}
```

### 7. Cache Management

**Invalidate Queries**:
```tsx
// Invalidate all queries starting with 'employees'
queryClient.invalidateQueries({ queryKey: ['employees'] });

// Invalidate specific query
queryClient.invalidateQueries({ queryKey: ['employee', employeeId] });

// Invalidate multiple query patterns
queryClient.invalidateQueries({ 
  predicate: (query) => 
    query.queryKey[0] === 'employees' || query.queryKey[0] === 'assessments'
});
```

**Refetch Queries**:
```tsx
// Refetch specific query
await queryClient.refetchQueries({ queryKey: ['employees'] });

// Refetch all active queries
await queryClient.refetchQueries({ type: 'active' });
```

**Manual Cache Update**:
```tsx
// Set query data directly
queryClient.setQueryData(['employee', employeeId], newEmployeeData);

// Update query data with function
queryClient.setQueryData(['employees'], (old: Employee[] | undefined) => {
  if (!old) return [newEmployee];
  return [...old, newEmployee];
});
```

**Prefetch Data**:
```tsx
// Prefetch data before navigation
const handleNavigateToEmployee = async (employeeId: string) => {
  await queryClient.prefetchQuery({
    queryKey: ['employee', employeeId],
    queryFn: () => axios.get(`/api/employees/${employeeId}`).then(r => r.data),
  });
  
  navigate(`/employees/${employeeId}`);
};
```

### 8. Error Handling Patterns

**Global Error Boundary**:
```tsx
import { Component, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: any) {
    console.error('ErrorBoundary caught:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <div className="bg-white p-8 rounded-lg shadow-md max-w-md">
            <h2 className="text-2xl font-bold text-red-600 mb-4">出错了</h2>
            <p className="text-gray-700 mb-4">
              {this.state.error?.message || '未知错误'}
            </p>
            <button
              onClick={() => window.location.reload()}
              className="bg-blue-500 text-white px-4 py-2 rounded"
            >
              刷新页面
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// Usage
<ErrorBoundary>
  <App />
</ErrorBoundary>
```

**Query Error Handling**:
```tsx
const { data, error, isError } = useQuery({
  queryKey: ['employees'],
  queryFn: fetchEmployees,
  retry: (failureCount, error) => {
    // Retry on network errors, but not on 404
    if (axios.isAxiosError(error) && error.response?.status === 404) {
      return false;
    }
    return failureCount < 3;
  },
  retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
});

if (isError) {
  return <ErrorDisplay error={error} />;
}
```

## Best Practices

### 1. Query Key Conventions
```tsx
// ✅ Good: Hierarchical keys
['employees']                          // All employees
['employees', { department: 1 }]       // Filtered employees
['employees', employeeId]              // Single employee
['employees', employeeId, 'assessments'] // Employee's assessments

// ❌ Bad: Flat keys without structure
['getEmployees']
['employeeData']
```

### 2. Mutation Patterns
```tsx
// ✅ Good: Invalidate related queries
onSuccess: () => {
  queryClient.invalidateQueries({ queryKey: ['employees'] });
  queryClient.invalidateQueries({ queryKey: ['departments'] });
}

// ❌ Bad: Forget to update cache
onSuccess: () => {
  console.log('Success!');  // Cache is stale
}
```

### 3. Loading States
```tsx
// ✅ Good: Show meaningful loading UI
if (isLoading) {
  return <Skeleton />;
}

// ❌ Bad: Blank screen
if (isLoading) {
  return null;
}
```

### 4. Context Usage
```tsx
// ✅ Good: Use Context for truly global state (auth, theme, locale)
<AuthContext.Provider>
<ThemeContext.Provider>

// ❌ Bad: Use Context for server state
// Use React Query instead!
```

### 5. Performance Optimization
```tsx
// ✅ Good: Memoize expensive computations
const sortedEmployees = useMemo(
  () => employees?.sort((a, b) => a.name.localeCompare(b.name)),
  [employees]
);

// ✅ Good: Prevent unnecessary re-renders
const MemoizedEmployeeCard = memo(EmployeeCard);
```

## Common Patterns

### Infinite Scroll
```tsx
import { useInfiniteQuery } from '@tanstack/react-query';

function InfiniteEmployeeList() {
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ['employees', 'infinite'],
    queryFn: ({ pageParam = 0 }) => 
      axios.get('/api/employees', {
        params: { skip: pageParam, limit: 20 }
      }).then(r => r.data),
    getNextPageParam: (lastPage, allPages) => {
      if (lastPage.length < 20) return undefined;
      return allPages.length * 20;
    },
  });

  return (
    <div>
      {data?.pages.map((page, i) => (
        <div key={i}>
          {page.map(emp => <EmployeeCard key={emp.id} employee={emp} />)}
        </div>
      ))}
      {hasNextPage && (
        <button onClick={() => fetchNextPage()} disabled={isFetchingNextPage}>
          {isFetchingNextPage ? '加载中...' : '加载更多'}
        </button>
      )}
    </div>
  );
}
```

### Optimistic Updates
```tsx
const mutation = useMutation({
  mutationFn: updateEmployee,
  onMutate: async (newEmployee) => {
    // Cancel outgoing refetches
    await queryClient.cancelQueries({ queryKey: ['employees'] });
    
    // Snapshot previous value
    const previous = queryClient.getQueryData(['employees']);
    
    // Optimistically update
    queryClient.setQueryData(['employees'], (old: Employee[]) =>
      old.map(emp => emp.id === newEmployee.id ? newEmployee : emp)
    );
    
    return { previous };
  },
  onError: (err, newEmployee, context) => {
    // Rollback on error
    queryClient.setQueryData(['employees'], context?.previous);
  },
  onSettled: () => {
    // Always refetch after error or success
    queryClient.invalidateQueries({ queryKey: ['employees'] });
  },
});
```
