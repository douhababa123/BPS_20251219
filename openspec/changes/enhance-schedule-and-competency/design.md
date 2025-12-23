# Technical Design: 日程管理与能力画像增强

## Context

当前 BPS 能力与排程平台缺乏精细化的日程管理（仅支持整天）、缺少权限控制机制，且能力画像模块的数据聚合不够完整。本次变更旨在通过引入半天粒度、基于角色的权限管理和增强的 GAP 分析，提升系统的实用性和数据安全性。

**关键约束**：
- 需兼容现有数据（历史任务数据）
- 不能破坏现有的日程导入功能
- 性能影响最小化（GAP 计算可能涉及大量数据聚合）
- 用户体验流畅（权限校验不能造成明显延迟）

**涉及的系统模块**：
- 数据库 Schema（Supabase PostgreSQL）
- 日程管理前端（Schedule.tsx）
- 能力画像前端（Competency.tsx）
- 身份与权限系统（新增 AuthContext）
- 通知系统（新增）

## Goals / Non-Goals

### Goals
1. ✅ 支持半天（AM/PM）粒度的日程管理
2. ✅ 实现基于角色的权限控制（BPS_ENGINEER 仅可编辑自己，SITE_PS 可编辑所有人）
3. ✅ Site PS 修改他人日程时触发通知
4. ✅ 能力画像个人视图增加各模块 GAP 总分
5. ✅ 能力画像团队视图增加团队各模块 GAP 总分
6. ✅ 向后兼容现有整天任务数据

### Non-Goals
- ❌ 更复杂的权限体系（如部门主管权限）- 可作为未来扩展
- ❌ 邮件/企业微信推送通知 - 第一阶段仅系统内通知
- ❌ 自动任务分配优化算法 - 保持现有智能匹配逻辑
- ❌ 历史数据的自动拆分（整天→半天）- 保持原样，仅标记为 FULL_DAY

## Decisions

### Decision 1: 半天粒度数据模型

**选择方案**：在 `tasks` 表增加 `time_slot` 枚举字段

```sql
-- 方案A：增加 time_slot 字段（选中）
ALTER TABLE tasks ADD COLUMN time_slot TEXT DEFAULT 'FULL_DAY' 
  CHECK (time_slot IN ('AM', 'PM', 'FULL_DAY'));
```

**替代方案**：
- **方案B**：拆分任务为 `tasks_am` 和 `tasks_pm` 两张表
  - ❌ 缺点：数据冗余，查询复杂，迁移成本高
- **方案C**：使用 `start_time` 和 `end_time` 精确到小时
  - ❌ 缺点：过于精细，业务需求仅需要半天粒度，增加 UI 复杂度

**理由**：
- 方案A最简洁，通过单个字段即可表达时间粒度
- 兼容性好：现有任务默认为 `FULL_DAY`，不影响现有功能
- 查询效率高：单表查询，索引友好

### Decision 2: 权限控制架构

**选择方案**：基于角色（Role）+ 前后端双重校验

**架构设计**：
```
用户身份 (AuthContext)
    ↓
前端权限判断 (UI 可见性控制)
    ↓
后端权限校验 (Supabase RLS 或 Service Layer)
    ↓
数据操作 (CRUD)
```

**角色定义**：
- `BPS_ENGINEER`：默认角色，仅可查看/编辑自己的日程
- `SITE_PS`：Site PS 角色，可查看/编辑所有 BPS 工程师的日程
- `ADMIN`：系统管理员（预留，暂不实现）

**实现方式**：
1. **数据层**：在 `employees` 表增加 `role` 字段
2. **服务层**：在 `supabaseService.ts` 增加权限检查方法
3. **前端层**：AuthContext 提供 `hasPermission()` 方法
4. **UI 层**：根据权限动态显示/隐藏编辑按钮

**替代方案**：
- **方案B**：纯前端权限控制
  - ❌ 缺点：安全性差，可被绕过
- **方案C**：Supabase RLS（Row Level Security）
  - ⚠️ 优点：数据库级别安全
  - ⚠️ 缺点：调试复杂，灵活性较差
  - 💡 未来可迁移到 RLS 增强安全性

### Decision 3: 通知系统设计

**选择方案**：数据库表 + 前端轮询（简易版）

**数据模型**：
```sql
CREATE TABLE schedule_change_notifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id UUID REFERENCES employees(id) NOT NULL,  -- 接收通知的工程师
  modifier_id UUID REFERENCES employees(id) NOT NULL,  -- 修改人（Site PS）
  task_id UUID REFERENCES tasks(id) ON DELETE CASCADE,
  change_type TEXT NOT NULL,  -- 'CREATE' | 'UPDATE' | 'DELETE'
  change_details JSONB,  -- 修改详情（旧值→新值）
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_notifications_employee_unread 
  ON schedule_change_notifications(employee_id, is_read);
```

