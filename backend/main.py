"""
FastAPI 主程序
BPS (Bosch Production System) 后端 API
"""

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import logging
import time
from config import settings
from database import test_connection

# 配置日志
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# 创建 FastAPI 应用
app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    description="BPS 后端 API - 员工技能管理和资源规划系统",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    openapi_url="/api/openapi.json",
    redirect_slashes=False,  # 禁用 trailing slash 重定向，避免端口丢失
)

# ============================================================================
# CORS 配置
# ============================================================================

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ============================================================================
# 中间件
# ============================================================================

@app.middleware("http")
async def log_requests(request: Request, call_next):
    """请求日志中间件"""
    start_time = time.time()
    
    # 记录请求
    logger.info(f"📥 {request.method} {request.url.path}")
    
    # 处理请求
    response = await call_next(request)
    
    # 计算处理时间
    process_time = time.time() - start_time
    response.headers["X-Process-Time"] = str(process_time)
    
    # 记录响应
    logger.info(f"📤 {request.method} {request.url.path} - {response.status_code} ({process_time:.3f}s)")
    
    return response


@app.middleware("http")
async def error_handler(request: Request, call_next):
    """全局错误处理中间件"""
    try:
        return await call_next(request)
    except Exception as e:
        logger.error(f"❌ 未处理的错误: {e}", exc_info=True)
        # 手动添加CORS头，确保500错误时浏览器也能读取响应
        origin = request.headers.get("origin", "")
        response = JSONResponse(
            status_code=500,
            content={
                "message": "服务器内部错误",
                "detail": str(e) if settings.debug else "请联系管理员"
            }
        )
        if origin in settings.allowed_origins:
            response.headers["Access-Control-Allow-Origin"] = origin
            response.headers["Access-Control-Allow-Credentials"] = "true"
        return response


# ============================================================================
# 事件处理
# ============================================================================

@app.on_event("startup")
async def startup_event():
    """应用启动事件"""
    logger.info("=" * 70)
    logger.info(f"🚀 {settings.app_name} v{settings.app_version} 启动中...")
    logger.info("=" * 70)
    
    # 测试数据库连接
    logger.info("🔌 测试数据库连接...")
    if test_connection():
        logger.info("✅ 数据库连接正常")
    else:
        logger.error("❌ 数据库连接失败")
    
    logger.info(f"📝 API 文档: http://localhost:8000/api/docs")
    logger.info(f"🌐 CORS 允许的源: {settings.allowed_origins}")
    logger.info("=" * 70)


@app.on_event("shutdown")
async def shutdown_event():
    """应用关闭事件"""
    logger.info("👋 应用正在关闭...")


# ============================================================================
# 根路由
# ============================================================================

@app.get("/")
async def root():
    """根路径"""
    return {
        "name": settings.app_name,
        "version": settings.app_version,
        "status": "running",
        "docs": "/api/docs"
    }


@app.get("/api/health")
async def health_check():
    """健康检查"""
    return {
        "status": "healthy",
        "timestamp": time.time(),
        "database": "connected" if test_connection() else "disconnected"
    }


# ============================================================================
# 导入路由模块
# ============================================================================

import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'routers'))

from routers import auth, departments, factories, task_types, skills, employees
from routers import competency_definitions, competency_assessments, tasks as tasks_router
from routers import resource_task_types, resource_planning_tasks
from routers import schedule_change_notifications, views, matching, admin_test, audit, audit_logs
from routers import notifications as notifications_router
from routers import admin_departments, admin_employees, admin_skills, admin_factories, admin_task_types, admin_tasks, admin_competency_definitions, admin_competency_assessments, admin_resource_task_types, admin_resource_planning_tasks, admin_schedule_change_notifications

app.include_router(auth.router, prefix="/api/auth", tags=["认证"])
app.include_router(departments.router, prefix="/api/departments", tags=["部门"])
app.include_router(factories.router, prefix="/api/factories", tags=["工厂"])
app.include_router(task_types.router, prefix="/api/task-types", tags=["任务类型"])
app.include_router(skills.router, prefix="/api/skills", tags=["技能"])
app.include_router(employees.router, prefix="/api/employees", tags=["员工"])
app.include_router(competency_definitions.router, prefix="/api/competency-definitions", tags=["能力定义"])
app.include_router(competency_assessments.router, prefix="/api/competency-assessments", tags=["能力评估"])
app.include_router(tasks_router.router, prefix="/api/tasks", tags=["任务"])
app.include_router(resource_task_types.router, prefix="/api/resource-task-types", tags=["资源任务类型"])
app.include_router(resource_planning_tasks.router, prefix="/api/resource-planning-tasks", tags=["资源规划任务"])
app.include_router(schedule_change_notifications.router, prefix="/api/schedule-change-notifications", tags=["计划变更通知"])
app.include_router(views.router, prefix="/api/views", tags=["视图查询"])
app.include_router(matching.router, prefix="/api/matching", tags=["任务匹配"])
app.include_router(notifications_router.router, prefix="/api/notifications", tags=["通知"])
app.include_router(admin_test.router, tags=["管理员测试"])
app.include_router(audit.router, tags=["审计日志"])
app.include_router(audit_logs.router, prefix="/api/audit-logs", tags=["审计日志查询"])
app.include_router(admin_departments.router, prefix="/api/admin/departments", tags=["部门管理"])
app.include_router(admin_employees.router, prefix="/api/admin/employees", tags=["员工管理"])
app.include_router(admin_skills.router, prefix="/api/admin/skills", tags=["技能管理"])
app.include_router(admin_factories.router, prefix="/api", tags=["工厂管理"])
app.include_router(admin_task_types.router, prefix="/api", tags=["任务类型管理"])
app.include_router(admin_tasks.router, prefix="/api", tags=["任务管理"])
app.include_router(admin_competency_definitions.router, prefix="/api", tags=["能力定义管理"])
app.include_router(admin_competency_assessments.router, prefix="/api", tags=["能力评估管理"])
app.include_router(admin_resource_task_types.router, prefix="/api", tags=["资源任务类型管理"])
app.include_router(admin_resource_planning_tasks.router, prefix="/api", tags=["资源规划任务管理"])
app.include_router(admin_schedule_change_notifications.router, prefix="/api", tags=["计划变更通知管理"])


# ============================================================================
# 主程序入口
# ============================================================================

if __name__ == "__main__":
    import uvicorn
    
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=settings.debug,
        log_level="info"
    )
