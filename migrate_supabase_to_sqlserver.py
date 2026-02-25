"""
Supabase 数据迁移脚本 - 自动迁移到 SQL Server
功能：从 Supabase (PostgreSQL) 读取所有表数据并写入 SQL Server
执行前提：
  1. 已在 SQL Server 执行 SQLSERVER_SCHEMA.sql 建表脚本
  2. 已安装依赖：pip install supabase pyodbc python-dotenv
  3. 本机可访问 Supabase 和内网 SQL Server
"""

import os
import sys
import uuid
from datetime import datetime
from typing import List, Dict, Any
import pyodbc
from supabase import create_client, Client
from dotenv import load_dotenv
import httpx

# ============================================================================
# 配置区域（请根据实际情况修改）
# ============================================================================

# 如果项目有 .env 文件，可自动加载；否则直接在下方填写
load_dotenv()

# Supabase 配置（从 .env 读取或直接填写）
SUPABASE_URL = os.getenv("VITE_SUPABASE_URL") or "https://wpbgzcmpwsktoaowwkpj.supabase.co"
SUPABASE_KEY = os.getenv("VITE_SUPABASE_ANON_KEY") or "sb_publishable_ytPCyU2oEoHxYQYBPdC-8A_QskBu-l4"

# 代理配置（Bosch 公司网络需要）
# 如果不需要代理，设置为 None
HTTP_PROXY = os.getenv("HTTP_PROXY")   # 例如: "http://username:password@proxy.bosch.com:8080"
HTTPS_PROXY = os.getenv("HTTPS_PROXY") # 例如: "http://username:password@proxy.bosch.com:8080"

# SQL Server 配置（已填写你的内网数据库信息）
SQLSERVER_CONFIG = {
    "server": "10.88.43.154",      # 内网SQL Server地址
    "port": 1433,                   # SQL Server默认端口（如连接失败可尝试不指定端口）
    "database": "DCCT_BPS_Debug",  # 数据库名
    "username": "TEST",             # 用户名
    "password": "123456",           # 密码
    "driver": "ODBC Driver 17 for SQL Server"  # 驱动名称（如果连接失败，运行下方PowerShell命令查看实际版本）
}

# ============================================================================
# 初始化连接
# ============================================================================

def init_supabase() -> Client:
    """初始化 Supabase 客户端"""
    try:
        # 使用系统代理配置（自动从环境变量读取）
        # Python httpx 会自动使用 HTTP_PROXY/HTTPS_PROXY 环境变量
        supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
        print("✅ Supabase 连接成功")
        return supabase
    except Exception as e:
        print(f"❌ Supabase 连接失败: {e}")
        sys.exit(1)

def init_sqlserver() -> pyodbc.Connection:
    """初始化 SQL Server 连接"""
    try:
        connection_string = (
            f"DRIVER={{{SQLSERVER_CONFIG['driver']}}};"
            f"SERVER={SQLSERVER_CONFIG['server']},{SQLSERVER_CONFIG['port']};"
            f"DATABASE={SQLSERVER_CONFIG['database']};"
            f"UID={SQLSERVER_CONFIG['username']};"
            f"PWD={SQLSERVER_CONFIG['password']};"
        )
        conn = pyodbc.connect(connection_string)
        print("✅ SQL Server 连接成功")
        return conn
    except Exception as e:
        print(f"❌ SQL Server 连接失败: {e}")
        print(f"   请检查配置: {SQLSERVER_CONFIG['server']}:{SQLSERVER_CONFIG['port']}")
        sys.exit(1)

# ============================================================================
# UUID 转换辅助函数
# ============================================================================

def convert_uuid(value: Any) -> str:
    """将 UUID 对象转换为字符串"""
    if isinstance(value, uuid.UUID):
        return str(value)
    elif isinstance(value, str):
        return value
    return None

# ============================================================================
# 数据迁移函数
# ============================================================================

