# Spec: Schedule Management (日程管理)

## ADDED Requirements

### Requirement: Half-Day Time Slot Support
系统 SHALL 支持半天（AM/PM）粒度的日程管理，允许用户创建和管理上午、下午或全天的任务。

#### Scenario: Create AM task
- **WHEN** 用户选择创建新任务并选择时间槽为「上午（AM）」
- **THEN** 系统自动设置任务工时为 3.5 小时
- **AND** 任务在日历视图中显示在对应日期的上半部分
- **AND** 该时间槽的饱和度计算中仅占用上午资源

#### Scenario: Create PM task
- **WHEN** 用户选择创建新任务并选择时间槽为「下午（PM）」
- **THEN** 系统自动设置任务工时为 4.5 小时
- **AND** 任务在日历视图中显示在对应日期的下半部分
- **AND** 该时间槽的饱和度计算中仅占用下午资源

#### Scenario: Create full-day task
- **WHEN** 用户选择创建新任务并选择时间槽为「整天（Full Day）」
- **THEN** 系统自动设置任务工时为 8 小时
- **AND** 任务在日历视图中占据整个日期单元格
- **AND** 该任务占用全天资源（AM + PM）

#### Scenario: View half-day tasks in calendar
- **WHEN** 用户查看日历视图且某天存在多个半天任务
- **THEN** 系统显示上午任务和下午任务的明确分隔
- **AND** 每个任务显示时间槽标识（AM/PM 图标或标签）
- **AND** 用户可独立点击和编辑每个半天任务

#### Scenario: Backward compatibility with legacy full-day tasks
- **WHEN** 系统加载在引入半天功能之前创建的任务
- **THEN** 这些任务自动标记为「整天（Full Day）」
- **AND** 在日历视图中正常显示为全天任务
- **AND** 用户可编辑并将其转换为半天任务

### Requirement: Role-Based Permission Control
系统 SHALL 实现基于角色的权限控制，确保普通 BPS 工程师仅能查看和编辑自己的日程，而 Site PS 角色可管理所有工程师的日程。

#### Scenario: BPS Engineer views own schedule
- **WHEN** 角色为 BPS_ENGINEER 的用户访问日程管理页面
- **THEN** 系统默认仅显示该用户自己的日程任务
- **AND** 用户可创建、编辑和删除自己的任务
- **AND** 筛选器中不显示其他工程师选项

#### Scenario: BPS Engineer attempts to edit others' schedule
- **WHEN** BPS_ENGINEER 用户尝试通过 URL 或 API 修改其他工程师的任务
- **THEN** 系统拒绝该操作并返回权限错误
- **AND** 显示友好的错误提示：「您没有权限修改其他工程师的日程」
- **AND** 操作不生效，数据保持不变

#### Scenario: Site PS views all engineers' schedules
- **WHEN** 角色为 SITE_PS 的用户访问日程管理页面
- **THEN** 系统默认显示所有 BPS 工程师的日程任务
- **AND** 用户可通过筛选器选择特定工程师
- **AND** 日历视图显示「管理员模式」标识

#### Scenario: Site PS edits another engineer's schedule
- **WHEN** SITE_PS 用户修改其他工程师的任务
- **THEN** 系统允许该操作并成功保存修改
- **AND** 系统触发通知机制（见通知需求）
- **AND** 修改记录在系统日志中

#### Scenario: Role verification on page load
- **WHEN** 用户首次访问日程管理页面
- **THEN** 系统从 AuthContext 获取当前用户的角色
- **AND** 根据角色动态调整 UI 元素（编辑按钮、筛选器等）
- **AND** 前端和后端均进行权限校验

### Requirement: Schedule Change Notifications
系统 SHALL 在 Site PS 修改其他工程师日程时自动触发通知，确保被修改的工程师能够及时获知变更。

#### Scenario: Notification triggered on cross-user modification
- **WHEN** SITE_PS 用户创建、修改或删除其他工程师的任务
- **THEN** 系统在 `schedule_change_notifications` 表中插入一条通知记录
- **AND** 通知包含修改人、被修改人、任务信息、变更类型和变更详情
- **AND** 通知默认标记为未读（is_read = false）

#### Scenario: Self-modification does not trigger notification
- **WHEN** 用户（无论角色）修改自己的任务
- **THEN** 系统不触发通知
- **AND** 不插入通知记录

#### Scenario: User views unread notifications
- **WHEN** 用户访问系统时存在未读的日程变更通知
- **THEN** Header 中的通知图标显示红点或未读数量角标
- **AND** 用户点击通知图标时显示通知列表
- **AND** 通知按时间倒序排列（最新的在最上方）

