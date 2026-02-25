# GitHub Copilot Skills for BPS Platform

这个目录包含了专门为 BPS Capacity & Scheduling Platform 定制的 Copilot Agent Skills，让 AI 编码助手更好地理解项目特定的上下文和操作。

## 📚 可用技能

### Core Skills (核心技能)

### 1. [project-context.md](skills/project-context.md)
**项目上下文技能**

提供项目整体架构、业务背景、关键组件的理解。

**适用场景**：
- 初次接触项目
- 需要理解业务流程
- 导航代码库结构
- 了解技术栈和依赖

**关键知识**：
- 9 大能力模块
- SQL Server 数据库架构（已从 Supabase 完全迁移）
- React 18 + FastAPI 技术栈
- 5 级能力评估体系

---

### 2. [database-operations.md](skills/database-operations.md)
**数据库操作技能**

执行 SQL Server 数据库操作（已从 Supabase 迁移）。

**适用场景**：
- 查询员工数据
- 获取技能信息
- 分析能力评估
- 计算差距统计

**关键能力**：
- 参数化查询（防 SQL 注入）
- JOIN 操作规范
- 连接池管理
- 数据验证

**示例查询**：
```sql
-- 获取员工能力评估汇总
SELECT s.skill_name, ca.current_level, ca.target_level, ca.gap
FROM competency_assessments ca
JOIN skills s ON ca.skill_id = s.id
WHERE ca.employee_id = ?;
```

---

### 3. [excel-import-operations.md](skills/excel-import-operations.md)
**Excel 导入操作技能**

处理 Excel 文件解析和数据导入功能。

**适用场景**：
- 导入技能定义
- 导入能力评估
- 导入资源规划
- 调试导入错误

**支持的格式**：
1. **技能定义**：垂直格式 `编号 | 模块 | 类型 | 工程师`
2. **能力评估**：矩阵格式，C/T 配对
3. **资源规划**：周任务分配矩阵

**错误处理**：
- 返回详细的行/列错误信息
- 提供修复建议
- 显示解析预览

---

### 4. [competency-calculations.md](skills/competency-calculations.md)
**能力计算技能**

计算能力统计、差距和排名分析。

**适用场景**：
- 团队能力分析
- 个人能力评估
- Gap 排名
- 雷达图/柱状图数据

**核心计算**：
```typescript
// 模块级统计
calculateTeamModuleStats(assessments, skills)
  → { moduleName, avgCurrent, avgTarget, totalGap, avgGap }

// 技能级统计
calculateTeamSkillStats(assessments, skills)
  → { skillName, avgCurrent, avgTarget, avgGap }
```

**可视化**：
- Radar Chart（模块视图）
- Bar Chart（技能视图）
- Ranking（排名列表）

---

### 5. [testing-commands.md](skills/testing-commands.md)
**测试命令技能**

执行测试和验证代码质量。

**适用场景**：
- 运行单元测试
- TypeScript 类型检查
- 代码质量验证
- 集成测试

**核心命令**：
```bash
# 前端
npm run typecheck  # TypeScript 验证（必须通过）
npm run lint       # ESLint 检查
npm run build      # 生产构建测试

# 后端
cd backend
pytest             # 运行所有测试
pytest -v -s       # 详细输出 + 显示 print
```

**TDD 工作流**：
1. 🔴 Red: 写失败的测试
2. 🟢 Green: 实现最小代码使其通过
3. ♻️ Refactor: 重构优化

---

## Advanced Skills (高级技能)

### 6. [api-routes-skill.md](skills/api-routes-skill.md)
**FastAPI 路由规范**

设计和实现 RESTful API 端点。

**适用场景**：
- 创建新的 API 路由
- 理解路由命名规范
- 实现 CRUD 操作
- 错误处理和验证

**关键模式**：
- 标准 CRUD 端点（GET/POST/PUT/DELETE）
- Pydantic 模型验证
- 依赖注入（数据库游标、认证）
- 响应状态码规范

---

### 7. [authentication-skill.md](skills/authentication-skill.md)
**JWT + OTP 认证流程**

实现和调试身份验证功能。

**适用场景**：
- 实现登录/注册流程
- 生成和验证 OTP
- JWT token 管理
- 保护 API 端点

**核心流程**：
1. 发送 OTP 到邮箱
2. 验证 OTP 获取 JWT
3. 使用 JWT 访问受保护资源

**安全实践**：
- OTP 10分钟过期，最多3次尝试
- JWT 30分钟过期
- 参数化查询防 SQL 注入
- HTTPS 传输

---

### 8. [react-patterns-skill.md](skills/react-patterns-skill.md)
**React Query + Context 模式**

现代 React 状态管理和服务器状态同步。

**适用场景**：
- 实现数据查询（useQuery）
- 实现数据修改（useMutation）
- 缓存失效策略
- 全局状态管理（Context API）

**核心模式**：
```typescript
// React Query
const { data, isLoading } = useQuery({
  queryKey: ['employees'],
  queryFn: fetchEmployees
});

// Mutation with cache update
const mutation = useMutation({
  mutationFn: createEmployee,
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['employees'] });
  }
});

// Context API
const { persona, setPersona } = usePersona();
```

---

### 9. [migration-skill.md](skills/migration-skill.md)
**Supabase → SQL Server 迁移参考**

