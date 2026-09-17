"""
路由模块初始化
"""

# 导入所有路由模块（使用相对导入避免命名冲突）
from . import auth
from . import departments
from . import factories
from . import task_types
from . import skills
from . import employees
from . import competency_definitions
from . import competency_assessments
from . import competency_assessment_versions
from . import annual_baselines
from . import dashboard_progress
from . import tasks
from . import resource_task_types
from . import resource_planning_tasks
from . import schedule_change_notifications
from . import views

__all__ = [
    "auth",
    "departments",
    "factories",
    "task_types",
    "skills",
    "employees",
    "competency_definitions",
    "competency_assessments",
    "competency_assessment_versions",
    "annual_baselines",
    "dashboard_progress",
    "tasks",
    "resource_task_types",
    "resource_planning_tasks",
    "schedule_change_notifications",
    "views",
]
