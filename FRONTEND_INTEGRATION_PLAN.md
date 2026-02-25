# 前端 API 客户端实现计划

## 📋 目标

将 BPS 前端从 Supabase SDK 迁移到新的 FastAPI 后端，创建完整的 TypeScript API 客户端。

---

## 🎯 实施步骤

### 阶段 1: 创建 API 客户端基础架构

#### 1.1 创建 Axios 实例配置
**文件**: `src/lib/api-client.ts`

```typescript
import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api';

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// 请求拦截器 - 自动添加 JWT Token
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('access_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// 响应拦截器 - 处理错误和 token 过期
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      // Token 过期，清除并重定向到登录
      localStorage.removeItem('access_token');
      localStorage.removeItem('user_id');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);
```

#### 1.2 定义 TypeScript 类型
**文件**: `src/types/api.ts`

```typescript
// 通用响应类型
export interface MessageResponse {
  message: string;
  detail?: string;
}

// 认证类型
export interface OTPRequest {
  email: string;
}

export interface OTPVerifyRequest {
  email: string;
  otp: string;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
  user_id: string;
  email: string;
}

// 部门类型
export interface Department {
  id: number;
  name: string;
  code?: string;
  description?: string;
  created_at?: string;
  updated_at?: string;
}

export interface DepartmentCreate {
  name: string;
  code?: string;
  description?: string;
}

export interface DepartmentUpdate {
  name?: string;
  code?: string;
  description?: string;
}

// ... (其他模型类型定义)
```

---

### 阶段 2: 实现认证模块

#### 2.1 创建认证 API 服务
**文件**: `src/services/auth.service.ts`

```typescript
import { apiClient } from '@/lib/api-client';
import type { OTPRequest, OTPVerifyRequest, TokenResponse, MessageResponse } from '@/types/api';

export const authService = {
  // 请求 OTP
  async requestOTP(data: OTPRequest): Promise<MessageResponse> {
    const response = await apiClient.post('/auth/signup-otp', data);
    return response.data;
  },

  // 验证 OTP 并登录
  async verifyOTP(data: OTPVerifyRequest): Promise<TokenResponse> {
    const response = await apiClient.post('/auth/verify-otp', data);
    const tokenData = response.data;
    
    // 保存 token 和用户信息到 localStorage
    localStorage.setItem('access_token', tokenData.access_token);
    localStorage.setItem('user_id', tokenData.user_id);
    localStorage.setItem('user_email', tokenData.email);
    
    return tokenData;
  },

  // 登出
  async logout(): Promise<MessageResponse> {
    const response = await apiClient.post('/auth/logout');
    
    // 清除本地存储
    localStorage.removeItem('access_token');
    localStorage.removeItem('user_id');
    localStorage.removeItem('user_email');
    
    return response.data;
  },

  // 检查是否已登录
  isAuthenticated(): boolean {
    return !!localStorage.getItem('access_token');
  },

  // 获取当前用户信息
  getCurrentUser() {
    return {
      id: localStorage.getItem('user_id'),
      email: localStorage.getItem('user_email'),
    };
  },
};
```

#### 2.2 创建认证 Context
**文件**: `src/contexts/AuthContext.tsx`

```typescript
import React, { createContext, useContext, useState, useEffect } from 'react';
import { authService } from '@/services/auth.service';
import type { TokenResponse } from '@/types/api';

interface AuthContextType {
  user: { id: string; email: string } | null;
  isAuthenticated: boolean;
  requestOTP: (email: string) => Promise<void>;
  verifyOTP: (email: string, otp: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<{ id: string; email: string } | null>(null);

  useEffect(() => {
    // 初始化时检查认证状态
    if (authService.isAuthenticated()) {
      const currentUser = authService.getCurrentUser();
      setUser(currentUser);
    }
  }, []);

  const requestOTP = async (email: string) => {
    await authService.requestOTP({ email });
  };

  const verifyOTP = async (email: string, otp: string) => {
    const tokenData = await authService.verifyOTP({ email, otp });
    setUser({ id: tokenData.user_id, email: tokenData.email });
  };

  const logout = async () => {
    await authService.logout();
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        requestOTP,
        verifyOTP,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};
```

