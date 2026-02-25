# 日程管理创建任务后跳转登录页问题修复

## 问题原因分析

### 🔍 问题现象
在日程管理界面创建任务后，系统自动跳转到登录页面。

### 🎯 根本原因

1. **后端 API 需要认证**
   - 文件：`backend/routers/tasks.py` Line 115-117
   ```python
   def create_task(
       task: TaskCreate,
       cursor=Depends(get_db),
       current_user=Depends(get_current_user)  # ← 需要认证
   ):
   ```

2. **Token 验证失败时返回 401**
   - 文件：`backend/routers/auth.py` Line 122-135
   ```python
   async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
       """依赖注入：获取当前登录用户"""
       token = credentials.credentials
       payload = auth.verify_token(token)
       
       if not payload:
           raise HTTPException(
               status_code=401,  # ← 返回 401 Unauthorized
               detail="Token 无效或已过期"
           )
       
       return payload
   ```

3. **前端拦截器自动跳转登录**
   - 文件：`src/lib/api-client.ts` Line 54-65
   ```typescript
   // Token 过期或无效
   if (error.response?.status === 401 && !originalRequest._retry) {
       originalRequest._retry = true;
       
       // 清除本地存储
       localStorage.removeItem('access_token');
       localStorage.removeItem('user_id');
       localStorage.removeItem('user_email');
       
       // 重定向到登录页 ← 这里触发跳转
       if (window.location.pathname !== '/login') {
           window.location.href = '/login';
       }
   }
   ```

## 可能的原因

### 原因 1：JWT Token 未正确保存
**检查方法**：
```javascript
// 在浏览器控制台执行
console.log('Token:', localStorage.getItem('access_token'));
console.log('User ID:', localStorage.getItem('user_id'));
console.log('Email:', localStorage.getItem('user_email'));
```

**预期结果**：应该看到有效的 token 字符串（JWT 格式：`eyJ...`）

### 原因 2：Token 已过期
**Token 有效期**：`backend/config.py` Line 23
```python
jwt_access_token_expire_minutes: int = 43200  # 30天（30*24*60分钟）
```

**检查方法**：
```javascript
// 在浏览器控制台执行
const token = localStorage.getItem('access_token');
if (token) {
    const payload = JSON.parse(atob(token.split('.')[1]));
    const exp = new Date(payload.exp * 1000);
    console.log('Token 过期时间:', exp);
    console.log('是否已过期:', exp < new Date());
}
```

### 原因 3：Token 格式不正确
**检查 Authorization 头格式**：
应为 `Bearer <token>`，在 `src/lib/api-client.ts` Line 36 自动添加。

### 原因 4：登录使用的是旧系统（Supabase）
如果用户使用了旧的 Supabase 登录，token 可能不兼容 FastAPI JWT。

## 解决方案

### 方案 1：立即修复 - 重新登录（推荐）

**步骤**：
1. 在浏览器控制台清除旧 token：
   ```javascript
   localStorage.removeItem('access_token');
   localStorage.removeItem('user_id');
   localStorage.removeItem('user_email');
   ```
2. 刷新页面 → 自动跳转登录页
3. 使用 **邮箱 + OTP** 重新登录
4. 再次尝试创建任务

### 方案 2：代码修复 - 添加错误提示

修改 `src/pages/Schedule.tsx` 的 `createTaskMutation`：

```typescript
const createTaskMutation = useMutation({
  mutationFn: async (data: any) => {
    const task: any = await tasksService.create(data);
    
    // ... 其他逻辑
    
    return task;
  },
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['tasks'] });
    queryClient.invalidateQueries({ queryKey: ['notification-count'] });
    onSuccess();
  },
  // ✅ 添加错误处理
  onError: (error: any) => {
    if (error.response?.status === 401) {
      alert('❌ 认证已过期，请重新登录');
      // 跳转逻辑已在 api-client.ts 拦截器中处理
    } else {
      const message = error.response?.data?.detail || error.message || '创建任务失败';
      alert(`❌ ${message}`);
    }
  },
});
```

