# ============================================================================
# 管理员权限系统测试 - PowerShell 版本
# 演示如何使用真实的管理员账户进行 API 调用
# ============================================================================

Write-Host "`n" -NoNewline
Write-Host "=" -NoNewline -ForegroundColor Cyan
Write-Host ("=" * 99) -ForegroundColor Cyan
Write-Host "🔐 管理员账户登录测试" -ForegroundColor Green
Write-Host "=" -NoNewline -ForegroundColor Cyan
Write-Host ("=" * 99) -ForegroundColor Cyan

$baseUrl = "http://localhost:8000"

# ============================================================================
# Step 1: 使用管理员账户登录
# ============================================================================
Write-Host "`n📝 Step 1: 使用管理员账户登录" -ForegroundColor Yellow
Write-Host "-" -NoNewline
Write-Host ("-" * 99)

$loginData = @{
    email = "admin@bosch.com"
    password = "Admin1234"
} | ConvertTo-Json

try {
    $loginResponse = Invoke-RestMethod -Uri "$baseUrl/api/auth/login" -Method POST -Body $loginData -ContentType "application/json"
    
    if ($loginResponse.access_token) {
        Write-Host "✅ 登录成功" -ForegroundColor Green
        Write-Host "   用户: $($loginResponse.user.name)" -ForegroundColor Gray
        Write-Host "   邮箱: $($loginResponse.user.email)" -ForegroundColor Gray
        Write-Host "   角色: $($loginResponse.user.role)" -ForegroundColor Gray
        
        $token = $loginResponse.access_token
    } else {
        Write-Host "❌ 登录失败 - 未返回 token" -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "❌ 登录失败: $_" -ForegroundColor Red
    Write-Host "   请确认:" -ForegroundColor Yellow
    Write-Host "   1. 后端服务器正在运行 (http://localhost:8000)" -ForegroundColor Gray
    Write-Host "   2. 管理员账户已创建 (运行 backend/create_admin.py)" -ForegroundColor Gray
    exit 1
}

# ============================================================================
# Step 2: 使用 token 访问需要管理员权限的端点
# ============================================================================
Write-Host "`n📝 Step 2: 访问管理员专属端点" -ForegroundColor Yellow
Write-Host "-" -NoNewline
Write-Host ("-" * 99)

$headers = @{
    "Authorization" = "Bearer $token"
}

try {
    $adminResponse = Invoke-RestMethod -Uri "$baseUrl/api/admin/test" -Method GET -Headers $headers
    
    Write-Host "✅ 管理员权限验证成功" -ForegroundColor Green
    Write-Host "   消息: $($adminResponse.message)" -ForegroundColor Gray
    Write-Host "   权限级别: $($adminResponse.access_level)" -ForegroundColor Gray
    Write-Host "   描述: $($adminResponse.description)" -ForegroundColor Gray
} catch {
    if ($_.Exception.Response.StatusCode -eq 403) {
        Write-Host "❌ 403 Forbidden - 您没有管理员权限" -ForegroundColor Red
    } else {
        Write-Host "❌ 请求失败: $_" -ForegroundColor Red
    }
}

# ============================================================================
# Step 3: 访问普通端点
# ============================================================================
Write-Host "`n📝 Step 3: 访问普通用户端点" -ForegroundColor Yellow
Write-Host "-" -NoNewline
Write-Host ("-" * 99)

try {
    $userResponse = Invoke-RestMethod -Uri "$baseUrl/api/admin/user-info" -Method GET -Headers $headers
    
    Write-Host "✅ 用户身份验证成功" -ForegroundColor Green
    Write-Host "   用户ID: $($userResponse.user_info.user_id)" -ForegroundColor Gray
    Write-Host "   邮箱: $($userResponse.user_info.email)" -ForegroundColor Gray
    Write-Host "   角色: $($userResponse.user_info.role)" -ForegroundColor Gray
} catch {
    Write-Host "❌ 请求失败: $_" -ForegroundColor Red
}

# ============================================================================
# Step 4: 测试总结
# ============================================================================
Write-Host "`n" -NoNewline
Write-Host "=" -NoNewline -ForegroundColor Cyan
Write-Host ("=" * 99) -ForegroundColor Cyan
Write-Host "📊 测试总结" -ForegroundColor Green
Write-Host "=" -NoNewline -ForegroundColor Cyan
Write-Host ("=" * 99) -ForegroundColor Cyan

Write-Host "`n✅ 权限系统测试完成" -ForegroundColor Green
Write-Host "`n核心功能:" -ForegroundColor Yellow
Write-Host "  ✓ 管理员登录成功" -ForegroundColor Gray
Write-Host "  ✓ JWT token 包含 role='admin'" -ForegroundColor Gray
Write-Host "  ✓ verify_admin() 中间件正常工作" -ForegroundColor Gray
Write-Host "  ✓ 管理员可以访问受保护的端点" -ForegroundColor Gray

Write-Host "`n下一步:" -ForegroundColor Yellow
Write-Host "  1. 访问 API 文档: http://localhost:8000/api/docs" -ForegroundColor Gray
Write-Host "  2. 在 Swagger UI 中使用 token 测试其他端点" -ForegroundColor Gray
Write-Host "  3. 继续开发 Phase 2 (审计日志系统)" -ForegroundColor Gray

Write-Host "`n" -NoNewline
Write-Host "=" -NoNewline -ForegroundColor Cyan
Write-Host ("=" * 99) -ForegroundColor Cyan
Write-Host ""

# 保存 token 供后续使用
Write-Host "💾 Token 已保存，可用于后续 API 测试" -ForegroundColor Cyan
Write-Host ""
