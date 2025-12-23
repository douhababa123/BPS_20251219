# Change: 增强日程管理与能力画像功能

## Why

当前系统在日程管理和能力画像模块存在以下待优化点：

1. **日程管理粒度不足**：目前任务按整天计算（8小时），无法精确管理上午/下午的半天任务，导致资源分配不够灵活
2. **权限管理缺失**：所有用户都可以修改任意工程师的日程，缺乏数据安全性和责任追溯机制
3. **能力画像数据不完整**：
   - 个人视图缺少各模块的 GAP 总分汇总，难以快速评估个人在各领域的能力差距
   - 团队视图缺少各模块的总 GAP 分数，无法横向对比团队在不同能力模块的整体差距

这些问题影响了资源规划的精确度、数据的安全性和管理决策的效率。

## What Changes

### 1. 日程管理半天粒度（Schedule Management）
- 将任务时间单位从「整天」改为「半天」（AM/PM）
- AM（上午）：3.5 小时
- PM（下午）：4.5 小时
- 日历视图支持半天粒度的任务显示和编辑
- 饱和度计算调整为基于半天时间槽的统计

### 2. 基于角色的权限管理（Role-Based Permissions）
- **默认权限**：每个 BPS 工程师只能查看和编辑自己的日程信息
- **Site PS 权限**：Wang Ning (工号待确认) 和 Liu Kui (工号待确认) 拥有修改所有 BPS 工程师日程的权限
- **通知机制**：当 Site PS 修改他人日程时，自动触发通知给被修改日程的工程师（通知内容包括：修改人、修改时间、修改内容）

### 3. 能力画像模块增强（Competency Analytics Enhancement）
- **个人视图新增**：
  - 在个人能力雷达图下方增加「模块 GAP 汇总表」
  - 显示该工程师在 9 大能力模块中每个模块的 GAP 总分（该模块所有能力项的 GAP 值之和）
  - 支持按 GAP 总分排序，快速识别重点提升领域
  
- **团队视图新增**：
  - 在团队雷达图下方增加「团队模块 GAP 汇总表」
  - 显示所有 BPS 工程师在各模块的 GAP 分数加总
  - 用于识别团队整体在哪些能力模块存在最大差距
  - 支持按总 GAP 分数排序

## Impact

### Affected Specs
- **新增能力**：
  - `schedule-management` - 日程管理（半天粒度 + 权限控制）
  - `competency-analytics` - 能力分析增强（GAP 汇总统计）

### Affected Code

#### 日程管理模块
- `src/pages/Schedule.tsx` - 日程管理页面主组件，需支持半天视图和权限判断
- `src/lib/supabaseService.ts` - 数据服务层，需增加权限检查方法
- `src/contexts/PersonaContext.tsx` - 可能需要扩展为 AuthContext，存储当前用户身份和权限
- 数据库表 `tasks` - 需增加 `time_slot` 字段（'AM' | 'PM' | 'FULL_DAY'）
- 数据库表 `employees` - 需增加 `role` 字段（'BPS_ENGINEER' | 'SITE_PS' | 'ADMIN'）
- 数据库新增 `schedule_change_notifications` 表 - 存储日程变更通知

#### 能力画像模块
- `src/pages/Competency.tsx` - 能力画像页面，需增加 GAP 汇总表组件
- `src/pages/CompetencyAssessment.tsx` - 能力评估页面，可能需要同步展示 GAP 汇总
- `src/lib/competencyAggregation.ts` - 能力聚合计算库，需增加模块 GAP 汇总计算函数

### Breaking Changes
- **数据库 Schema 变更**：
  - `tasks` 表增加 `time_slot` 字段（可为空，兼容旧数据）
  - `employees` 表增加 `role` 字段（默认值 'BPS_ENGINEER'）
  - 需要数据迁移脚本

### Non-Breaking Enhancements
- 能力画像的 GAP 汇总功能为纯新增，不影响现有功能
- 权限系统向后兼容，默认保持现有访问模式

## Migration & Rollback

### 数据迁移
1. 为 `tasks` 表添加 `time_slot` 字段，默认值为 'FULL_DAY'
2. 为 `employees` 表添加 `role` 字段，默认值为 'BPS_ENGINEER'
3. 手动标记 Wang Ning 和 Liu Kui 的 `role` 为 'SITE_PS'
4. 创建 `schedule_change_notifications` 表

### 回滚方案
- 如需回滚，可暂时禁用权限检查逻辑（添加 feature flag）
- 半天任务可临时按整天显示
- GAP 汇总功能可通过 UI 开关隐藏

## Risks & Mitigation

### 风险1：用户工号未确认
- **影响**：无法准确配置 Site PS 权限
- **缓解**：在实施前需确认 Wang Ning 和 Liu Kui 的准确工号（employee_id）

### 风险2：半天粒度可能增加 UI 复杂度
- **影响**：日历视图可能过于拥挤
- **缓解**：采用折叠/展开设计，默认按天显示，点击展开显示半天详情

### 风险3：通知系统需要额外的通知渠道
- **影响**：当前系统没有邮件或消息推送功能
- **缓解**：第一阶段仅在系统内显示通知（红点提示），后续可集成邮件/企业微信

## Open Questions

1. **Wang Ning 和 Liu Kui 的准确工号是什么？**
2. **通知形式**：系统内通知是否足够？是否需要邮件或企业微信集成？
3. **半天任务的默认时长**：AM 3.5h / PM 4.5h 是否符合实际工作习惯？
4. **历史数据处理**：现有整天任务是否需要手动拆分为半天任务？
5. **权限粒度**：是否需要更细粒度的权限（如部门主管可以管理本部门工程师）？

