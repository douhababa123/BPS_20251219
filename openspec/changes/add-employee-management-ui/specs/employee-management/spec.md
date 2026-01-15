# Spec: Employee Management (员工信息管理)

## ADDED Requirements

### Requirement: Employee List View
系统 SHALL 提供员工列表视图，允许 Site PS 和 Admin 查看和管理所有员工信息。

#### Scenario: Display employee list
- **WHEN** Site PS 或 Admin 用户访问员工管理页面
- **THEN** 系统显示所有员工的表格
- **AND** 表格列包含：工号、姓名、部门、职位、角色权限、在职状态、操作按钮
- **AND** 默认按工号升序排列
- **AND** 每页显示 50 条记录，支持分页导航

#### Scenario: Search employees by name or ID
- **WHEN** 用户在搜索框输入关键词（姓名或工号）
- **THEN** 系统实时过滤员工列表
- **AND** 匹配姓名或工号包含关键词的员工
- **AND** 显示匹配结果数量

#### Scenario: Filter employees by role
- **WHEN** 用户选择角色筛选器（BPS_ENGINEER / SITE_PS / ADMIN / 全部）
- **THEN** 系统仅显示该角色的员工
- **AND** 筛选条件在 URL 参数中保留（支持分享链接）

#### Scenario: Filter employees by status
- **WHEN** 用户选择在职状态筛选器（在职 / 离职 / 全部）
- **THEN** 系统仅显示对应状态的员工
- **AND** 默认只显示在职员工

#### Scenario: Sort employee list by column
- **WHEN** 用户点击表格列标题（工号、姓名、部门）
- **THEN** 系统按该列排序（首次点击升序，再次点击降序）
- **AND** 当前排序列显示排序方向指示箭头

#### Scenario: Unauthorized user access attempt
- **WHEN** BPS_ENGINEER 角色用户尝试访问员工管理页面
- **THEN** 系统拒绝访问并重定向到首页
- **AND** 显示权限不足提示消息
- **AND** Sidebar 中不显示「员工管理」菜单项

### Requirement: Add New Employee
系统 SHALL 允许 Site PS 和 Admin 通过表单添加新员工，并进行数据验证。

#### Scenario: Open add employee form
- **WHEN** 用户点击「添加员工」按钮
- **THEN** 系统显示员工信息表单（对话框或侧边栏）
- **AND** 表单包含字段：工号、姓名、部门、邮箱、职位、角色权限
- **AND** 角色权限默认选中 BPS_ENGINEER

#### Scenario: Validate required fields
- **WHEN** 用户尝试提交表单但必填字段为空
- **THEN** 系统阻止提交并高亮显示错误字段
- **AND** 显示错误提示：「请填写必填字段」
- **AND** 必填字段包括：工号、姓名、部门

#### Scenario: Validate employee ID uniqueness
- **WHEN** 用户输入工号并离开焦点（blur）
- **THEN** 系统实时检查该工号是否已存在
- **AND** 如果工号已存在，显示错误提示：「该工号已被使用」
- **AND** 提交按钮禁用

#### Scenario: Validate email format
- **WHEN** 用户输入邮箱地址
- **THEN** 系统验证邮箱格式是否有效
- **AND** 如果格式无效，显示错误提示：「请输入有效的邮箱地址」

#### Scenario: Successfully create employee
- **WHEN** 用户填写所有必填字段并通过验证后提交表单
- **THEN** 系统在数据库中创建新员工记录
- **AND** 设置 `is_active = true`（默认在职）
- **AND** 关闭表单对话框
- **AND** 刷新员工列表，新员工显示在列表中
- **AND** 显示成功提示：「员工添加成功」

#### Scenario: Handle creation failure
- **WHEN** 表单提交后数据库操作失败（如网络错误）
- **THEN** 系统显示错误提示：「添加员工失败，请重试」
- **AND** 保持表单内容不清空，允许用户修改后重试

### Requirement: Edit Employee Information
系统 SHALL 允许 Site PS 和 Admin 编辑现有员工的信息，但工号不可修改。

#### Scenario: Open edit employee form
- **WHEN** 用户点击员工列表中某行的「编辑」按钮
- **THEN** 系统显示员工信息表单（对话框或侧边栏）
- **AND** 表单预填充该员工的当前信息
- **AND** 工号字段为只读（不可编辑）

