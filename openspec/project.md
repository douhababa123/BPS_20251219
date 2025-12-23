# Project Context

## Purpose

BPS 能力与排程平台（BPS Capacity & Scheduling Platform）是一个生产就绪的 React 应用，用于博世（Bosch）团队的能力规划、能力评估和智能任务分配管理。

**核心功能模块**：
- **Dashboard/总览**：实时 KPI 跟踪、团队能力雷达图、差距分析
- **Calendar/日历与饱和度**：上午/下午半天粒度的排程、多用户日历视图、饱和度监控
- **Matching/智能任务分配**：基于技能评分（60%权重）和时间可用性（40%权重）的智能候选人排名算法
- **Competency/能力画像**：9大模块雷达图、39项个人能力评估、差距分析和培训建议
- **Import/数据导入**：4步向导式 Excel 数据导入，包含验证和错误报告

## Tech Stack

### 前端框架与工具
- **React 18.3** - UI 框架
- **TypeScript 5.5** - 类型安全
- **Vite 5.4** - 构建工具，提供快速的开发体验

### 样式与 UI
- **TailwindCSS 3.4** - Utility-first CSS 框架
- **Lucide React 0.344** - 图标库
- **Recharts 3.4** - 数据可视化图表库

### 状态管理与表单
- **TanStack React Query 5.90** - 服务器状态管理和数据获取
- **React Hook Form 7.66** - 表单状态管理
- **Zod 4.1** - Schema 验证

### 数据与后端
- **Supabase 2.84** - PostgreSQL 数据库和 BaaS（后端即服务）
- **XLSX 0.18** - Excel 文件解析

### 开发工具
- **ESLint 9.9** - 代码检查
- **TypeScript ESLint 8.3** - TypeScript 专用 ESLint 规则
- **PostCSS & Autoprefixer** - CSS 处理

## Project Conventions

### Code Style

- **语言**：TypeScript 严格模式（`strict: true`）
- **命名约定**：
  - 组件：PascalCase（如 `CompetencyAssessment.tsx`）
  - 函数/变量：camelCase（如 `handleSubmit`, `userData`）
  - 常量：UPPER_SNAKE_CASE（在 `constants.ts` 中定义）
  - 文件：PascalCase 用于组件，camelCase 用于工具函数
- **格式化**：使用 ESLint 进行代码质量检查
- **注释**：中文注释主导，关键业务逻辑需添加详细说明

### Architecture Patterns

- **组件架构**：
  - `src/components/` - 可复用的 UI 组件（Header, Sidebar, KpiCard 等）
  - `src/pages/` - 页面级组件，对应各功能模块
  - `src/lib/` - 工具函数、类型定义、常量、数据解析器
  - `src/contexts/` - React Context（PersonaContext 用于用户身份切换）

- **状态管理**：
  - 服务器状态：TanStack React Query（异步数据获取、缓存）
  - 全局状态：React Context API（PersonaContext）
  - 本地状态：React hooks（useState, useReducer）

- **数据流**：
  - Supabase Client → React Query → Components
  - 单向数据流，组件通过 hooks 访问数据

- **设计系统**：
  - 颜色：主蓝 `#1E3A8A`，强调红 `#B91C1C`，成功绿 `#15803D`
  - 主题颜色（按主题区分）：TPM 黄色、Lean flow 红色、S-CIP 绿色等
  - 字体：Inter 或系统 sans-serif
  - 界面语言：中文主导，英文副标题
  - 仅支持浅色模式

### Testing Strategy

**当前状态**：项目尚未集成自动化测试框架。

**未来计划**（建议）：
- 单元测试：Vitest + React Testing Library
- 集成测试：针对关键业务流程（数据导入、任务匹配算法）
- E2E 测试：Playwright（可选）

**测试重点**：
- 智能匹配算法的准确性
- Excel 数据解析器的健壮性
- 能力评估计算逻辑

### Git Workflow

**当前观察**：
- 项目包含大量 `.md` 文档（实现指南、修复记录、用户指南）
- 使用 OpenSpec 提案系统进行架构变更管理

**建议工作流**：
- 主分支：`main`/`master`
- 功能分支：`feature/*`
- 修复分支：`fix/*`
- 提交信息：中英文结合，使用常规提交格式（可选）

## Domain Context

### 能力管理系统

