# 前端测试指南（Vitest）

> 面向初学者的完整说明 —— 测什么、为什么测、怎么运行

---

## 目录

1. [什么是前端测试？为什么要做？](#1-什么是前端测试为什么要做)
2. [我们用到了哪些工具？](#2-我们用到了哪些工具)
3. [测试文件在哪里？](#3-测试文件在哪里)
4. [如何运行测试](#4-如何运行测试)
5. [测试详解：每个文件在测什么？](#5-测试详解每个文件在测什么)
   - 5.1 [utils.test.ts — CSS 样式合并工具](#51-utilstestts--css-样式合并工具)
   - 5.2 [competencyAggregation.test.ts — 能力数据计算](#52-competencyaggregationtestts--能力数据计算)
   - 5.3 [taskTypeConfig.test.ts — 任务类型配置](#53-tasktypeconfigtestts--任务类型配置)
   - 5.4 [TimeSlotSelector.test.tsx — 时间槽组件](#54-timeslotselectortesttsx--时间槽组件)
   - 5.5 [TaskCard.test.tsx — 任务卡片组件](#55-taskcardtesttsx--任务卡片组件)
6. [测试的基本写法：三行读懂一个测试](#6-测试的基本写法三行读懂一个测试)
7. [常见断言速查](#7-常见断言速查)
8. [测试统计总览](#8-测试统计总览)

---

## 1. 什么是前端测试？为什么要做？

### 用生活中的例子理解

想象你造了一台**洗衣机**。每次改进它之后（加了新功能、修了一个问题），你都需要重新检查：
- 洗衣机还能正常启动吗？
- 水还能正常进出吗？
- 甩干功能有没有被改坏？

手动一个个检查很麻烦，而且容易漏掉。**自动化测试**就是帮你写好一张"检查清单"，每次改动后，按一个按钮，程序自动帮你把所有项目都验一遍，1 秒钟内告诉你有没有出问题。

### 在这个项目里

BPS 能力评估平台的核心逻辑包括：
- 计算员工的能力得分和 Gap（差距）
- 根据任务类型显示不同颜色和图标
- 点击"上午/下午/全天"切换时间槽

这些逻辑**一旦算错，用户看到的数据就是错的**。测试保证我们在增加新功能或修 Bug 时，不会把原来正确的东西改坏。

> **一句话总结**：测试 = 程序自动帮你检查代码有没有写对，省时、省力、避免上线出事故。

---

## 2. 我们用到了哪些工具？

### 核心工具对比表

| 工具 | 类比 | 作用 |
|---|---|---|
| **Vitest** | 考试官 | 运行所有测试、统计通过/失败 |
| **@testing-library/react** | 浏览器替身 | 把 React 组件渲染到虚拟页面上 |
| **@testing-library/user-event** | 机器人用户 | 模拟真实用户的点击、输入行为 |
| **@testing-library/jest-dom** | 额外判断题库 | 提供 `toBeInTheDocument()` 等专属 DOM 断言 |
| **jsdom** | 假浏览器 | 提供 `document`/`window` 环境（Node.js 里没有浏览器） |

### 安装了什么？（package.json 新增）

```jsonc
"devDependencies": {
  "vitest": "^3.x",              // 测试运行器
  "@vitest/coverage-v8": "^3.x", // 代码覆盖率统计
  "@testing-library/react": "^x",// React 渲染工具
  "@testing-library/jest-dom": "^x",   // DOM 断言扩展
  "@testing-library/user-event": "^x", // 真实用户行为模拟
  "jsdom": "^x"                  // 虚拟浏览器环境
}
```

### 新增的配置文件

**`vitest.config.ts`** — 告诉 Vitest 怎么工作：
```typescript
test: {
  globals: true,          // 可以直接用 describe/it/expect，不用每次 import
  environment: 'jsdom',   // 使用虚拟浏览器，这样可以测 React 组件
  setupFiles: ['./src/test/setup.ts'],  // 每个测试前先执行这个文件
}
```

**`src/test/setup.ts`** — 测试前的准备工作：
```typescript
import '@testing-library/jest-dom'; 
// 引入后才能用 .toBeInTheDocument() 等 DOM 专属断言
```

---

## 3. 测试文件在哪里？

```
src/
├── lib/
│   └── __tests__/                   ← 工具函数测试
│       ├── utils.test.ts
│       ├── competencyAggregation.test.ts
│       └── taskTypeConfig.test.ts
├── components/
│   └── __tests__/                   ← UI 组件测试
│       ├── TimeSlotSelector.test.tsx
│       └── TaskCard.test.tsx
└── test/
    └── setup.ts                     ← 全局测试初始化
```

> **命名规则**：测试文件统一用 `.test.ts` 或 `.test.tsx` 结尾，放在被测文件旁边的 `__tests__/` 文件夹里，方便找到对应关系。

---

## 4. 如何运行测试

打开终端，在项目根目录执行：

```powershell
# 方式 1：运行一次，看结果（最常用）
npm run test

# 方式 2：监听模式 —— 改了代码自动重跑（开发时用）
npm run test:watch

# 方式 3：生成覆盖率报告（看哪些代码没被测到）
npm run test:coverage
```

### 期望看到的输出

```
 ✓ src/lib/__tests__/utils.test.ts                  (6 tests)
 ✓ src/lib/__tests__/competencyAggregation.test.ts  (29 tests)
 ✓ src/lib/__tests__/taskTypeConfig.test.ts          (8 tests)
 ✓ src/components/__tests__/TaskCard.test.tsx        (20 tests)
 ✓ src/components/__tests__/TimeSlotSelector.test.tsx (9 tests)

 Test Files  5 passed (5)
      Tests  72 passed (72)
```

绿色 ✓ = 通过，红色 ✗ = 失败，出现红色要立刻排查是代码写错了还是测试写错了。

---

## 5. 测试详解：每个文件在测什么？

---

### 5.1 `utils.test.ts` — CSS 样式合并工具

**对应源文件**：[src/lib/utils.ts](src/lib/utils.ts)

**测试的函数**：`cn(...classes)`

#### 这个函数是干什么的？

项目里的 UI 组件需要根据状态动态拼接 CSS 类名，比如：
```typescript
cn('p-2', 'p-4')           // → 'p-4'（Tailwind 冲突，保留后者）
cn('btn', isActive && 'active')  // → 'btn active' 或 'btn'
```

`cn` 是 `clsx` + `tailwind-merge` 的组合：先用 clsx 处理条件，再用 tailwind-merge 解决 Tailwind 类名冲突。

#### 测试了哪 6 个场景？

| # | 测试用例 | 输入 | 期望输出 | 测试目的 |
|---|---|---|---|---|
| 1 | 合并多个字符串 | `'foo', 'bar'` | `'foo bar'` | 基本功能正常 |
| 2 | 过滤 falsy 值 | `'foo', false, undefined, null, 'bar'` | `'foo bar'` | 条件渲染不会产生多余空格 |
| 3 | 处理条件对象 | `'base', { active: true, disabled: false }` | `'base active'` | 对象语法正确工作 |
| 4 | Tailwind 冲突 | `'p-2', 'p-4'` | `'p-4'` | 后面的 class 覆盖前面的 |
| 5 | 无参数 | `()` | `''` | 边界情况不崩溃 |
| 6 | 数组参数 | `['foo', 'bar'], 'baz'` | `'foo bar baz'` | 支持数组语法 |

---

### 5.2 `competencyAggregation.test.ts` — 能力数据计算

**对应源文件**：[src/lib/competencyAggregation.ts](src/lib/competencyAggregation.ts)

**这是最核心的测试文件，共 29 个测试用例。**

#### 这些函数是干什么的？

从数据库取回原始评估数据后，需要做**统计聚合**，才能在界面上显示：
- 每个能力模块的平均分、总 Gap
- 哪些技能缺口最大
- 某个员工的个人能力雷达图数据

#### 测试用的假数据（Mock Data / Fixtures）

测试不能真的连接数据库，所以我们手动写了"假数据"：

```typescript
// 假技能列表（3 个技能，分属 2 个模块）
const mockSkills = [
  { id: 1, module_id: 1, skill_name: 'Skill A', ... },
  { id: 2, module_id: 1, skill_name: 'Skill B', ... },
  { id: 3, module_id: 2, skill_name: 'Skill C', ... },
];

// 假评估数据（2 名员工，4 条记录）
const mockAssessments = [
  { employee_id: 'emp-1', skill_id: 1, current_level: 2, target_level: 4, gap: 2 },
  { employee_id: 'emp-1', skill_id: 2, current_level: 3, target_level: 4, gap: 1 },
  { employee_id: 'emp-2', skill_id: 1, current_level: 4, target_level: 4, gap: 0 },
  { employee_id: 'emp-2', skill_id: 3, current_level: 1, target_level: 3, gap: 2 },
];
```

#### 测试了哪些函数？

##### `MODULE_MAPPING` 常量（3 个测试）

| 测试用例 | 目的 |
|---|---|
| 包含 9 个模块 | 防止有人不小心删掉了某个模块 |
| 模块 ID 从 1 到 9 连续 | 防止 ID 跳号导致计算错误 |
| 每个模块有完整字段 | 防止 UI 渲染时因缺字段而崩溃 |

##### `calculateTeamModuleStats`（5 个测试）

这个函数计算**整个团队按模块维度的统计数据**（用于雷达图、模块排行）。

| 测试用例 | 测的是什么 | 为什么重要 |
|---|---|---|
| 始终返回 9 个模块 | 即使某模块没数据也要显示 | UI 雷达图需要固定 9 个顶点 |
| 模块 1 的 totalGap = 3 | 2+1+0 = 3，算法正确 | Gap 算错了，排期决策就错了 |
| 无数据模块 employeeCount=0 | 零值模块不乱填数 | 防止 0 除以 0 出现 NaN |
| 空数据返回全零 | 边界情况不崩溃 | 新系统启动时还没有数据 |
| avgCurrent 正确 | (2+3+4)/3 = 3.0 | 平均分计算准确性 |

##### `calculateTeamSkillStats`（4 个测试）

这个函数计算**每个技能的统计数据**（用于技能 Gap 排行榜）。

| 测试用例 | 测的是什么 |
|---|---|
| 返回有数据的技能数量 | 只返回有记录的技能，不返回幽灵数据 |
| 按 totalGap 降序排列 | Gap 最大的技能排在最前，帮助管理者快速决策 |
| skill 1 统计正确 | 多员工数据聚合计算准确 |
| 空数据返回空数组 | 边界情况 |

##### `calculatePersonalModuleStats`（4 个测试）

这个函数计算**某个员工的个人模块统计**（用于个人能力雷达图）。

| 测试用例 | 测的是什么 |
|---|---|
| 始终返回 9 个模块 | 雷达图固定 9 个维度 |
| emp-1 模块 1 数据正确 | current=(2+3)/2=2.5，target=4.0 |
| 无数据模块均为 0 | 该员工没评估的模块显示为 0 而不是报错 |
| 不存在员工返回全零 | 防止页面崩溃 |

##### `calculatePersonalSkillStats`（3 个测试）

这个函数计算**某个员工的所有技能数据**（用于个人详情页列表）。

##### `formatNumber`（6 个测试）

格式化数字为指定小数位的字符串，防止界面显示 `NaN` 或 `undefined`。

| 输入 | 期望输出 | 原因 |
|---|---|---|
| `3.14159` | `'3.1'` | 默认 1 位小数 |
| `undefined` | `'0'` | 后端没返回数据时显示 0 |
| `null` | `'0'` | 同上 |
| `NaN` | `'0'` | 除以 0 产生的 NaN 不能显示到界面 |

##### `getRankIcon`（4 个测试）

返回排名对应的 emoji 图标：1→🥇，2→🥈，3→🥉，其他→数字字符串。

---

### 5.3 `taskTypeConfig.test.ts` — 任务类型配置

**对应源文件**：[src/lib/taskTypeConfig.ts](src/lib/taskTypeConfig.ts)

**测试了哪些内容（8 个测试）？**

#### `TASK_TYPE_CONFIG` 常量（2 个测试）

项目支持 8 种任务类型（coaching/leave/meeting/project/self-develop/speed_week/training/workshop），每种都有对应的颜色和图标。

| 测试用例 | 目的 |
|---|---|
| 包含所有 8 种任务类型 | 防止新增或删除任务类型时忘记更新配置 |
| 每种类型有 5 个字段 | 防止 UI 渲染时因缺字段崩溃 |

#### `getTaskTypeConfig` 函数（6 个测试）

这个函数把用户传入的字符串（可能大小写混用、有空格）转成对应的样式配置。

| 测试用例 | 输入 | 期望 | 测试目的 |
|---|---|---|---|
| 精确匹配 | `'coaching'` | label='Coaching', icon='👨‍🏫' | 正常功能 |
| 大写输入 | `'TRAINING'` | label='Training' | 用户输入不规范也能工作 |
| 带空格 | `'speed week'` | label='Speed week' | 数据库里可能存了带空格的值 |
| 未知类型 | `'unknown_type'` | 返回灰色默认配置 | 未知类型不崩溃，显示兜底样式 |
| 空字符串 | `''` | label='Unknown' | 字段为空时的处理 |
| null/undefined | `null`, `undefined` | 不抛出异常 | 防止程序崩溃 |

---

### 5.4 `TimeSlotSelector.test.tsx` — 时间槽组件

**对应源文件**：[src/components/TimeSlotSelector.tsx](src/components/TimeSlotSelector.tsx)

这个组件是排班页面里选择"上午/下午/全天"的按钮组。

**测试分两类（共 9 个测试）：**

#### 纯函数测试（不涉及 UI）

| 函数 | 测试用例 | 输入 → 期望输出 |
|---|---|---|
| `getTimeSlotLabel` | AM → 上午 | `'AM'` → `'上午'` |
| `getTimeSlotLabel` | PM → 下午 | `'PM'` → `'下午'` |
| `getTimeSlotLabel` | FULL_DAY → 全天 | `'FULL_DAY'` → `'全天'` |
| `getTimeSlotColor` | AM 含 amber | 颜色类中包含 'amber' |
| `getTimeSlotColor` | PM 含 orange | 颜色类中包含 'orange' |
| `getTimeSlotColor` | FULL_DAY 含 blue | 颜色类中包含 'blue' |

#### UI 交互测试

这里用到了 `@testing-library/react` 渲染组件，再用 `@testing-library/user-event` 模拟点击。

```typescript
// 示例：测试点击触发回调
it('点击 PM 按钮时触发 onChange', async () => {
  const user = userEvent.setup();           // ① 准备"机器人用户"
  const onChange = vi.fn();                  // ② 创建假函数，记录是否被调用

  render(<TimeSlotSelector value="AM" onChange={onChange} />); // ③ 渲染组件

  await user.click(screen.getByText('下午').closest('button')!); // ④ 点击
  expect(onChange).toHaveBeenCalledWith('PM'); // ⑤ 验证回调参数正确
});
```

| 测试用例 | 目的 |
|---|---|
| 渲染三个选项按钮 | 三个按钮都正确显示出来 |
| 点击 PM 触发 onChange('PM') | 点击后把正确的值传给父组件 |
| disabled 时点击不触发 onChange | 禁用状态下用户操作无效 |

---

### 5.5 `TaskCard.test.tsx` — 任务卡片组件

**对应源文件**：[src/components/TaskCard.tsx](src/components/TaskCard.tsx)

任务卡片是排班系统里最核心的 UI 组件，显示任务名称、类型、状态、时间槽、工时等信息。

**共 20 个测试，分两组：**

#### `TaskCard` 组件（14 个测试）

| 测试用例 | 验证的内容 |
|---|---|
| 渲染任务名称 | `task_name` 字段显示在界面上 |
| 渲染任务类型 | `task_type` 字段显示在界面上 |
| 默认状态显示"计划中" | 未传 status 时有合理的默认值 |
| status=completed → 已完成 | 状态标签随数据变化 |
| status=in_progress → 进行中 | 同上 |
| status=cancelled → 已取消 | 同上 |
| 默认时间槽显示"全天" | 未传 time_slot 时默认 FULL_DAY |
| time_slot=AM → 上午 | 时间槽标签随数据变化 |
| time_slot=PM → 下午 | 同上 |
| total_hours 有值时显示工时 | 显示"8h"字样 |
| total_hours 未设置不显示 | 不要显示"0h"或"undefinedh" |
| showEmployee=true 显示员工名 | 员工名可选显示 |
| showEmployee=false 不显示员工名 | 员工名可选隐藏 |
| 点击触发 onClick | 点击事件冒泡正确 |

#### `TaskCardCompact` 组件（6 个测试）

精简版卡片（用于日历格子中的迷你展示）。

| 测试用例 | 验证的内容 |
|---|---|
| 渲染任务名称 | 基本渲染 |
| 渲染任务类型图标 training → 🎓 | 正确图标映射 |
| 点击触发 onClick | 交互正常 |
| FULL_DAY 不显示时间图标 | 全天任务不需要上午/下午标记 |
| AM → 显示 🌅 | 上午任务显示日出图标 |
| PM → 显示 🌆 | 下午任务显示日落图标 |

---

## 6. 测试的基本写法：三行读懂一个测试

一个测试用例的结构：

```typescript
it('描述：这个测试是在验证什么', () => {
  // ① Arrange — 准备数据/条件
  const input = 'training';
  
  // ② Act — 执行被测试的函数/操作
  const result = getTaskTypeConfig(input);
  
  // ③ Assert — 断言（验证结果是否符合期望）
  expect(result.label).toBe('Training');
});
```

这三步模式叫 **AAA（Arrange / Act / Assert）**，也叫"准备 → 执行 → 验证"。

### `describe` 和 `it` 的关系

```typescript
describe('计算器', () => {           // 一组相关测试的容器，相当于"章节"
  it('1+1 等于 2', () => { ... });  // 一个具体的测试用例，相当于"小节"
  it('2-1 等于 1', () => { ... });
});
```

---

## 7. 常见断言速查

```typescript
// 值相等
expect(result).toBe('hello')           // 严格相等（===）
expect(result).toEqual({ a: 1 })       // 深度相等（对象/数组）
expect(result).toBeCloseTo(3.0, 5)     // 浮点数近似相等

// 数字比较
expect(result).toBeGreaterThanOrEqual(0)
expect(result).toBeLessThan(10)

// 存在性
expect(result).toBeDefined()
expect(result).toHaveLength(9)
expect(result).toHaveProperty('name')
expect(result).toContain('amber')       // 字符串/数组包含

// DOM 专属（需要 @testing-library/jest-dom）
expect(element).toBeInTheDocument()    // 元素在页面上
expect(element).not.toBeInTheDocument()

// 函数调用（vi.fn() 创建的假函数）
expect(mockFn).toHaveBeenCalledTimes(1)
expect(mockFn).toHaveBeenCalledWith('PM')
expect(mockFn).not.toHaveBeenCalled()

// 异常
expect(() => fn()).not.toThrow()
```

---

## 8. 测试统计总览

| 测试文件 | 对应源文件 | 测试数量 | 测试类型 |
|---|---|:---:|---|
| `utils.test.ts` | `src/lib/utils.ts` | 6 | 纯函数 |
| `competencyAggregation.test.ts` | `src/lib/competencyAggregation.ts` | 29 | 纯函数（数据计算） |
| `taskTypeConfig.test.ts` | `src/lib/taskTypeConfig.ts` | 8 | 纯函数（配置查询） |
| `TimeSlotSelector.test.tsx` | `src/components/TimeSlotSelector.tsx` | 9 | 纯函数 + UI 交互 |
| `TaskCard.test.tsx` | `src/components/TaskCard.tsx` | 20 | UI 渲染 + 交互 |
| **合计** | | **72** | |

### 测试类型说明

| 类型 | 说明 | 典型工具 |
|---|---|---|
| **纯函数测试** | 输入 → 输出，没有 UI、没有网络 | `expect()` |
| **UI 渲染测试** | 检查组件渲染后 DOM 里有没有预期的内容 | `render()` + `screen.getByText()` |
| **UI 交互测试** | 模拟用户行为（点击/输入），验证回调和状态变化 | `userEvent` + `vi.fn()` |

---

> 💡 **下一步建议**：可以继续为 `skillDefinitionParser.ts`（Excel 解析）和 `complexExcelParser.ts`（复杂表格解析）添加测试，因为这两个模块的逻辑最复杂，也最容易出 Bug。
