# 能力评估模块测试启动脚本
# 用于启动后端服务并测试API

Write-Host "`n" -NoNewline
Write-Host "="*70 -ForegroundColor Cyan
Write-Host "  🚀 能力评估模块 - SQL Server 迁移测试" -ForegroundColor Green
Write-Host "="*70 -ForegroundColor Cyan
Write-Host ""

# 第1步: 清理旧进程
Write-Host "📋 步骤 1/4: 清理旧的Python进程..." -ForegroundColor Yellow
$pythonProcesses = Get-Process python -ErrorAction SilentlyContinue | Where-Object {$_.Path -like '*BPS_20251219*'}
if ($pythonProcesses) {
    Write-Host "   找到 $($pythonProcesses.Count) 个相关Python进程，正在清理..." -ForegroundColor White
    $pythonProcesses | Stop-Process -Force -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 2
    Write-Host "   ✅ 清理完成" -ForegroundColor Green
} else {
    Write-Host "   ✅ 没有需要清理的进程" -ForegroundColor Green
}

# 第2步: 启动后端服务
Write-Host "`n📋 步骤 2/4: 启动后端服务..." -ForegroundColor Yellow
Write-Host "   在新窗口启动FastAPI服务器..." -ForegroundColor White

$backendScript = @"
cd C:\Users\DOC2CHZ\Software\BPS_20251219\backend
`$env:PYTHONPATH = 'C:\Users\DOC2CHZ\Software\BPS_20251219\backend'
Write-Host '🔥 正在启动后端服务...' -ForegroundColor Cyan
Write-Host '📍 工作目录: ' -NoNewline; Write-Host `$PWD -ForegroundColor White
Write-Host '📍 PYTHONPATH: ' -NoNewline; Write-Host `$env:PYTHONPATH -ForegroundColor White
Write-Host ''
c:/Users/DOC2CHZ/Software/BPS_20251219/.venv/Scripts/python.exe -m uvicorn main:app --reload --host 0.0.0.0 --port 8000
"@

$backendScript | Out-File -FilePath ".\backend\start_backend_temp.ps1" -Encoding UTF8 -Force

Start-Process powershell -ArgumentList "-NoExit", "-ExecutionPolicy", "Bypass", "-File", ".\backend\start_backend_temp.ps1" -WindowStyle Normal

Write-Host "   ✅ 后端服务启动命令已发送" -ForegroundColor Green
Write-Host "   ⏳ 等待10秒让服务完全启动..." -ForegroundColor White

Start-Sleep -Seconds 10

# 第3步: 测试API端点
Write-Host "`n📋 步骤 3/4: 测试API端点..." -ForegroundColor Yellow

$allPassed = $true

# 测试健康检查
Write-Host "   测试 1: /api/health " -NoNewline -ForegroundColor White
try {
    $health = Invoke-RestMethod -Uri 'http://localhost:8000/api/health' -Method Get -TimeoutSec 5
    Write-Host "✅" -ForegroundColor Green
} catch {
    Write-Host "❌ (后端可能未启动)" -ForegroundColor Red
    $allPassed = $false
}

# 测试能力评估
Write-Host "   测试 2: /api/competency-assessments " -NoNewline -ForegroundColor White
try {
    $assessments = Invoke-RestMethod -Uri 'http://localhost:8000/api/competency-assessments' -Method Get -TimeoutSec 10
    Write-Host "✅ ($($assessments.Count) 条记录)" -ForegroundColor Green
} catch {
    Write-Host "❌" -ForegroundColor Red
    $allPassed = $false
}

# 测试员工
Write-Host "   测试 3: /api/employees " -NoNewline -ForegroundColor White
try {
    $employees = Invoke-RestMethod -Uri 'http://localhost:8000/api/employees' -Method Get -TimeoutSec 10
    Write-Host "✅ ($($employees.Count) 名)" -ForegroundColor Green
} catch {
    Write-Host "❌" -ForegroundColor Red
    $allPassed = $false
}