**通知流程**：
```
Site PS 修改任务
    ↓
检测 modifier_id ≠ employee_id
    ↓
插入通知记录
    ↓
前端轮询查询未读通知（每 30 秒）
    ↓
显示红点提示
    ↓
用户点击查看
    ↓
标记为已读
```

**替代方案**：
- **方案B**：实时推送（WebSocket / Supabase Realtime）
  - ⚠️ 优点：实时性强
  - ❌ 缺点：增加系统复杂度，Supabase Realtime 有配额限制
  - 💡 未来可升级为实时推送
  
- **方案C**：邮件通知
  - ❌ 缺点：需集成邮件服务（SendGrid/阿里云邮件），增加成本和复杂度

**理由**：轮询方案简单可靠，适合第一阶段快速上线，后续可无缝升级为实时推送。

### Decision 4: GAP 汇总计算策略

**选择方案**：前端实时计算（基于已加载的 assessments 数据）

**计算逻辑**：

```typescript
// 个人模块 GAP 总分
function calculatePersonalModuleGapTotal(
  employeeId: string, 
  assessments: Assessment[]
): ModuleGapSummary[] {
  const filtered = assessments.filter(a => a.employee_id === employeeId);
  const grouped = groupBy(filtered, 'module_id');
  
  return Object.entries(grouped).map(([moduleId, items]) => ({
    moduleId: Number(moduleId),
    moduleName: items[0].module_name,
    itemCount: items.length,
    totalGap: sum(items, 'gap'),
    avgCurrent: mean(items, 'current_level'),
    avgTarget: mean(items, 'target_level'),
  }));
}

// 团队模块 GAP 总分
function calculateTeamModuleGapTotal(
  assessments: Assessment[]
): TeamModuleGapSummary[] {
  const grouped = groupBy(assessments, 'module_id');
  
  return Object.entries(grouped).map(([moduleId, items]) => ({
    moduleId: Number(moduleId),
    moduleName: items[0].module_name,
    participantCount: new Set(items.map(i => i.employee_id)).size,
    totalGap: sum(items, 'gap'),
    avgGap: mean(items, 'gap'),
    maxGap: max(items, 'gap'),
    minGap: min(items, 'gap'),
  }));
}
```

**替代方案**：
- **方案B**：后端预计算（数据库视图或定时任务）
  - ⚠️ 优点：前端性能更好
  - ❌ 缺点：实时性差，增加数据库复杂度
  
**理由**：
- 当前 assessments 数据量不大（假设 50 人 × 39 项 = 1950 条），前端计算性能足够
- 实时性好，用户筛选/切换视图时立即更新
- 简化架构，无需额外的后端计算任务

## Data Model Changes

### 新增字段

```sql
-- tasks 表增加半天粒度字段
ALTER TABLE tasks 
ADD COLUMN time_slot TEXT DEFAULT 'FULL_DAY' 
CHECK (time_slot IN ('AM', 'PM', 'FULL_DAY'));

-- employees 表增加角色字段
ALTER TABLE employees 
ADD COLUMN role TEXT DEFAULT 'BPS_ENGINEER' 
CHECK (role IN ('BPS_ENGINEER', 'SITE_PS', 'ADMIN'));

-- 为 Site PS 用户设置角色（需替换为实际 ID）
UPDATE employees SET role = 'SITE_PS' 
WHERE employee_code IN ('WANG_NING_CODE', 'LIU_KUI_CODE');
```

### 新增表

```sql
-- 日程变更通知表
CREATE TABLE schedule_change_notifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id UUID REFERENCES employees(id) NOT NULL,
  modifier_id UUID REFERENCES employees(id) NOT NULL,
  task_id UUID REFERENCES tasks(id) ON DELETE CASCADE,
  change_type TEXT NOT NULL CHECK (change_type IN ('CREATE', 'UPDATE', 'DELETE')),
  change_details JSONB,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_notifications_employee_unread 
  ON schedule_change_notifications(employee_id) 
  WHERE is_read = false;

CREATE INDEX idx_notifications_created_at 
  ON schedule_change_notifications(created_at DESC);
```

### TypeScript 类型定义

```typescript
// src/lib/database.types.ts 新增

export type TimeSlot = 'AM' | 'PM' | 'FULL_DAY';

export type EmployeeRole = 'BPS_ENGINEER' | 'SITE_PS' | 'ADMIN';

export interface TaskWithTimeSlot extends Task {
  time_slot: TimeSlot;
}

export interface EmployeeWithRole extends Employee {
  role: EmployeeRole;
}

export interface ScheduleChangeNotification {
  id: string;
  employee_id: string;
  modifier_id: string;
  task_id: string;
  change_type: 'CREATE' | 'UPDATE' | 'DELETE';
  change_details: Record<string, any>;
  is_read: boolean;
  created_at: string;
}

export interface ModuleGapSummary {
  moduleId: number;
  moduleName: string;
  itemCount: number;
  totalGap: number;
  avgCurrent: number;
  avgTarget: number;
}

export interface TeamModuleGapSummary {
  moduleId: number;
  moduleName: string;
  participantCount: number;
  totalGap: number;
  avgGap: number;
  maxGap: number;
  minGap: number;
}
```