#### Scenario: Modify employee role
- **WHEN** 用户在编辑表单中更改角色权限（如 BPS_ENGINEER → SITE_PS）
- **THEN** 系统允许修改
- **AND** 保存后该员工的 `role` 字段更新
- **AND** 如果从 SITE_PS 降级为 BPS_ENGINEER，显示二次确认对话框

#### Scenario: Change employee department
- **WHEN** 用户在编辑表单中选择新的部门
- **THEN** 系统允许修改
- **AND** 保存后该员工的 `department_id` 字段更新
- **AND** 该员工在能力评估和日程管理模块中的部门信息同步更新

#### Scenario: Successfully update employee
- **WHEN** 用户修改信息并提交表单
- **THEN** 系统在数据库中更新员工记录
- **AND** 关闭表单对话框
- **AND** 刷新员工列表，显示更新后的信息
- **AND** 显示成功提示：「员工信息已更新」

#### Scenario: No changes made
- **WHEN** 用户打开编辑表单但未修改任何字段直接提交
- **THEN** 系统不执行数据库更新
- **AND** 关闭表单对话框
- **AND** 显示提示：「未检测到更改」

### Requirement: Delete or Deactivate Employee
系统 SHALL 支持软删除（设置为离职）和硬删除（物理删除）员工记录，并检查关联数据。

#### Scenario: Soft delete employee (set inactive)
- **WHEN** 用户点击员工列表中某行的「删除」按钮
- **THEN** 系统显示确认对话框：「确认将该员工设置为离职状态？」
- **AND** 用户确认后，设置该员工的 `is_active = false`
- **AND** 刷新员工列表，该员工从默认列表中消失（离职员工可通过筛选器查看）
- **AND** 显示成功提示：「员工已设置为离职状态」

#### Scenario: Hard delete employee with no related data
- **WHEN** 用户点击「删除」按钮并选择「永久删除」选项
- **THEN** 系统检查该员工是否有关联数据（日程任务、能力评估）
- **AND** 如果没有关联数据，显示二次确认对话框：「确认永久删除该员工？此操作不可恢复」
- **AND** 用户确认后，物理删除该员工记录
- **AND** 刷新员工列表
- **AND** 显示成功提示：「员工已永久删除」

#### Scenario: Prevent hard delete with related data
- **WHEN** 用户尝试永久删除有关联数据的员工
- **THEN** 系统显示警告对话框：「该员工存在关联数据（X 条日程任务，Y 条能力评估），只能设置为离职状态」
- **AND** 提供「设置为离职」选项
- **AND** 取消永久删除操作

#### Scenario: Reactivate inactive employee
- **WHEN** 用户在离职员工列表中选择某员工并点击「激活」按钮
- **THEN** 系统设置该员工的 `is_active = true`
- **AND** 刷新员工列表，该员工重新出现在默认列表中
- **AND** 显示成功提示：「员工已恢复为在职状态」

### Requirement: Employee Form Validation
系统 SHALL 对员工表单的所有输入字段进行实时验证，并提供清晰的错误反馈。

#### Scenario: Real-time validation for name field
- **WHEN** 用户在姓名字段输入内容
- **THEN** 系统实时验证姓名长度（最少 2 个字符）
- **AND** 如果长度不足，字段下方显示错误提示：「姓名至少需要 2 个字符」
- **AND** 提交按钮禁用

#### Scenario: Real-time validation for employee ID
- **WHEN** 用户在工号字段输入内容并离开焦点
- **THEN** 系统检查工号格式（可选，如必须包含字母和数字）
- **AND** 检查工号唯一性（数据库查询）
- **AND** 如果工号重复，显示错误提示并禁用提交按钮
- **AND** 如果工号可用，显示成功标识（绿色勾）

#### Scenario: Real-time validation for email
- **WHEN** 用户在邮箱字段输入内容
- **THEN** 系统验证邮箱格式（正则表达式）
- **AND** 如果格式无效，显示错误提示：「邮箱格式不正确」
- **AND** 邮箱为可选字段，空值不报错

#### Scenario: Display all validation errors on submit
- **WHEN** 用户点击提交按钮但表单存在多个验证错误
- **THEN** 系统阻止提交并高亮所有错误字段
- **AND** 在表单顶部显示错误汇总：「请修正 X 个错误」
- **AND** 滚动到第一个错误字段