# 测试技能
Write-Host "   测试 4: /api/matching/skills " -NoNewline -ForegroundColor White
try {
    $skills = Invoke-RestMethod -Uri 'http://localhost:8000/api/matching/skills' -Method Get -TimeoutSec 10
    Write-Host "✅ ($($skills.Count) 项)" -ForegroundColor Green
} catch {
    Write-Host "❌" -ForegroundColor Red
    $allPassed = $false
}

# 测试部门
Write-Host "   测试 5: /api/departments " -NoNewline -ForegroundColor White
try {
    $departments = Invoke-RestMethod -Uri 'http://localhost:8000/api/departments' -Method Get -TimeoutSec 10
    Write-Host "✅ ($($departments.Count) 个)" -ForegroundColor Green
} catch {
    Write-Host "❌" -ForegroundColor Red
    $allPassed = $false
}

# 第4步: 显示结果和后续步骤
Write-Host "`n📋 步骤 4/4: 测试结果" -ForegroundColor Yellow

if ($allPassed) {
    Write-Host ""
    Write-Host "="*70 -ForegroundColor Green
    Write-Host "  🎉 所有API测试通过！后端服务运行正常" -ForegroundColor Green
    Write-Host "="*70 -ForegroundColor Green
    Write-Host ""
    Write-Host "📝 下一步操作:" -ForegroundColor Cyan
    Write-Host "   1. 启动前端服务 (在新的PowerShell窗口):" -ForegroundColor White
    Write-Host "      cd C:\Users\DOC2CHZ\Software\BPS_20251219" -ForegroundColor Yellow
    Write-Host "      npm run dev" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "   2. 打开浏览器访问:" -ForegroundColor White
    Write-Host "      http://localhost:5173" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "   3. 导航到「能力评估」页面" -ForegroundColor White
    Write-Host "      应该能看到从SQL Server加载的数据" -ForegroundColor White
    Write-Host ""
    Write-Host "   4. 查看浏览器控制台(F12)" -ForegroundColor White
    Write-Host "      应该看到以下日志:" -ForegroundColor White
    Write-Host "      🔄 competencyApi: 加载能力评估数据..." -ForegroundColor Gray
    Write-Host "      ✅ competencyApi: 数据转换完成" -ForegroundColor Gray
    Write-Host "      ✅ CompetencyAssessment: 数据加载成功" -ForegroundColor Gray
    Write-Host ""
    Write-Host "📚 相关文档:" -ForegroundColor Cyan
    Write-Host "   详细测试说明: COMPETENCY_SQL_SERVER_MIGRATION.md" -ForegroundColor White
    Write-Host ""
} else {
    Write-Host ""
    Write-Host "="*70 -ForegroundColor Red
    Write-Host "  ⚠️ 部分API测试失败" -ForegroundColor Red
    Write-Host "="*70 -ForegroundColor Red
    Write-Host ""
    Write-Host "🔍 问题排查:" -ForegroundColor Cyan
    Write-Host "   1. 检查后端窗口是否有错误信息" -ForegroundColor White
    Write-Host "   2. 访问 API 文档: http://localhost:8000/api/docs" -ForegroundColor White
    Write-Host "   3. 检查数据库连接是否正常" -ForegroundColor White
    Write-Host "   4. 查看详细文档: COMPETENCY_SQL_SERVER_MIGRATION.md" -ForegroundColor White
    Write-Host ""
    Write-Host "💡 如果后端未启动成功，手动运行:" -ForegroundColor Yellow
    Write-Host "   cd C:\Users\DOC2CHZ\Software\BPS_20251219\backend" -ForegroundColor White
    Write-Host "   `$env:PYTHONPATH = 'C:\Users\DOC2CHZ\Software\BPS_20251219\backend'" -ForegroundColor White
    Write-Host "   c:/Users/DOC2CHZ/Software/BPS_20251219/.venv/Scripts/python.exe -m uvicorn main:app --reload --host 0.0.0.0 --port 8000" -ForegroundColor White
    Write-Host ""
}

Write-Host "="*70 -ForegroundColor Cyan
Write-Host ""
