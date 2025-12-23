# Implementation Tasks

## 1. 准备工作与需求确认
- [ ] 1.1 确认 Wang Ning 和 Liu Kui 的工号（employee_id）
- [ ] 1.2 确认半天时长设置（AM: 3.5h / PM: 4.5h）是否符合业务需求
- [ ] 1.3 确认通知形式（系统内通知 vs 邮件/企业微信）
- [ ] 1.4 评审提案并获得项目负责人批准

## 2. 数据库 Schema 变更
- [ ] 2.1 创建数据库迁移脚本 `migrations/add_half_day_schedule.sql`
  - [ ] 为 `tasks` 表添加 `time_slot` 字段（'AM' | 'PM' | 'FULL_DAY'，默认 'FULL_DAY'）
  - [ ] 为 `employees` 表添加 `role` 字段（'BPS_ENGINEER' | 'SITE_PS' | 'ADMIN'，默认 'BPS_ENGINEER'）
  - [ ] 创建 `schedule_change_notifications` 表
- [ ] 2.2 手动更新 Wang Ning 和 Liu Kui 的 `role` 为 'SITE_PS'
- [ ] 2.3 更新 TypeScript 类型定义 `src/lib/database.types.ts`
- [ ] 2.4 在测试环境执行迁移脚本并验证
- [ ] 2.5 在生产环境执行迁移脚本

## 3. 日程管理半天粒度实现
- [ ] 3.1 更新任务创建/编辑表单
  - [ ] 增加时间槽选择器（整天/上午/下午）
  - [ ] 根据时间槽自动计算工时（整天:8h, AM:3.5h, PM:4.5h）
- [ ] 3.2 更新日历视图组件 `src/pages/Schedule.tsx`
  - [ ] 支持半天粒度的任务显示（上下分栏或标签区分）
  - [ ] 调整任务卡片布局，显示时间槽标识
- [ ] 3.3 更新饱和度计算逻辑
  - [ ] 按半天时间槽统计资源使用情况
  - [ ] 更新饱和度图表展示
- [ ] 3.4 更新数据导入解析器 `src/lib/excelResourceParser.ts`
  - [ ] 支持从 Excel 导入半天任务
  - [ ] 兼容旧的整天任务格式

## 4. 权限管理系统实现
- [ ] 4.1 扩展身份上下文 `src/contexts/PersonaContext.tsx` → `AuthContext.tsx`
  - [ ] 增加 `currentUser` 状态（包含 id, name, role）
  - [ ] 增加 `hasPermission()` 方法判断权限
- [ ] 4.2 在 `src/lib/supabaseService.ts` 增加权限检查方法
  - [ ] `canEditSchedule(userId, targetEmployeeId)` - 判断是否可编辑目标用户日程
  - [ ] `isSitePS(userId)` - 判断是否为 Site PS 角色
- [ ] 4.3 在 Schedule 页面应用权限控制
  - [ ] 默认只显示当前用户的日程
  - [ ] Site PS 可切换查看/编辑所有工程师日程
  - [ ] 非 Site PS 用户尝试编辑他人日程时显示权限错误提示
- [ ] 4.4 在任务编辑/删除操作前增加权限验证

## 5. 通知系统实现
- [ ] 5.1 创建通知数据表 `schedule_change_notifications`
  - [ ] 字段：id, employee_id, modifier_id, task_id, change_type, change_details, is_read, created_at
- [ ] 5.2 实现通知触发逻辑
  - [ ] 在 `updateTask()` 方法中检测是否为跨用户修改
  - [ ] 如果是 Site PS 修改他人日程，插入通知记录
- [ ] 5.3 创建通知展示组件 `src/components/NotificationBell.tsx`
  - [ ] 显示未读通知数量（红点提示）
  - [ ] 通知下拉列表
  - [ ] 标记已读功能
- [ ] 5.4 在 Header 组件中集成通知组件

## 6. 能力画像模块增强 - 个人视图
- [ ] 6.1 在 `src/lib/competencyAggregation.ts` 增加计算函数
  - [ ] `calculatePersonalModuleGapTotal(employeeId, assessments)` - 计算个人各模块 GAP 总分
- [ ] 6.2 在 `src/pages/Competency.tsx` 个人视图中增加模块 GAP 汇总表
  - [ ] 表格列：模块名称、能力项数量、当前平均分、目标平均分、GAP 总分
  - [ ] 支持按 GAP 总分排序
  - [ ] 高亮 GAP 最大的前 3 个模块
- [ ] 6.3 增加数据导出功能（CSV 格式）

## 7. 能力画像模块增强 - 团队视图
- [ ] 7.1 在 `src/lib/competencyAggregation.ts` 增加计算函数
  - [ ] `calculateTeamModuleGapTotal(assessments)` - 计算团队各模块 GAP 总分
- [ ] 7.2 在 `src/pages/Competency.tsx` 团队视图中增加团队模块 GAP 汇总表
  - [ ] 表格列：模块名称、参与人数、团队 GAP 总分、平均 GAP、最大 GAP、最小 GAP
  - [ ] 支持按团队 GAP 总分排序
  - [ ] 可视化对比（柱状图）
- [ ] 7.3 增加数据导出功能（CSV 格式）

## 8. UI/UX 优化
- [ ] 8.1 为半天任务设计差异化视觉样式（AM/PM 标识图标）
- [ ] 8.2 优化日历视图在半天模式下的布局（防止过于拥挤）
- [ ] 8.3 为 Site PS 用户增加"管理员视图"切换开关
- [ ] 8.4 为权限受限操作增加友好的提示信息
- [ ] 8.5 通知消息的交互动画和样式优化

## 9. 测试
- [ ] 9.1 单元测试
  - [ ] 权限检查逻辑测试
  - [ ] GAP 汇总计算函数测试
  - [ ] 半天时长计算测试
- [ ] 9.2 集成测试
  - [ ] 日程创建/编辑/删除流程（普通用户视角）
  - [ ] 日程跨用户编辑流程（Site PS 视角）
  - [ ] 通知触发和展示流程
  - [ ] 能力画像 GAP 汇总数据准确性
- [ ] 9.3 用户验收测试
  - [ ] 邀请 Wang Ning 和 Liu Kui 测试 Site PS 权限
  - [ ] 邀请普通 BPS 工程师测试权限隔离
  - [ ] 收集 UI/UX 反馈

## 10. 文档与部署
- [ ] 10.1 更新用户手册
  - [ ] 半天任务使用指南
  - [ ] Site PS 权限说明
  - [ ] 通知查看指南
  - [ ] 新增 GAP 汇总表使用说明
- [ ] 10.2 更新数据库 Schema 文档
- [ ] 10.3 创建发布说明（Release Notes）
- [ ] 10.4 部署到测试环境
- [ ] 10.5 部署到生产环境
- [ ] 10.6 监控系统运行状态（首周重点关注）

## 依赖关系说明
- 任务 2（数据库变更）必须在所有其他开发任务之前完成
- 任务 4（权限系统）是任务 5（通知系统）的前置依赖
- 任务 3、6、7 可并行开发（分别独立）
- 任务 9（测试）依赖所有开发任务完成

## 预估工作量
- 准备与设计：0.5 天
- 后端与数据库：2 天
- 前端开发（日程管理）：3 天
- 前端开发（权限与通知）：2 天
- 前端开发（能力画像）：2 天
- 测试与修复：2 天
- 文档与部署：1 天
- **总计：约 12.5 个工作日**