## Risks / Trade-offs

### Risk 1: 前端权限校验可被绕过
**影响**：恶意用户可通过修改前端代码绕过 UI 权限检查

**缓解方案**：
1. 在 `supabaseService` 方法中增加后端校验（检查当前用户角色）
2. 未来可迁移到 Supabase RLS 提供数据库级别安全
3. 增加操作日志审计（记录所有修改操作）

### Risk 2: 半天任务可能导致 UI 过于拥挤
**影响**：日历视图在半天模式下可能显示过多任务卡片

**缓解方案**：
1. 默认按天折叠显示，点击展开显示半天详情
2. 增加「紧凑模式」开关，允许用户切换显示密度
3. 使用颜色编码（AM 浅色，PM 深色）快速区分

### Risk 3: 通知轮询增加服务器负载
**影响**：每个在线用户每 30 秒查询一次未读通知

**缓解方案**：
1. 使用索引优化查询（`idx_notifications_employee_unread`）
2. 仅在用户活跃时轮询（检测窗口焦点状态）
3. 未来可升级为 Supabase Realtime 订阅

### Risk 4: GAP 计算在大数据量下性能问题
**影响**：如果 assessments 数量级增长（如 500 人 × 100 项），前端计算可能卡顿

**缓解方案**：
1. 当前数据量可控，暂无问题
2. 使用 `useMemo` 缓存计算结果，避免重复计算
3. 如未来数据量增长，可迁移到后端预计算（数据库 Materialized View）

## Migration Plan

### Phase 1: 数据库迁移（生产环境维护窗口）
1. 备份生产数据库
2. 执行 Schema 变更脚本
3. 验证数据完整性
4. 回滚方案：DROP COLUMN（如需回滚）

### Phase 2: 灰度发布（1-2天）
1. 部署到测试环境，邀请 5-10 名用户测试
2. 收集反馈，修复明显 Bug
3. 部署到生产环境，启用 Feature Flag（默认关闭新功能）

### Phase 3: 全量发布
1. 开启半天粒度功能（全体用户）
2. 开启权限控制（全体用户）
3. 开启 GAP 汇总功能（全体用户）
4. 监控系统性能和错误率

### 回滚方案
- **Level 1**（快速回滚）：通过 Feature Flag 关闭新功能
- **Level 2**（数据回滚）：恢复数据库备份，重新部署旧版本代码

## Open Questions

1. ✅ **已解决**：半天时长设定为 AM:3.5h / PM:4.5h（需业务确认）
2. ❓ **待确认**：Wang Ning 和 Liu Kui 的准确工号
3. ❓ **待讨论**：是否需要通知历史记录的保留期限（如 30 天后自动清理）
4. ❓ **待讨论**：Site PS 修改日程时，是否需要填写修改原因（记录在 change_details 中）
5. ❓ **待讨论**：是否需要「批量操作」权限（如 Site PS 一次性修改多人日程）

## Performance Considerations

### 预期性能指标
- 日程页面加载时间：< 1.5 秒（50 人 × 30 天 = 1500 条任务记录）
- GAP 汇总计算时间：< 200ms（50 人 × 39 项 = 1950 条评估记录）
- 通知查询时间：< 100ms（单用户未读通知 < 100 条）
- 权限校验时间：< 50ms（内存中判断，无需额外查询）

### 优化策略
- 使用 React Query 缓存，减少重复请求
- 对 GAP 计算使用 `useMemo` 记忆化
- 数据库查询使用复合索引

## Security Considerations

1. **SQL 注入防护**：使用 Supabase 参数化查询
2. **XSS 防护**：React 默认转义，通知内容存储为 JSON 避免 HTML 注入
3. **CSRF 防护**：Supabase 自带 Token 验证
4. **数据隔离**：权限系统确保用户只能访问授权数据
5. **审计日志**（可选）：记录敏感操作（Site PS 修改他人日程）

## Testing Strategy

### 单元测试
- `hasPermission()` 权限判断逻辑
- `calculatePersonalModuleGapTotal()` 计算准确性
- `calculateTeamModuleGapTotal()` 计算准确性
- 半天工时计算逻辑

### 集成测试
- 日程 CRUD 操作（普通用户 + Site PS）
- 通知触发和查询
- 权限拦截（普通用户尝试编辑他人日程）

### E2E 测试场景
1. 普通用户登录 → 查看自己的日程 → 创建半天任务 → 编辑 → 删除
2. Site PS 登录 → 查看所有人日程 → 修改他人任务 → 验证通知触发
3. 普通用户收到通知 → 查看通知详情 → 标记已读
4. 能力画像 → 切换个人视图 → 验证模块 GAP 汇总显示正确
5. 能力画像 → 切换团队视图 → 验证团队 GAP 汇总显示正确

