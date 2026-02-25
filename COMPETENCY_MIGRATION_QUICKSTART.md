# ✅ 能力评估模块已迁移到 SQL Server

## 🎯 已完成的工作

能力评估(Competency Assessment)页面已经从 Supabase 迁移到 SQL Server 后端。

## 🚀 快速测试

### 方法1: 使用自动化脚本（推荐）

```powershell
.\start_competency_test.ps1
```

这个脚本会自动：
1. 清理旧进程
2. 启动后端服务
3. 测试所有API端点
4. 显示下一步操作指南

### 方法2: 手动启动

**启动后端** (PowerShell窗口1):
```powershell
cd backend
$env:PYTHONPATH = "C:\Users\DOC2CHZ\Software\BPS_20251219\backend"
c:/Users/DOC2CHZ/Software/BPS_20251219/.venv/Scripts/python.exe -m uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

**启动前端** (PowerShell窗口2):
```powershell
npm run dev
```

**访问应用:**
- 打开: http://localhost:5173
- 导航到「能力评估」页面
- 数据应该从SQL Server加载并显示

## ✅ 验证清单

打开能力评估页面后检查：

- [ ] 页面成功加载，无错误提示
- [ ] 矩阵视图显示员工-技能数据
- [ ] 卡片视图显示员工详细信息
- [ ] 表格视图列出所有评估记录
- [ ] 统计数据正确显示（总评估数、员工数、技能数等）
- [ ] 过滤功能正常工作
- [ ] 浏览器控制台无错误（F12 > Console）

## 📊 预期看到的数据

- **评估记录**: 375条
- **员工**: 18名
- **技能**: 104项
- **部门**: 若干个

## 🐛 如果出现问题

1. **空白页面或"加载失败":**
   - 检查后端是否在运行: http://localhost:8000/api/docs
   - 查看浏览器控制台的错误信息

2. **CORS错误:**
   - 确认后端输出包含: `CORS 允许的源: ['http://localhost:5173', ...]`

3. **认证错误:**
   - 重新登录系统

4. **后端启动失败:**
   - 检查数据库连接
   - 查看后端窗口的错误信息

## 📚 更多信息

详细测试指南: `COMPETENCY_SQL_SERVER_MIGRATION.md`

## 🔧 技术细节

- **新API客户端**: `src/lib/competencyApi.ts`
- **更新的组件**: `src/pages/CompetencyAssessment.tsx`
- **后端路由**: `backend/routers/competency_assessments.py`
- **数据来源**: SQL Server (DCCT_BPS_Debug 数据库)

---

**状态**: ✅ 迁移完成  
**日期**: 2026-01-30  
**测试**: 等待用户验证