---

### 阶段 3: 实现 CRUD 服务

#### 3.1 创建通用 CRUD 服务基类
**文件**: `src/services/base.service.ts`

```typescript
import { apiClient } from '@/lib/api-client';

export class BaseService<T, TCreate, TUpdate> {
  constructor(private endpoint: string) {}

  async getAll(): Promise<T[]> {
    const response = await apiClient.get<T[]>(this.endpoint);
    return response.data;
  }

  async getById(id: string | number): Promise<T> {
    const response = await apiClient.get<T>(`${this.endpoint}/${id}`);
    return response.data;
  }

  async create(data: TCreate): Promise<T> {
    const response = await apiClient.post<T>(this.endpoint, data);
    return response.data;
  }

  async update(id: string | number, data: TUpdate): Promise<T> {
    const response = await apiClient.put<T>(`${this.endpoint}/${id}`, data);
    return response.data;
  }

  async delete(id: string | number): Promise<void> {
    await apiClient.delete(`${this.endpoint}/${id}`);
  }
}
```

#### 3.2 创建各模块服务
**文件**: `src/services/departments.service.ts`

```typescript
import { BaseService } from './base.service';
import type { Department, DepartmentCreate, DepartmentUpdate } from '@/types/api';

class DepartmentsService extends BaseService<Department, DepartmentCreate, DepartmentUpdate> {
  constructor() {
    super('/departments');
  }
}

export const departmentsService = new DepartmentsService();
```

**文件**: `src/services/employees.service.ts`, `skills.service.ts`, 等...

---

### 阶段 4: 替换 Supabase 调用

#### 4.1 查找所有 Supabase 调用
```bash
# 在项目中搜索 Supabase 使用
grep -r "supabase\." src/
grep -r "from '@supabase'" src/
```

#### 4.2 替换示例

**Before (Supabase)**:
```typescript
const { data, error } = await supabase
  .from('departments')
  .select('*');
```

**After (New API)**:
```typescript
const data = await departmentsService.getAll();
```

**Before (Supabase)**:
```typescript
const { data, error } = await supabase
  .from('departments')
  .insert({ name: 'IT部', code: 'IT' });
```

**After (New API)**:
```typescript
const data = await departmentsService.create({
  name: 'IT部',
  code: 'IT'
});
```

---

### 阶段 5: 实现视图查询服务

#### 5.1 创建视图查询服务
**文件**: `src/services/views.service.ts`

```typescript
import { apiClient } from '@/lib/api-client';

export interface EmployeeCompetencyMatrix {
  employee_id: string;
  employee_name: string;
  skill_id: number;
  skill_name: string;
  current_level: number;
  target_level: number;
}

export interface SkillGapAnalysis {
  employee_id: string;
  employee_name: string;
  skill_id: number;
  skill_name: string;
  current_level: number;
  target_level: number;
  gap: number;
}

export const viewsService = {
  async getEmployeeCompetencyMatrix(employeeId?: string): Promise<EmployeeCompetencyMatrix[]> {
    const params = employeeId ? { employee_id: employeeId } : {};
    const response = await apiClient.get('/views/employee-competency-matrix', { params });
    return response.data;
  },

  async getSkillGapAnalysis(employeeId?: string): Promise<SkillGapAnalysis[]> {
    const params = employeeId ? { employee_id: employeeId } : {};
    const response = await apiClient.get('/views/skill-gap-analysis', { params });
    return response.data;
  },

  // ... 其他视图查询方法
};
```

---

### 阶段 6: 更新 UI 组件

#### 6.1 使用 React Query (推荐)
**安装依赖**:
```bash
npm install @tanstack/react-query
```