### Requirement: Role-Based Access Control
系统 SHALL 基于用户角色控制员工管理功能的访问权限。

#### Scenario: SITE_PS user accesses employee management
- **WHEN** SITE_PS 角色用户登录系统
- **THEN** Sidebar 显示「员工管理」菜单项
- **AND** 用户可访问员工管理页面
- **AND** 用户可执行所有 CRUD 操作（添加、编辑、删除员工）

#### Scenario: ADMIN user accesses employee management
- **WHEN** ADMIN 角色用户登录系统
- **THEN** Sidebar 显示「员工管理」菜单项
- **AND** 用户可访问员工管理页面
- **AND** 用户可执行所有 CRUD 操作，包括硬删除

#### Scenario: BPS_ENGINEER user cannot access
- **WHEN** BPS_ENGINEER 角色用户登录系统
- **THEN** Sidebar 不显示「员工管理」菜单项
- **AND** 用户尝试直接访问 `/employee-management` URL 时被重定向到首页
- **AND** 显示权限不足提示

#### Scenario: Guest user cannot access
- **WHEN** 未登录用户尝试访问员工管理页面
- **THEN** 系统重定向到登录页面
- **AND** 登录成功后根据角色决定是否允许访问

### Requirement: Batch Import Employees (Optional - Phase 2)
系统 SHALL 支持通过 Excel 文件批量导入员工信息，并提供数据验证和错误报告。

#### Scenario: Upload Excel file
- **WHEN** 用户点击「批量导入」按钮
- **THEN** 系统显示文件上传对话框
- **AND** 用户可拖拽或点击上传 .xlsx 或 .xls 文件
- **AND** 提供「下载模板」按钮，下载标准 Excel 模板

#### Scenario: Parse and validate Excel data
- **WHEN** 用户上传 Excel 文件
- **THEN** 系统解析文件内容
- **AND** 验证每行数据（必填字段、格式、唯一性）
- **AND** 显示数据预览表格
- **AND** 标记验证失败的行（红色高亮）
- **AND** 显示统计信息：「共 X 行，成功 Y 行，失败 Z 行」

#### Scenario: Import valid records
- **WHEN** 用户确认导入数据
- **THEN** 系统仅导入验证通过的记录
- **AND** 显示导入进度条
- **AND** 导入完成后显示成功数量
- **AND** 刷新员工列表

#### Scenario: Download error report
- **WHEN** Excel 导入存在验证失败的记录
- **THEN** 系统提供「下载错误报告」按钮
- **AND** 点击下载包含失败行和错误原因的 Excel 文件
- **AND** 用户可修正后重新上传

### Requirement: Operation Audit Log (Optional - Phase 2)
系统 SHALL 记录所有员工信息的变更操作，包括操作人、操作时间和变更详情。

#### Scenario: Log employee creation
- **WHEN** 用户成功创建新员工
- **THEN** 系统在 `employee_change_logs` 表中插入日志记录
- **AND** 记录内容包括：员工ID、操作人ID、操作类型（CREATE）、创建时间
- **AND** 变更详情为新员工的完整信息（JSON格式）

#### Scenario: Log employee update
- **WHEN** 用户成功更新员工信息
- **THEN** 系统在 `employee_change_logs` 表中插入日志记录
- **AND** 记录内容包括：员工ID、操作人ID、操作类型（UPDATE）、修改时间
- **AND** 变更详情为修改前后的字段对比（JSON格式）：`{"role": {"old": "BPS_ENGINEER", "new": "SITE_PS"}}`

#### Scenario: Log employee deletion
- **WHEN** 用户成功删除员工（软删除或硬删除）
- **THEN** 系统在 `employee_change_logs` 表中插入日志记录
- **AND** 记录内容包括：员工ID、操作人ID、操作类型（DELETE）、删除时间
- **AND** 变更详情为被删除员工的完整信息

#### Scenario: View operation history
- **WHEN** 用户在员工详情页查看操作历史
- **THEN** 系统显示该员工相关的所有日志记录
- **AND** 按时间倒序排列（最新的在最上方）
- **AND** 每条日志显示：操作时间、操作人姓名、操作类型、变更摘要

## MODIFIED Requirements

无修改的需求。

## REMOVED Requirements

无移除的需求。