**9大能力模块**：
1. BPS elements - BPS基础元素
2. Investment efficiency - 投资效率
3. Team Competence Elements - 团队能力要素
4. TPM (Total Productive Maintenance) - 全面生产维护
5. IE (Industrial Engineering) - 工业工程
6. LRP (Lean Realization Process) - 精益实现流程
7. Everybody's CIP - 全员持续改进
8. Leadership commitment - 领导力承诺
9. CIP in indirect area / Digital Transformation - 间接领域改进/数字化转型

**39项能力评估指标**：每个模块包含多个具体能力项，支持：
- 当前水平（Current）：1-5 分（1=Know it, 2=Do it, 3=Lead it, 4=Shape it, 5=Master）
- 目标水平（Target）：1-5 分
- 差距分析（Gap）：自动计算 = Target - Current

### 角色阈值规则

- **Lead（主导）**：关键能力项 ≥4.0 且模块平均 ≥3.5
- **Expert（专家）**：关键能力项 ≥4.5 且模块平均 ≥4.0
- **Member（成员）**：无阈值要求
- **Coach（教练）**：特殊角色

### 任务类型与位置

**任务类型**：WS, SW, P, T, C, M, L, SD  
**位置代码**：FLCNa, FLCCh, FCGNa, FCLCh, FDCCh, GPU-SU, EA, HA  
**主题领域**：TPM, Lean flow, S-CIP & PGL, Lean admin, Failure prevention, Other

### 时间粒度

- **AM（上午）**：3.5 小时
- **PM（下午）**：4.5 小时
- 日历以半天为单位进行资源规划

### 智能匹配算法

1. **技能评分（60%权重）**：
   - 对于每个所需能力项：
     - `base = min(Ci/Ri, 1)`，其中 Ci=当前水平，Ri=要求水平
     - `bonus = 0.1` 如果 Ti（目标）> Ci（有成长潜力）
     - `w = 2` 用于关键能力项，`1` 用于非关键能力项
     - `si = (base + bonus) × w`
   - 最终技能评分：`Σ(si) / Σ(w)`

2. **时间评分（40%权重）**：
   - `timeScore = freeSlots / totalSlots` 在任务期间

3. **最终评分**：`skillScore × 0.6 + timeScore × 0.4`

4. **角色门槛验证**：确保 Lead/Expert 候选人满足阈值要求

## Important Constraints

### 技术约束
- **仅前端应用**：虽然集成了 Supabase，但主要逻辑在前端
- **浏览器要求**：Chrome/Edge 90+, Firefox 88+, Safari 14+
- **Node.js 版本**：需要 18 或更高版本

### 业务约束
- **Bosch 内部使用**：专有软件，仅供博世内部使用
- **中文界面**：主要用户为中国区博世员工，界面以中文为主
- **数据安全**：能力评估数据涉及员工隐私，需遵守数据保护规定

### 设计约束
- **仅浅色模式**：遵循 Bosch 设计规范，不支持深色模式
- **无障碍性**：需保证焦点状态的可访问性
- **响应式**：需支持不同屏幕尺寸（特别是 `assessment`, `competency`, `schedule` 页面为全屏布局）

### 未实现功能（已知限制）
- 实时协作（WebSocket）
- 用户认证与授权（当前通过 PersonaContext 模拟）
- 历史数据追踪和审计
- 高级冲突解决
- 推送通知系统

## External Dependencies

### Supabase（主要后端服务）
- **用途**：PostgreSQL 数据库，REST API，实时订阅
- **表结构**：
  - `competency_definitions` - 能力定义表（9大模块，39种能力类型）
  - `competency_assessments` - 能力评估表（工程师的能力评估数据）
  - `employees` - 员工信息表
  - `calendar_slots` / `schedule_events` - 日程管理表
  - 其他资源规划相关表
- **认证**：使用 anon public key（开发环境可能禁用 RLS）
- **配置**：通过环境变量配置 `VITE_SUPABASE_URL` 和 `VITE_SUPABASE_ANON_KEY`

### Excel 文件格式
- **支持格式**：`.xlsx`, `.xls`
- **解析器**：
  - `excelParser.ts` - 通用 Excel 解析
  - `complexExcelParser.ts` - 复杂格式支持（横向/纵向）
  - `excelResourceParser.ts` / `excelResourceParser_V2.ts` - 资源数据解析
  - `skillDefinitionParser.ts` - 技能定义解析
- **模板**：应用内提供模板下载，包含字段规范

### 未来迁移计划
- **SQL Server**：文档显示有后期迁移到 SQL Server 的计划
- **PostgreSQL → SQL Server 映射**：已有数据类型转换方案

### 开发工具
- **Vite Dev Server**：默认端口 5173（可配置）
- **Supabase CLI**（可选）：用于本地开发和数据库迁移