#### Scenario: User reads notification details
- **WHEN** 用户在通知列表中点击某条通知
- **THEN** 系统显示通知详情（修改人、修改时间、变更内容）
- **AND** 该通知自动标记为已读（is_read = true）
- **AND** Header 中的未读数量更新

#### Scenario: Notification content for task creation
- **WHEN** SITE_PS 为其他工程师创建任务并触发通知
- **THEN** 通知消息格式为：「[修改人姓名] 为您创建了新任务：[任务名称]（[日期][时间槽]）」
- **AND** 通知详情中包含完整任务信息

#### Scenario: Notification content for task update
- **WHEN** SITE_PS 修改其他工程师的任务并触发通知
- **THEN** 通知消息格式为：「[修改人姓名] 修改了您的任务：[任务名称]」
- **AND** 通知详情中包含修改前后的对比（字段级别的变更）

#### Scenario: Notification content for task deletion
- **WHEN** SITE_PS 删除其他工程师的任务并触发通知
- **THEN** 通知消息格式为：「[修改人姓名] 删除了您的任务：[任务名称]（[日期][时间槽]）」
- **AND** 通知详情中包含被删除任务的完整信息

### Requirement: Saturation Calculation for Half-Day Slots
系统 SHALL 根据半天时间槽重新计算资源饱和度，确保统计准确反映上午/下午的独立资源使用情况。

#### Scenario: Calculate saturation for AM slot
- **WHEN** 系统计算某工程师某天上午的饱和度
- **THEN** 仅统计时间槽为「AM」或「FULL_DAY」的任务
- **AND** AM 任务计 3.5 小时，FULL_DAY 任务计 4 小时（8小时的一半）
- **AND** 饱和度 = (实际工时 / 标准上午工时 3.5h) × 100%

#### Scenario: Calculate saturation for PM slot
- **WHEN** 系统计算某工程师某天下午的饱和度
- **THEN** 仅统计时间槽为「PM」或「FULL_DAY」的任务
- **AND** PM 任务计 4.5 小时，FULL_DAY 任务计 4 小时（8小时的一半）
- **AND** 饱和度 = (实际工时 / 标准下午工时 4.5h) × 100%

#### Scenario: Calculate daily saturation
- **WHEN** 系统计算某工程师某天的整体饱和度
- **THEN** 统计所有时间槽的任务（AM + PM + FULL_DAY）
- **AND** 按实际工时累加（AM: 3.5h, PM: 4.5h, FULL_DAY: 8h）
- **AND** 饱和度 = (实际总工时 / 标准日工时 8h) × 100%

#### Scenario: Conflict detection for half-day tasks
- **WHEN** 用户尝试在已有任务的时间槽创建新任务
- **THEN** 系统检测时间槽冲突（如上午已有 AM 或 FULL_DAY 任务）
- **AND** 显示警告：「该时间槽已存在任务，是否继续？（饱和度将超过 100%）」
- **AND** 允许用户确认后仍可创建（饱和度可超过 100%）

## MODIFIED Requirements

### Requirement: Task Data Import from Excel
系统 SHALL 支持从 Excel 文件导入任务数据，包括对半天任务的识别和解析。

#### Scenario: Import Excel with half-day indicators
- **WHEN** 用户上传包含时间槽列（如「AM」「PM」「全天」）的 Excel 文件
- **THEN** 系统解析时间槽列并正确映射到 `time_slot` 字段
- **AND** AM 任务工时设为 3.5h，PM 任务设为 4.5h，全天任务设为 8h
- **AND** 导入后的任务在日历中正确显示时间槽标识

#### Scenario: Import Excel without time slot column (legacy format)
- **WHEN** 用户上传不包含时间槽列的旧格式 Excel 文件
- **THEN** 系统将所有任务默认解析为「整天」任务
- **AND** 工时默认为 8 小时
- **AND** 导入成功并显示提示：「未检测到时间槽列，所有任务已标记为整天」

#### Scenario: Import validation for conflicting time slots
- **WHEN** Excel 文件中存在同一工程师同一天同一时间槽的多个任务
- **THEN** 系统在预览阶段标记为警告（而非错误）
- **AND** 显示冲突详情：「工程师 [姓名] 在 [日期] [时间槽] 存在多个任务」
- **AND** 允许用户选择导入（覆盖/追加）或取消

## REMOVED Requirements

无移除的需求。

