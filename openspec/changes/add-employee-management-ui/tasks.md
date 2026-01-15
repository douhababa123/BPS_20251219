# Implementation Tasks

## Phase 1: 基础功能实现（必须）

### 1. 准备工作
- [ ] 1.1 审阅提案并获得批准
- [ ] 1.2 确认 `enhance-schedule-and-competency` 已完成（employees.role 字段存在）
- [ ] 1.3 设计 UI 原型（可选，草图即可）

### 2. 数据服务层扩展
- [ ] 2.1 在 `src/lib/supabaseService.ts` 增加员工 CRUD 方法
  - [ ] `getAllEmployees(filters?)` - 获取员工列表（支持筛选）
  - [ ] `getEmployeeById(id)` - 获取单个员工详情
  - [ ] `createEmployee(data)` - 创建新员工
  - [ ] `updateEmployee(id, data)` - 更新员工信息
  - [ ] `deleteEmployee(id, soft?)` - 删除员工（软删除/硬删除）
  - [ ] `checkEmployeeIdExists(employeeId)` - 检查工号是否已存在
- [ ] 2.2 在 `src/lib/supabaseService.ts` 增加部门查询方法
  - [ ] `getAllDepartments()` - 获取所有部门（用于下拉选择）
- [ ] 2.3 编写 TypeScript 类型定义
  - [ ] `EmployeeFormData` - 表单数据类型
  - [ ] `EmployeeFilters` - 筛选条件类型

### 3. 权限系统集成
- [ ] 3.1 在 `src/contexts/PersonaContext.tsx` 或 `AuthContext.tsx` 中
  - [ ] 增加 `canManageEmployees()` 方法
  - [ ] 返回当前用户是否为 SITE_PS 或 ADMIN
- [ ] 3.2 创建路由守卫组件 `src/components/ProtectedRoute.tsx`
  - [ ] 检查用户权限
  - [ ] 无权限时重定向到首页或显示提示

### 4. 员工列表页面
- [ ] 4.1 创建 `src/pages/EmployeeManagement.tsx`
  - [ ] 页面布局（标题、搜索栏、筛选器、表格、分页）
  - [ ] 使用 React Query 加载员工数据
  - [ ] 加载状态和错误处理
- [ ] 4.2 创建 `src/components/EmployeeTable.tsx`
  - [ ] 表格列：工号、姓名、部门、职位、角色、状态、操作
  - [ ] 排序功能（点击列标题）
  - [ ] 行操作按钮：编辑、删除
  - [ ] 响应式设计（移动端友好）
- [ ] 4.3 实现搜索功能
  - [ ] 搜索框（实时搜索或按钮触发）
  - [ ] 支持按姓名、工号搜索
- [ ] 4.4 实现筛选功能
  - [ ] 角色筛选（全部/BPS_ENGINEER/SITE_PS/ADMIN）
  - [ ] 在职状态筛选（全部/在职/离职）
  - [ ] 部门筛选（下拉多选）
- [ ] 4.5 实现分页
  - [ ] 每页 50 条记录
  - [ ] 页码导航

### 5. 添加员工功能
- [ ] 5.1 创建 `src/components/EmployeeForm.tsx`
  - [ ] 表单字段：工号、姓名、部门、邮箱、职位、角色权限
  - [ ] 使用 React Hook Form + Zod 验证
  - [ ] 实时校验反馈
- [ ] 5.2 实现字段验证
  - [ ] 工号：必填、唯一性（实时检查）
  - [ ] 姓名：必填、最少2个字符
  - [ ] 邮箱：格式验证（可选）
  - [ ] 部门：必选
  - [ ] 角色：默认 BPS_ENGINEER
- [ ] 5.3 添加员工对话框/侧边栏
  - [ ] 点击「添加员工」按钮打开
  - [ ] 表单提交逻辑
  - [ ] 成功提示和列表刷新
  - [ ] 错误处理和提示

### 6. 编辑员工功能
- [ ] 6.1 复用 `EmployeeForm.tsx`（添加 `mode` 属性：create/edit）
  - [ ] 编辑模式下禁用工号字段
  - [ ] 预填充当前数据
- [ ] 6.2 编辑员工对话框
  - [ ] 点击表格中的「编辑」按钮打开
  - [ ] 加载当前员工数据
  - [ ] 表单提交更新逻辑
  - [ ] 成功提示和列表刷新

### 7. 删除员工功能
- [ ] 7.1 实现软删除（推荐）
  - [ ] 点击「删除」按钮显示确认对话框
  - [ ] 设置 `is_active = false`
  - [ ] 成功提示和列表刷新
- [ ] 7.2 实现硬删除（可选，需二次确认）
  - [ ] 检查关联数据（日程任务、能力评估）
  - [ ] 如有关联则禁止删除或显示警告
  - [ ] 物理删除记录

### 8. UI/UX 优化
- [ ] 8.1 角色标识（颜色徽章）
  - [ ] BPS_ENGINEER - 蓝色
  - [ ] SITE_PS - 橙色
  - [ ] ADMIN - 红色
