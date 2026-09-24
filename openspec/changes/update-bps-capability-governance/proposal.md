# Change: 更新 BPS 能力治理、年度 KPI 与任务匹配

## Why

当前总览展示的是混合运营指标，无法从年度年初能力基线持续跟踪 Level、GAP 和关闭率；能力评估仍按单元格立即保存并允许普通用户修改本人，也没有可由管理员选定的年度基线。会议同时确认了日程 `Others` 分类和任务匹配硬门槛。

## What Changes

- 用年度基线驱动的六项能力 KPI 和月度 GAP/关闭率组合趋势替换现有总览内容。
- 增加年度、统计月份和九大模块联动筛选；六项 KPI 在宽屏横向同排，以所选月份生成 YTD 标题，并与同月趋势数据严格一致。
- 增加个人筛选：可查看年度基线内单个员工或全部人员，并将相同人员范围应用于六项 KPI、月度趋势和统计单元数。
- 将能力评估改为页面草稿、原子批量保存和业务版本。
- 将能力编辑权限改为管理员全部、模块 Owner 仅本模块、普通用户只读。
- 在“管理员 → 年初基线管理”增加年度选择、Excel 模板下载、原始 `Current_Target states` 宽表自动转换、完整校验预览、待确认文件清除和明确确认生效入口，保留不可变基线明细及被替换版本；不覆盖当前评估和旧历史。
- 2026 年初基线只接受经确认的年初 Excel，不使用 2026-07-03 迁移快照替代；后续年度也支持 Excel 上传或保存版本选择。
- 在日程能力领域增加无需能力项的 `Others`。
- 将智能匹配改为时间符合度绝对优先的字典序排序；时间相同时依次比较目标精准匹配、当前精准匹配和最小超配，所有人员有冲突时仍返回时间符合度最高者。Tyler Tan 和 Tong Zhifeng 作为资源匹配专用人员按 100% 时间可用处理。
- 按已确认的 `Current_Target states` C/T 空值规则转换 2026 年初基线；Tyler Tan 和 Tong Zhifeng 不进入能力发展 KPI，Xu Qingyue / Ship to line 使用临时目标 2。
- **BREAKING**：普通用户不再能修改本人能力；总览旧指标和图表被移除；匹配排序不再使用时间/能力加权综合分，部分时间冲突不再直接淘汰。

## Impact

- Affected specs: `competency-dashboard-progress`, `competency-assessment-governance`, `schedule-task-classification`, `task-matching`
- Affected frontend: `src/pages/Admin.tsx`, `src/pages/Dashboard.tsx`, `src/pages/CompetencyAssessment.tsx`, `src/components/MatrixView.tsx`, `src/pages/Schedule.tsx`, `src/pages/Matching.tsx`
- Affected backend: competency assessment/history, dashboard analytics, matching and task validation routes
- Affected data model: additive version and annual-baseline metadata/detail tables; existing business records are not rewritten
- Supersedes: the self-edit permission and immediate per-cell save behavior in `add-competency-assessment-editing-history`
- Detailed design: `docs/superpowers/specs/2026-09-11-bps-dashboard-baseline-governance-design.md`
