# Spec: Competency Analytics (能力分析增强)

## ADDED Requirements

### Requirement: Personal Module GAP Summary
系统 SHALL 在个人视图中显示该工程师在各能力模块的 GAP 总分汇总，帮助快速识别个人能力提升重点领域。

#### Scenario: Display personal module GAP summary table
- **WHEN** 用户在能力画像页面选择个人视图并选择特定工程师
- **THEN** 系统在个人雷达图下方显示「模块 GAP 汇总表」
- **AND** 表格列包含：模块名称、能力项数量、当前平均分、目标平均分、GAP 总分
- **AND** 表格显示该工程师在所有 9 大能力模块的数据

#### Scenario: Calculate personal module GAP total correctly
- **WHEN** 系统计算某工程师在某模块的 GAP 总分
- **THEN** GAP 总分 = 该模块下所有能力项的 GAP 值之和
- **AND** 其中 GAP = 目标水平（target_level）- 当前水平（current_level）
- **AND** 如果该工程师在某模块下没有评估数据，显示「--」或 0

#### Scenario: Sort personal modules by GAP total
- **WHEN** 用户点击「GAP 总分」列标题
- **THEN** 系统按 GAP 总分降序排列模块（GAP 最大的在最上方）
- **AND** 再次点击时切换为升序排列
- **AND** 排序状态通过箭头图标指示

#### Scenario: Highlight top 3 GAP modules
- **WHEN** 个人模块 GAP 汇总表显示时
- **THEN** 系统高亮 GAP 总分最大的前 3 个模块（如橙色或红色背景）
- **AND** 这些模块被标识为「重点提升领域」
- **AND** 用户可点击模块名称跳转到详细能力项列表

#### Scenario: Display module statistics
- **WHEN** 用户查看个人模块 GAP 汇总表
- **THEN** 每个模块显示能力项数量（如「5 项能力」）
- **AND** 显示当前平均分（如「3.2 分」，保留一位小数）
- **AND** 显示目标平均分（如「4.0 分」）
- **AND** 显示 GAP 总分（如「4.0 分」，整数或一位小数）

#### Scenario: Export personal module GAP summary to CSV
- **WHEN** 用户在个人视图中点击「导出」按钮
- **THEN** 系统生成包含模块 GAP 汇总数据的 CSV 文件
- **AND** CSV 列包含：工程师姓名、模块名称、能力项数量、当前平均分、目标平均分、GAP 总分
- **AND** 文件名格式为：`个人能力GAP汇总_[工程师姓名]_[日期].csv`

### Requirement: Team Module GAP Summary
系统 SHALL 在团队视图中显示所有 BPS 工程师在各能力模块的团队 GAP 总分汇总，用于识别团队整体能力短板。

#### Scenario: Display team module GAP summary table
- **WHEN** 用户在能力画像页面选择团队视图
- **THEN** 系统在团队雷达图下方显示「团队模块 GAP 汇总表」
- **AND** 表格列包含：模块名称、参与人数、团队 GAP 总分、平均 GAP、最大 GAP、最小 GAP
- **AND** 表格显示所有 9 大能力模块的团队汇总数据

#### Scenario: Calculate team module GAP total correctly
- **WHEN** 系统计算某模块的团队 GAP 总分
- **THEN** 团队 GAP 总分 = 所有 BPS 工程师在该模块下所有能力项的 GAP 值之和
- **AND** 参与人数 = 在该模块下有评估数据的工程师去重计数
- **AND** 平均 GAP = 团队 GAP 总分 / 该模块下的总评估记录数
- **AND** 最大 GAP = 该模块下所有评估记录中的最大 GAP 值
- **AND** 最小 GAP = 该模块下所有评估记录中的最小 GAP 值（通常为 0）

#### Scenario: Sort team modules by total GAP
- **WHEN** 用户点击「团队 GAP 总分」列标题
- **THEN** 系统按团队 GAP 总分降序排列模块
- **AND** 再次点击时切换为升序排列
- **AND** 排序状态通过箭头图标指示