**文件**: `src/hooks/useDepartments.ts`

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { departmentsService } from '@/services/departments.service';
import type { DepartmentCreate, DepartmentUpdate } from '@/types/api';

export const useDepartments = () => {
  const queryClient = useQueryClient();

  const { data: departments, isLoading, error } = useQuery({
    queryKey: ['departments'],
    queryFn: () => departmentsService.getAll(),
  });

  const createMutation = useMutation({
    mutationFn: (data: DepartmentCreate) => departmentsService.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['departments'] });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: DepartmentUpdate }) =>
      departmentsService.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['departments'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => departmentsService.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['departments'] });
    },
  });

  return {
    departments,
    isLoading,
    error,
    createDepartment: createMutation.mutate,
    updateDepartment: updateMutation.mutate,
    deleteDepartment: deleteMutation.mutate,
  };
};
```

#### 6.2 在组件中使用
**文件**: `src/pages/Departments.tsx`

```typescript
import { useDepartments } from '@/hooks/useDepartments';

export const Departments: React.FC = () => {
  const { departments, isLoading, createDepartment } = useDepartments();

  if (isLoading) return <div>Loading...</div>;

  return (
    <div>
      <h1>部门管理</h1>
      <ul>
        {departments?.map((dept) => (
          <li key={dept.id}>{dept.name}</li>
        ))}
      </ul>
      <button onClick={() => createDepartment({ name: '新部门' })}>
        创建部门
      </button>
    </div>
  );
};
```

---

## 📦 环境变量配置

**文件**: `.env.development`
```env
VITE_API_BASE_URL=http://localhost:8000/api
```

**文件**: `.env.production`
```env
VITE_API_BASE_URL=https://api.yourcompany.com/api
```

---

## ✅ 实施检查清单

### 基础设施
- [ ] 创建 `src/lib/api-client.ts`
- [ ] 定义所有 TypeScript 类型
- [ ] 配置 Axios 拦截器

### 认证系统
- [ ] 实现 `authService`
- [ ] 创建 `AuthContext` 和 `useAuth` hook
- [ ] 创建 OTP 登录 UI 组件
- [ ] 测试登录/登出流程

### CRUD 服务
- [ ] 创建 `BaseService` 基类
- [ ] 实现各模块服务（13 个）
- [ ] 创建对应的 React Query hooks

### 视图查询
- [ ] 实现 `viewsService`
- [ ] 创建视图查询 hooks
- [ ] 更新相关 UI 组件

### Supabase 迁移
- [ ] 识别所有 Supabase 调用
- [ ] 逐个替换为新 API
- [ ] 删除 Supabase 依赖

### 测试
- [ ] 测试所有 CRUD 操作
- [ ] 测试认证流程
- [ ] 测试视图查询
- [ ] 端到端测试

---

## 📊 预计工作量

| 阶段 | 任务 | 预计时间 |
|------|------|----------|
| 1 | 基础架构 | 2 小时 |
| 2 | 认证模块 | 3 小时 |
| 3 | CRUD 服务 | 4 小时 |
| 4 | Supabase 迁移 | 6 小时 |
| 5 | 视图查询 | 2 小时 |
| 6 | UI 组件更新 | 4 小时 |
| 7 | 测试和调试 | 3 小时 |
| **总计** | | **24 小时** |

---

## 🚨 注意事项

1. **向后兼容**: 在完成迁移和测试前，保留 Supabase 代码
2. **错误处理**: 确保所有 API 调用都有适当的错误处理
3. **Loading 状态**: 使用 React Query 管理 loading 和错误状态
4. **Token 刷新**: 考虑实现 refresh token 机制
5. **本地存储安全**: 考虑使用 httpOnly cookie 存储 token

---

## 📚 参考资料

- FastAPI 文档: https://fastapi.tiangolo.com/
- React Query 文档: https://tanstack.com/query/latest
- Axios 文档: https://axios-http.com/

---

**状态**: ⏸️ 等待实施
**优先级**: 🔴 高
**预计完成**: 3-4 天
