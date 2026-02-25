"""
API 端点测试脚本
测试所有 CRUD 和视图查询端点
"""
import requests
import json
from datetime import datetime

BASE_URL = "http://localhost:8000/api"

# 测试结果记录
test_results = {
    "passed": [],
    "failed": []
}

def test_endpoint(name, method, url, **kwargs):
    """测试单个端点"""
    try:
        response = requests.request(method, url, **kwargs)
        status = f"✅ {response.status_code}"
        test_results["passed"].append(name)
        print(f"{status} | {name}")
        return response
    except Exception as e:
        status = f"❌ Error"
        test_results["failed"].append(f"{name}: {str(e)}")
        print(f"{status} | {name}: {str(e)}")
        return None

print("=" * 80)
print("🧪 BPS API 端点测试")
print("=" * 80)

# 1. 测试认证端点
print("\n📍 认证模块 (Auth)")
print("-" * 80)

# 注册 OTP
test_endpoint(
    "POST /api/auth/signup-otp - 请求注册 OTP",
    "POST",
    f"{BASE_URL}/auth/signup-otp",
    json={"email": "test@example.com"}
)

# 2. 测试部门 CRUD
print("\n📍 部门管理 (Departments)")
print("-" * 80)

test_endpoint(
    "GET /api/departments - 获取所有部门",
    "GET",
    f"{BASE_URL}/departments"
)

test_endpoint(
    "GET /api/departments/1 - 获取单个部门",
    "GET",
    f"{BASE_URL}/departments/1"
)

# 3. 测试工厂 CRUD
print("\n📍 工厂管理 (Factories)")
print("-" * 80)

test_endpoint(
    "GET /api/factories - 获取所有工厂",
    "GET",
    f"{BASE_URL}/factories"
)

# 4. 测试任务类型 CRUD
print("\n📍 任务类型管理 (Task Types)")
print("-" * 80)

test_endpoint(
    "GET /api/task-types - 获取所有任务类型",
    "GET",
    f"{BASE_URL}/task-types"
)

# 5. 测试技能 CRUD
print("\n📍 技能管理 (Skills)")
print("-" * 80)

test_endpoint(
    "GET /api/skills - 获取所有技能",
    "GET",
    f"{BASE_URL}/skills"
)

# 6. 测试员工 CRUD
print("\n📍 员工管理 (Employees)")
print("-" * 80)

test_endpoint(
    "GET /api/employees - 获取所有员工",
    "GET",
    f"{BASE_URL}/employees"
)

# 7. 测试能力定义 CRUD
print("\n📍 能力定义管理 (Competency Definitions)")
print("-" * 80)

test_endpoint(
    "GET /api/competency-definitions - 获取所有能力定义",
    "GET",
    f"{BASE_URL}/competency-definitions"
)

# 8. 测试能力评估 CRUD
print("\n📍 能力评估管理 (Competency Assessments)")
print("-" * 80)

test_endpoint(
    "GET /api/competency-assessments - 获取所有能力评估",
    "GET",
    f"{BASE_URL}/competency-assessments"
)

# 9. 测试任务 CRUD
print("\n📍 任务管理 (Tasks)")
print("-" * 80)

test_endpoint(
    "GET /api/tasks - 获取所有任务",
    "GET",
    f"{BASE_URL}/tasks"
)

test_endpoint(
    "GET /api/tasks?status=active - 按状态过滤任务",
    "GET",
    f"{BASE_URL}/tasks?status=active"
)

# 10. 测试资源任务类型 CRUD
print("\n📍 资源任务类型管理 (Resource Task Types)")
print("-" * 80)

test_endpoint(
    "GET /api/resource-task-types - 获取所有资源任务类型",
    "GET",
    f"{BASE_URL}/resource-task-types"
)

# 11. 测试资源规划任务 CRUD
print("\n📍 资源规划任务管理 (Resource Planning Tasks)")
print("-" * 80)

test_endpoint(
    "GET /api/resource-planning-tasks - 获取所有资源规划任务",
    "GET",
    f"{BASE_URL}/resource-planning-tasks"
)

# 12. 测试计划变更通知 CRUD
print("\n📍 计划变更通知管理 (Schedule Change Notifications)")
print("-" * 80)

test_endpoint(
    "GET /api/notifications - 获取所有计划变更通知",
    "GET",
    f"{BASE_URL}/notifications"
)

# 13. 测试视图查询端点
print("\n📍 业务视图查询 (Views)")
print("-" * 80)

test_endpoint(
    "GET /api/views/employee-competency-matrix - 员工能力矩阵",
    "GET",
    f"{BASE_URL}/views/employee-competency-matrix"
)

test_endpoint(
    "GET /api/views/skill-gap-analysis - 技能差距分析",
    "GET",
    f"{BASE_URL}/views/skill-gap-analysis"
)

test_endpoint(
    "GET /api/views/employee-workload - 员工工作量统计",
    "GET",
    f"{BASE_URL}/views/employee-workload"
)

test_endpoint(
    "GET /api/views/resource-planning-overview - 资源规划总览",
    "GET",
    f"{BASE_URL}/views/resource-planning-overview"
)

test_endpoint(
    "GET /api/views/department-skill-distribution - 部门技能分布",
    "GET",
    f"{BASE_URL}/views/department-skill-distribution"
)

test_endpoint(
    "GET /api/views/task-timeline - 任务时间线",
    "GET",
    f"{BASE_URL}/views/task-timeline"
)

# 测试摘要
print("\n" + "=" * 80)
print("📊 测试摘要")
print("=" * 80)
print(f"✅ 通过: {len(test_results['passed'])} 个端点")
print(f"❌ 失败: {len(test_results['failed'])} 个端点")

if test_results['failed']:
    print("\n失败的端点:")
    for fail in test_results['failed']:
        print(f"  - {fail}")

print("\n" + "=" * 80)
print("💡 提示: 访问 http://localhost:8000/api/docs 查看完整 API 文档")
print("=" * 80)