def migrate_departments(supabase: Client, sql_conn: pyodbc.Connection):
    """迁移部门表"""
    print("\n📋 开始迁移 departments 表...")
    
    # 从 Supabase 读取
    response = supabase.table("departments").select("*").execute()
    departments = response.data
    
    if not departments:
        print("   ⚠️  Supabase 无部门数据，跳过")
        return
    
    cursor = sql_conn.cursor()
    
    # 清空目标表（可选，如需保留现有数据则注释掉）
    # cursor.execute("DELETE FROM departments")
    
    # 插入数据
    for dept in departments:
        cursor.execute("""
            IF NOT EXISTS (SELECT 1 FROM departments WHERE name = ?)
            BEGIN
                SET IDENTITY_INSERT departments ON;
                INSERT INTO departments (id, name, code, description, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?);
                SET IDENTITY_INSERT departments OFF;
            END
        """, (
            dept["name"],
            dept["id"],
            dept["name"],
            dept.get("code"),
            dept.get("description"),
            dept.get("created_at", datetime.now()),
            dept.get("updated_at", datetime.now())
        ))
    
    sql_conn.commit()
    print(f"   ✅ 已迁移 {len(departments)} 条部门数据")

def migrate_employees(supabase: Client, sql_conn: pyodbc.Connection):
    """迁移员工表"""
    print("\n👤 开始迁移 employees 表...")
    
    response = supabase.table("employees").select("*").execute()
    employees = response.data
    
    if not employees:
        print("   ⚠️  Supabase 无员工数据，跳过")
        return
    
    cursor = sql_conn.cursor()
    
    for emp in employees:
        emp_id = convert_uuid(emp["id"])
        auth_user_id = convert_uuid(emp.get("auth_user_id"))
        
        cursor.execute("""
            IF NOT EXISTS (SELECT 1 FROM employees WHERE id = ?)
            BEGIN
                INSERT INTO employees (id, employee_id, name, department_id, email, position, auth_user_id, is_active, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            END
        """, (
            emp_id,
            emp_id,
            emp["employee_id"],
            emp["name"],
            emp.get("department_id"),
            emp.get("email"),
            emp.get("position"),
            auth_user_id,
            emp.get("is_active", True),
            emp.get("created_at", datetime.now()),
            emp.get("updated_at", datetime.now())
        ))
    
    sql_conn.commit()
    print(f"   ✅ 已迁移 {len(employees)} 条员工数据")

def migrate_skills(supabase: Client, sql_conn: pyodbc.Connection):
    """迁移技能表"""
    print("\n🛠️  开始迁移 skills 表...")
    
    response = supabase.table("skills").select("*").execute()
    skills = response.data
    
    if not skills:
        print("   ⚠️  Supabase 无技能数据，跳过")
        return
    
    cursor = sql_conn.cursor()
    
    for skill in skills:
        cursor.execute("""
            IF NOT EXISTS (SELECT 1 FROM skills WHERE id = ?)
            BEGIN
                SET IDENTITY_INSERT skills ON;
                INSERT INTO skills (id, module_id, module_name, skill_name, skill_code, description, display_order, is_active, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
                SET IDENTITY_INSERT skills OFF;
            END
        """, (
            skill["id"],
            skill["id"],
            skill["module_id"],
            skill["module_name"],
            skill["skill_name"],
            skill.get("skill_code"),
            skill.get("description"),
            skill.get("display_order", 0),
            skill.get("is_active", True),
            skill.get("created_at", datetime.now()),
            skill.get("updated_at", datetime.now())
        ))
    
    sql_conn.commit()
    print(f"   ✅ 已迁移 {len(skills)} 条技能数据")