### 方案 3：后端优化 - 延长 Token 有效期

如果频繁遇到 token 过期问题，可以延长有效期：

修改 `backend/config.py` Line 23：
```python
jwt_access_token_expire_minutes: int = 129600  # 90天（90*24*60分钟）
```

### 方案 4：前端优化 - Token 自动刷新机制

在 `src/lib/api-client.ts` 添加 token 刷新逻辑（需后端支持 refresh token）：

```typescript
// 响应拦截器 - 添加 token 刷新
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      
      try {
        // TODO: 调用后端 /auth/refresh-token 接口
        // const newToken = await refreshToken();
        // localStorage.setItem('access_token', newToken);
        // originalRequest.headers.Authorization = `Bearer ${newToken}`;
        // return apiClient.request(originalRequest);
      } catch (refreshError) {
        // 刷新失败，跳转登录
        localStorage.removeItem('access_token');
        localStorage.removeItem('user_id');
        localStorage.removeItem('user_email');
        
        if (window.location.pathname !== '/login') {
          window.location.href = '/login';
        }
      }
    }
    
    return Promise.reject(error);
  }
);
```

## 验证步骤

### 1. 检查登录状态
```bash
# PowerShell 测试
$token = "你的_access_token"
$headers = @{ Authorization = "Bearer $token" }
Invoke-RestMethod -Uri "http://localhost:8000/api/auth/me" -Headers $headers -Method GET
```

**预期输出**：
```json
{
  "user_id": "...",
  "email": "...",
  "name": "..."
}
```

### 2. 测试创建任务
```bash
# PowerShell 测试
$token = "你的_access_token"
$headers = @{
    Authorization = "Bearer $token"
    "Content-Type" = "application/json"
}
$body = @{
    task_name = "测试任务"
    task_type = "WS"
    task_location = "CQ-SG"
    start_date = "2026-02-14"
    end_date = "2026-02-15"
    status = "planned"
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:8000/api/tasks/" -Headers $headers -Method POST -Body $body
```

**预期输出**：返回创建的任务对象（包含 `id`, `task_name` 等字段）

### 3. 检查浏览器控制台
打开浏览器开发者工具（F12）→ Console：
- ✅ 无 `401 Unauthorized` 错误
- ✅ 无 `Token 无效或已过期` 错误
- ✅ Network 标签中 POST `/api/tasks/` 返回 `200 OK`

## 推荐操作

### 对于普通用户
1. **直接重新登录**（方案 1）
2. 如果问题持续，联系管理员检查后端配置

### 对于开发者
1. **添加错误提示**（方案 2）- 让用户知道为什么跳转
2. **延长 Token 有效期**（方案 3）- 减少重新登录频率
3. **实现 Token 刷新**（方案 4）- 提升用户体验（需后端支持）

## 相关文件

- **前端拦截器**: [src/lib/api-client.ts](src/lib/api-client.ts#L54-L65)
- **认证服务**: [src/services/auth.service.ts](src/services/auth.service.ts#L1)
- **任务路由**: [backend/routers/tasks.py](backend/routers/tasks.py#L115)
- **认证路由**: [backend/routers/auth.py](backend/routers/auth.py#L122)
- **后端配置**: [backend/config.py](backend/config.py#L23)

## 附录：调试命令

```bash
# 查看当前 token 过期时间
python -c "
from jose import jwt
token = input('输入 token: ')
payload = jwt.decode(token, options={'verify_signature': False})
from datetime import datetime
exp_time = datetime.fromtimestamp(payload['exp'])
print(f'过期时间: {exp_time}')
print(f'是否已过期: {exp_time < datetime.now()}')
"

# 测试 token 验证
cd backend
python -c "
from auth import verify_token
token = input('输入 token: ')
result = verify_token(token)
print('验证结果:', result)
"
```

---

**最后更新**: 2026-02-13  
**问题状态**: 🔍 待验证  
**优先级**: P1 - 影响核心功能