#### Scenario: Visualize team module GAP with bar chart
- **WHEN** 用户查看团队模块 GAP 汇总
- **THEN** 系统在表格上方显示柱状图
- **AND** X 轴为 9 大能力模块名称
- **AND** Y 轴为团队 GAP 总分
- **AND** 柱状图按 GAP 总分从高到低排列
- **AND** 鼠标悬停时显示详细数据（参与人数、平均 GAP 等）

#### Scenario: Identify team capability gaps
- **WHEN** 系统显示团队模块 GAP 汇总时
- **THEN** 团队 GAP 总分最高的模块标记为「团队薄弱环节」（红色或橙色）
- **AND** 管理者可快速识别需要团队整体培训的能力领域
- **AND** 点击模块名称可展开该模块下各能力项的详细 GAP 分布

#### Scenario: Filter team GAP by department
- **WHEN** 用户在团队视图中选择特定部门筛选
- **THEN** 系统仅统计该部门工程师的 GAP 数据
- **AND** 团队 GAP 汇总表和图表动态更新
- **AND** 显示当前筛选条件（如「当前显示：质量部门」）

#### Scenario: Export team module GAP summary to CSV
- **WHEN** 用户在团队视图中点击「导出」按钮
- **THEN** 系统生成包含团队模块 GAP 汇总数据的 CSV 文件
- **AND** CSV 列包含：模块名称、参与人数、团队 GAP 总分、平均 GAP、最大 GAP、最小 GAP
- **AND** 文件名格式为：`团队能力GAP汇总_[筛选条件]_[日期].csv`

### Requirement: Module GAP Trend Analysis (Future Enhancement)
系统 SHALL 支持多年度模块 GAP 趋势分析，帮助评估团队能力建设进展。

**注意**：此需求为未来增强功能，第一阶段可不实现，但需保留数据结构的扩展性。

#### Scenario: View historical module GAP trends
- **WHEN** 用户在团队视图中选择「趋势分析」模式
- **THEN** 系统显示过去 3 年（如 2023-2025）各模块的团队 GAP 总分变化曲线
- **AND** X 轴为年份，Y 轴为团队 GAP 总分
- **AND** 每个模块用不同颜色的折线表示
- **AND** 用户可查看 GAP 是否逐年缩小（能力提升）

#### Scenario: Identify improving vs declining modules
- **WHEN** 系统显示 GAP 趋势图时
- **THEN** GAP 逐年减少的模块标记为「持续改善」（绿色）
- **AND** GAP 逐年增加的模块标记为「需要关注」（红色）
- **AND** 显示改善最快的前 3 个模块和最需关注的前 3 个模块

## MODIFIED Requirements

### Requirement: Competency Module Radar Chart
系统 SHALL 在个人视图和团队视图中显示能力模块雷达图，且支持 GAP 汇总数据的联动交互。

#### Scenario: Click radar chart area to view module details
- **WHEN** 用户在个人或团队视图中点击雷达图中的某个模块区域
- **THEN** 系统自动滚动到下方的模块 GAP 汇总表
- **AND** 高亮显示该模块的行
- **AND** 展开该模块的详细能力项列表（如果支持展开）

#### Scenario: Hover radar chart to show GAP summary
- **WHEN** 用户鼠标悬停在雷达图的某个模块标签上
- **THEN** 系统在 Tooltip 中显示该模块的 GAP 汇总信息
- **AND** Tooltip 包含：模块名称、当前平均分、目标平均分、GAP 总分
- **AND** 团队视图的 Tooltip 还包含参与人数

#### Scenario: Synchronize radar chart with GAP table filter
- **WHEN** 用户在模块 GAP 汇总表中应用筛选（如只显示 GAP >= 5 的模块）
- **THEN** 雷达图仅显示符合筛选条件的模块
- **AND** 不符合条件的模块在雷达图中置灰或隐藏
- **AND** 筛选条件可一键重置

## REMOVED Requirements

无移除的需求。