def migrate_competency_assessments(supabase: Client, sql_conn: pyodbc.Connection):
    """迁移能力评估表"""
    print("\n📊 开始迁移 competency_assessments 表...")
    
    response = supabase.table("competency_assessments").select("*").execute()
    assessments = response.data
    
    if not assessments:
        print("   ⚠️  Supabase 无评估数据，跳过")
        return
    
    cursor = sql_conn.cursor()
    
    for assess in assessments:
        assess_id = convert_uuid(assess["id"])
        emp_id = convert_uuid(assess["employee_id"])
        
        cursor.execute("""
            IF NOT EXISTS (SELECT 1 FROM competency_assessments WHERE id = ?)
            BEGIN
                INSERT INTO competency_assessments (id, employee_id, skill_id, current_level, target_level, assessment_year, assessment_date, notes, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            END
        """, (
            assess_id,
            assess_id,
            emp_id,
            assess["skill_id"],
            assess["current_level"],
            assess["target_level"],
            assess.get("assessment_year", datetime.now().year),
            assess.get("assessment_date", datetime.now().date()),
            assess.get("notes"),
            assess.get("created_at", datetime.now()),
            assess.get("updated_at", datetime.now())
        ))
    
    sql_conn.commit()
    print(f"   ✅ 已迁移 {len(assessments)} 条评估数据")

def migrate_tasks(supabase: Client, sql_conn: pyodbc.Connection):
    """迁移任务表"""
    print("\n📅 开始迁移 tasks 表...")
    
    response = supabase.table("tasks").select("*").execute()
    tasks = response.data
    
    if not tasks:
        print("   ⚠️  Supabase 无任务数据，跳过")
        return
    
    cursor = sql_conn.cursor()
    
    for task in tasks:
        task_id = convert_uuid(task["id"])
        emp_id = convert_uuid(task.get("assigned_employee_id"))
        
        # 处理数组字段（PostgreSQL 的 TEXT[] 转为 JSON 字符串）
        required_skills = str(task.get("required_skills", [])) if task.get("required_skills") else None
        
        cursor.execute("""
            IF NOT EXISTS (SELECT 1 FROM tasks WHERE id = ?)
            BEGIN
                INSERT INTO tasks (id, task_name, task_type, task_location, assigned_employee_id, start_date, end_date, 
                                   days_count, hours_per_day, total_hours, source, status, is_cross_factory, 
                                   request_factory, required_skills, notes, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            END
        """, (
            task_id,
            task_id,
            task["task_name"],
            task["task_type"],
            task["task_location"],
            emp_id,
            task["start_date"],
            task["end_date"],
            task.get("days_count"),
            task.get("hours_per_day", 8),
            task.get("total_hours"),
            task.get("source", "manual"),
            task.get("status", "active"),
            task.get("is_cross_factory", False),
            task.get("request_factory"),
            required_skills,
            task.get("notes"),
            task.get("created_at", datetime.now()),
            task.get("updated_at", datetime.now())
        ))
    
    sql_conn.commit()
    print(f"   ✅ 已迁移 {len(tasks)} 条任务数据")

def migrate_resource_planning_tasks(supabase: Client, sql_conn: pyodbc.Connection):
    """迁移资源规划任务表"""
    print("\n📆 开始迁移 resource_planning_tasks 表...")
    
    response = supabase.table("resource_planning_tasks").select("*").execute()
    tasks = response.data
    
    if not tasks:
        print("   ⚠️  Supabase 无资源规划数据，跳过")
        return
    
    cursor = sql_conn.cursor()
    
    for task in tasks:
        task_id = convert_uuid(task["id"])
        emp_id = convert_uuid(task.get("employee_id"))
        
        cursor.execute("""
            IF NOT EXISTS (SELECT 1 FROM resource_planning_tasks WHERE id = ?)
            BEGIN
                INSERT INTO resource_planning_tasks (id, employee_id, task_topic, task_type, task_location, 
                                                     task_date, year_month, cw_week, day_of_month, week_start, week_end, 
                                                     status, notes, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            END
        """, (
            task_id,
            task_id,
            emp_id,
            task["task_topic"],
            task.get("task_type"),
            task.get("task_location"),
            task.get("task_date"),
            task.get("year_month"),
            task.get("cw_week"),
            task.get("day_of_month"),
            task.get("week_start"),
            task.get("week_end"),
            task.get("status", "planned"),
            task.get("notes"),
            task.get("created_at", datetime.now()),
            task.get("updated_at", datetime.now())
        ))
    
    sql_conn.commit()
    print(f"   ✅ 已迁移 {len(tasks)} 条资源规划任务数据")