- [ ] 8.2 在职状态标识
  - [ ] 在职 - 绿色圆点
  - [ ] 离职 - 灰色圆点
- [ ] 8.3 空状态设计
  - [ ] 无员工时显示友好提示和「添加员工」引导
- [ ] 8.4 加载骨架屏（Skeleton）
- [ ] 8.5 错误提示优化（Toast 通知）

### 9. 路由和菜单集成
- [ ] 9.1 在 `src/App.tsx` 添加路由
  - [ ] `/employee-management` → `EmployeeManagement` 页面
  - [ ] 使用 `ProtectedRoute` 包裹
- [ ] 9.2 在 `src/components/Sidebar.tsx` 添加菜单项
  - [ ] 「员工管理」菜单（仅 SITE_PS 和 ADMIN 可见）
  - [ ] 图标：Users 或 UserCog
  - [ ] 权限判断（根据当前用户角色显示/隐藏）

### 10. 测试与验证
- [ ] 10.1 单元测试（可选）
  - [ ] 员工数据服务方法测试
  - [ ] 表单验证逻辑测试
- [ ] 10.2 集成测试
  - [ ] 添加员工流程
  - [ ] 编辑员工流程
  - [ ] 删除员工流程（软删除）
  - [ ] 权限控制测试（普通用户无法访问）
- [ ] 10.3 用户验收测试
  - [ ] 邀请 Site PS 用户测试完整流程
  - [ ] 收集反馈和优化建议

## Phase 2: 增强功能（可选）

### 11. 批量导入功能
- [ ] 11.1 创建 `src/components/EmployeeImport.tsx`
  - [ ] 文件上传组件（拖拽或点击上传）
  - [ ] 模板下载按钮
- [ ] 11.2 Excel 解析逻辑
  - [ ] 使用 `xlsx` 库解析文件
  - [ ] 字段映射（Excel 列 → 数据库字段）
  - [ ] 数据验证（格式、必填、唯一性）
- [ ] 11.3 数据预览
  - [ ] 显示解析后的数据表格
  - [ ] 标记验证错误（红色高亮）
  - [ ] 显示统计信息（成功/失败数量）
- [ ] 11.4 批量导入执行
  - [ ] 仅导入验证通过的记录
  - [ ] 失败记录生成错误报告（可下载）
  - [ ] 进度条显示
- [ ] 11.5 Excel 模板生成
  - [ ] 包含所有必填字段
  - [ ] 字段说明和示例数据
  - [ ] 下拉选项（部门、角色）

### 12. 操作日志功能
- [ ] 12.1 创建数据库表 `employee_change_logs`
  ```sql
  CREATE TABLE employee_change_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID REFERENCES employees(id),
    operator_id UUID REFERENCES employees(id),
    operation_type TEXT CHECK (operation_type IN ('CREATE', 'UPDATE', 'DELETE')),
    changes JSONB,  -- {"field": {"old": "旧值", "new": "新值"}}
    created_at TIMESTAMPTZ DEFAULT now()
  );
  ```
- [ ] 12.2 在数据服务层增加日志记录方法
  - [ ] `logEmployeeChange(employeeId, operatorId, type, changes)` 
- [ ] 12.3 在所有 CRUD 操作中记录日志
  - [ ] 创建员工 → 记录 CREATE 日志
  - [ ] 更新员工 → 记录 UPDATE 日志（变更字段详情）
  - [ ] 删除员工 → 记录 DELETE 日志
- [ ] 12.4 操作日志查看界面（可选）
  - [ ] 在员工详情页显示历史操作记录
  - [ ] 按时间倒序排列
  - [ ] 显示操作人、操作类型、变更内容

### 13. 高级搜索功能
- [ ] 13.1 多条件组合搜索
  - [ ] 工号 + 姓名 + 部门同时搜索
- [ ] 13.2 模糊匹配
  - [ ] 姓名支持部分匹配（如输入「王」匹配所有姓王的）
- [ ] 13.3 保存搜索条件
  - [ ] 本地存储常用筛选条件

## 依赖关系说明
- 任务 1（准备工作）必须在所有其他任务之前完成
- 任务 2（数据服务层）是任务 4-7 的前置依赖
- 任务 3（权限系统）是任务 9 的前置依赖
- 任务 4-7 可并行开发（列表、添加、编辑、删除功能独立）
- 任务 11-13（Phase 2）可在 Phase 1 完成后独立开发

## 预估工作量
- **Phase 1（基础功能）**：3 天
  - 数据服务层：0.5 天
  - 权限集成：0.5 天
  - 列表页面：0.5 天
  - 表单组件：1 天
  - 删除功能：0.25 天
  - UI/UX 优化：0.25 天

- **Phase 2（增强功能）**：2.5 天
  - 批量导入：1.5 天
  - 操作日志：1 天

**总计**：3-5.5 天