理解已完成的数据库迁移过程和架构变化。

**适用场景**：
- 迁移功能到 SQL Server
- 理解架构差异
- 转换 Supabase 查询
- 数据一致性验证

**关键差异**：
- UUID vs INT 主键
- text vs NVARCHAR
- RLS vs 应用层认证
- 内置 Auth vs 自定义 JWT

**迁移状态**：
- ✅ Competency, Auth, Employees
- 🔄 Schedule/Calendar
- ⏳ Import, Resource Planning

---

### 10. [deployment-skill.md](skills/deployment-skill.md)
**生产环境部署流程**

配置和部署应用到生产环境。

**适用场景**：
- 配置环境变量
- 部署前端（Nginx/IIS）
- 部署后端（Gunicorn/Uvicorn）
- 数据库备份和监控

**部署清单**：
- [ ] 环境变量配置
- [ ] SSL 证书安装
- [ ] 数据库备份
- [ ] 健康检查端点
- [ ] 日志和监控
- [ ] 回滚计划

**监控**：
- 健康检查：`/api/health`
- Prometheus metrics：`/metrics`
- 日志分析：Nginx access logs

---

## 🎯 如何使用

### 在 GitHub Copilot Chat 中使用

**方式 1：直接引用技能**
```
@workspace 使用 database-operations 技能，帮我查询所有员工的能力评估数据
```

**方式 2：描述需求，Copilot 自动选择技能**
```
我需要解析一个 Excel 能力评估文件，格式是 C/T 配对的矩阵
```
→ Copilot 会自动使用 `excel-import-operations.md` 中的知识

**方式 3：编码时自动提示**
当你编写相关代码时，Copilot 会根据技能文件提供更精准的建议。

---

## 📝 技能文件结构

每个技能文件遵循统一格式：

```markdown
# [技能名称] Skill

**Description**: [简短描述]
**Usage**: [使用场景]

## Capabilities
[技能能做什么]

## Context
[必要的上下文信息]

## Example Workflows
[实际使用示例]

## Common Patterns
[代码模式和最佳实践]
```

---

## 🔧 维护指南

### 何时更新技能文件

**必须更新**：
- [ ] 添加新的核心功能模块
- [ ] 修改数据库 schema
- [ ] 改变 Excel 导入格式
- [ ] 引入新的计算逻辑
- [ ] 更新测试流程

**推荐更新**：
- [ ] 发现常见错误模式
- [ ] 添加新的最佳实践
- [ ] 优化代码示例
- [ ] 补充边界情况处理

### 更新流程
1. 编辑对应的 `.md` 文件
2. 保持格式一致性
3. 添加实际代码示例
4. 更新本 `README.md` 的变更日志
5. 提交时使用描述性 commit message

---

## 🚀 贡献新技能

### 创建新技能文件

**模板**：
```markdown
# [Your Skill Name] Skill

**Description**: One-line description

**Usage**: When to use this skill

## Capabilities
- Capability 1
- Capability 2

## Context
Key information needed to use this skill

## Example Workflows
Step-by-step examples

## Common Patterns
Code snippets and best practices

## Testing Checklist
- [ ] Test case 1
- [ ] Test case 2
```

**命名规范**：
- 使用 kebab-case：`your-skill-name.md`
- 描述性名称：`excel-import-operations.md`（好）vs `excel.md`（不够具体）

---

## 📊 技能覆盖度

| 领域 | 技能文件 | 覆盖度 |
|------|---------|--------|
| 项目总览 | `project-context.md` | ✅ 100% |
| 数据库操作 | `database-operations.md` | ✅ 90% |
| Excel 导入 | `excel-import-operations.md` | ✅ 95% |
| 能力计算 | `competency-calculations.md` | ✅ 100% |
| 测试流程 | `testing-commands.md` | ✅ 85% |
| API 路由 | ❌ 待补充 | 0% |
| 认证流程 | ❌ 待补充 | 0% |

---

## 🔍 快速查找

**我想...**

- **理解项目架构** → `project-context.md`
- **查询数据库** → `database-operations.md`
- **解析 Excel** → `excel-import-operations.md`
- **计算能力统计** → `competency-calculations.md`
- **运行测试** → `testing-commands.md`
- **修复导入错误** → `excel-import-operations.md` + `database-operations.md`
- **优化查询性能** → `database-operations.md` + `competency-calculations.md`

---

## 📖 相关文档

- [Copilot Instructions](../copilot-instructions.md) - AI 编码指南
- [SKILL_IMPORT_FORMAT_GUIDE.md](../../SKILL_IMPORT_FORMAT_GUIDE.md) - 用户 Excel 格式指南
- [SQLSERVER_SCHEMA.sql](../../SQLSERVER_SCHEMA.sql) - 数据库 schema
- [openspec/AGENTS.md](../../openspec/AGENTS.md) - OpenSpec 提案流程

---

## 🤝 反馈与改进

发现技能文件缺失或需要改进？

1. **提交 Issue**：描述缺失的知识或改进建议
2. **直接编辑**：修改 `.md` 文件并提交 PR
3. **告诉 Copilot**：在 Chat 中说 "这个技能文件缺少 XXX 信息"

---

**最后更新**: 2026-02-02  
**维护者**: BPS 开发团队  
**版本**: v1.0.0