def migrate_auth_users(supabase: Client, sql_conn: pyodbc.Connection):
    """迁移认证用户（从 Supabase Auth 到自建 users 表）"""
    print("\n🔐 开始迁移认证用户...")
    print("   ⚠️  注意：Supabase Auth 用户需要通过管理员API获取")
    print("   建议：首次迁移后，让用户通过OTP重新注册/激活账号")
    
    # 方案1：从 employees 表提取邮箱，创建未激活用户
    cursor = sql_conn.cursor()
    cursor.execute("SELECT DISTINCT email, name FROM employees WHERE email IS NOT NULL AND email != ''")
    employees_with_email = cursor.fetchall()
    
    if not employees_with_email:
        print("   ⚠️  员工表无邮箱数据，跳过用户创建")
        return
    
    for email, name in employees_with_email:
        cursor.execute("""
            IF NOT EXISTS (SELECT 1 FROM users WHERE email = ?)
            BEGIN
                INSERT INTO users (email, name, email_confirmed, is_active, created_at, updated_at)
                VALUES (?, ?, 0, 1, GETDATE(), GETDATE())
            END
        """, (email, email, name))
    
    sql_conn.commit()
    print(f"   ✅ 已为 {len(employees_with_email)} 个员工创建用户记录（邮箱未激活）")
    print("   💡 提示：用户首次登录时需通过OTP验证邮箱")

# ============================================================================
# 数据验证函数
# ============================================================================

def verify_migration(sql_conn: pyodbc.Connection):
    """验证迁移结果"""
    print("\n🔍 验证迁移结果...")
    
    cursor = sql_conn.cursor()
    
    tables = [
        "users",
        "departments",
        "employees",
        "skills",
        "competency_assessments",
        "tasks",
        "resource_planning_tasks"
    ]
    
    print("\n表名                          | 行数")
    print("-" * 50)
    
    for table in tables:
        cursor.execute(f"SELECT COUNT(*) FROM {table}")
        count = cursor.fetchone()[0]
        print(f"{table:30} | {count:,}")
    
    print("\n✅ 数据验证完成")

# ============================================================================
# 主函数
# ============================================================================

def main():
    print("=" * 60)
    print("🚀 Supabase → SQL Server 数据迁移工具")
    print("=" * 60)
    
    # 1. 初始化连接
    supabase = init_supabase()
    sql_conn = init_sqlserver()
    
    try:
        # 2. 执行迁移（按依赖顺序）
        migrate_departments(supabase, sql_conn)
        migrate_employees(supabase, sql_conn)
        migrate_auth_users(supabase, sql_conn)  # 基于 employees 创建 users
        migrate_skills(supabase, sql_conn)
        migrate_competency_assessments(supabase, sql_conn)
        migrate_tasks(supabase, sql_conn)
        migrate_resource_planning_tasks(supabase, sql_conn)
        
        # 3. 验证迁移结果
        verify_migration(sql_conn)
        
        print("\n" + "=" * 60)
        print("🎉 数据迁移完成！")
        print("=" * 60)
        print("\n下一步操作:")
        print("  1. 在 SQL Server 中检查数据完整性")
        print("  2. 更新前端 .env 配置（VITE_API_BASE_URL）")
        print("  3. 启动 FastAPI 后端服务")
        print("  4. 测试登录/注册功能")
        
    except Exception as e:
        print(f"\n❌ 迁移失败: {e}")
        sql_conn.rollback()
        sys.exit(1)
    
    finally:
        sql_conn.close()
        print("\n✅ 数据库连接已关闭")

if __name__ == "__main__":
    main()
