# 日程管理登录跳转问题快速诊断脚本

Write-Host "=== BPS 日程管理登录问题诊断 ===" -ForegroundColor Cyan
Write-Host ""

# 1. 检查后端服务
Write-Host "1️⃣  检查后端服务状态..." -ForegroundColor Yellow
try {
    $resp = Invoke-RestMethod -Uri "http://localhost:8000/api/" -Method GET -TimeoutSec 5 -ErrorAction Stop
    Write-Host "   ✅ 后端服务正常运行" -ForegroundColor Green
} catch {
    Write-Host "   ❌ 后端服务未启动或无响应" -ForegroundColor Red
    Write-Host "   💡 请运行: cd backend; python main.py" -ForegroundColor Gray
    exit 1
}

Write-Host ""

# 2. 检查前端 localStorage
Write-Host "2️⃣  请在浏览器控制台（F12）执行以下代码检查 Token：" -ForegroundColor Yellow
Write-Host "   ----------------------------------------" -ForegroundColor Gray
Write-Host "   console.log('Token:', localStorage.getItem('access_token'));" -ForegroundColor White
Write-Host "   console.log('User ID:', localStorage.getItem('user_id'));" -ForegroundColor White
Write-Host "   console.log('Email:', localStorage.getItem('user_email'));" -ForegroundColor White
Write-Host "   ----------------------------------------" -ForegroundColor Gray
Write-Host ""

# 3. 提供 Token 测试
Write-Host "3️⃣  测试 Token 有效性（可选）" -ForegroundColor Yellow
$token = Read-Host "   请输入浏览器 localStorage 中的 access_token（直接回车跳过）"

if ($token -and $token.Length -gt 0) {
    Write-Host "   正在验证 Token..." -ForegroundColor Gray
    
    try {
        $headers = @{
            Authorization = "Bearer $token"
        }
        $userInfo = Invoke-RestMethod -Uri "http://localhost:8000/api/auth/me/" -Headers $headers -Method GET -ErrorAction Stop
        
        Write-Host "   ✅ Token 有效！用户信息：" -ForegroundColor Green
        Write-Host "      - User ID: $($userInfo.user_id)" -ForegroundColor White
        Write-Host "      - Email: $($userInfo.email)" -ForegroundColor White
        Write-Host "      - Name: $($userInfo.name)" -ForegroundColor White
        Write-Host ""
        Write-Host "   💡 Token 正常但仍跳转登录？可能原因：" -ForegroundColor Cyan
        Write-Host "      1. 创建任务时网络请求失败" -ForegroundColor Gray
        Write-Host "      2. CORS 配置问题" -ForegroundColor Gray
        Write-Host "      3. 前端拦截器逻辑错误" -ForegroundColor Gray
        
    } catch {
        $statusCode = $_.Exception.Response.StatusCode.Value__
        
        if ($statusCode -eq 401) {
            Write-Host "   ❌ Token 已过期或无效（401 Unauthorized）" -ForegroundColor Red
            Write-Host ""
            Write-Host "   📌 解决方案：" -ForegroundColor Yellow
            Write-Host "      1. 在浏览器控制台执行：" -ForegroundColor White
            Write-Host "         localStorage.clear();" -ForegroundColor Gray
            Write-Host "      2. 刷新页面" -ForegroundColor White
            Write-Host "      3. 重新登录（使用邮箱 + OTP）" -ForegroundColor White
        } else {
            Write-Host "   ❌ Token 验证失败：$($_.Exception.Message)" -ForegroundColor Red
        }
    }
} else {
    Write-Host "   ⏭️  跳过 Token 验证" -ForegroundColor Gray
}

Write-Host ""

# 4. 检查 JWT 配置
Write-Host "4️⃣  检查后端 JWT 配置..." -ForegroundColor Yellow
$configPath = "backend\config.py"
if (Test-Path $configPath) {
    $expireConfig = Get-Content $configPath | Select-String "jwt_access_token_expire_minutes"
    if ($expireConfig) {
        Write-Host "   $expireConfig" -ForegroundColor White
        
        # 提取分钟数
        if ($expireConfig -match "(\d+)") {
            $minutes = [int]$matches[1]
            $days = [math]::Round($minutes / 60 / 24, 1)
            Write-Host "   💡 Token 有效期：$days 天" -ForegroundColor Cyan
        }
    }
} else {
    Write-Host "   ⚠️  未找到 backend/config.py" -ForegroundColor Yellow
}

Write-Host ""

# 5. 提供诊断建议
Write-Host "=== 诊断建议 ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "✅ 最快解决方案：" -ForegroundColor Green
Write-Host "   1. 浏览器按 F12 打开控制台" -ForegroundColor White
Write-Host "   2. 执行: localStorage.clear()" -ForegroundColor Gray
Write-Host "   3. 刷新页面并重新登录" -ForegroundColor White
Write-Host ""
Write-Host "🔧 开发者调试：" -ForegroundColor Yellow
Write-Host "   1. 打开浏览器 Network 标签" -ForegroundColor White
Write-Host "   2. 创建任务时观察 POST /api/tasks/ 请求" -ForegroundColor White
Write-Host "   3. 检查响应状态码（应为 200，如果是 401 则 Token 无效）" -ForegroundColor White
Write-Host ""
Write-Host "📖 详细文档：SCHEDULE_LOGIN_REDIRECT_FIX.md" -ForegroundColor Cyan
Write-Host ""
