"""
检查缺失模块的数据情况
"""

import pyodbc
import sys
sys.path.append('.')
from config import Settings

settings = Settings()

def main():
    print("🔍 检查缺失模块的数据情况...")
    
    # 连接数据库
    conn = pyodbc.connect(
        f"DRIVER={{ODBC Driver 17 for SQL Server}};"
        f"SERVER={settings.db_server};"
        f"DATABASE={settings.db_database};"
        f"UID={settings.db_username};"
        f"PWD={settings.db_password}"
    )
    cursor = conn.cursor()
    
    # 检查所有模块的技能数量
    print("\n📊 所有模块的技能数量:")
    cursor.execute("""
        SELECT module_id, module_name, COUNT(*) as skill_count
        FROM skills
        GROUP BY module_id, module_name
        ORDER BY module_id
    """)
    skills_by_module = cursor.fetchall()
    for module_id, module_name, count in skills_by_module:
        print(f"  Module {module_id}: {module_name} - {count} 个技能")
    
    # 检查每个模块对应的评估数据数量
    print("\n📊 每个模块的评估数据数量:")
    cursor.execute("""
        SELECT s.module_id, s.module_name, COUNT(DISTINCT ca.employee_id) as employee_count, COUNT(*) as assessment_count
        FROM skills s
        LEFT JOIN competency_assessments ca ON s.id = ca.skill_id
        GROUP BY s.module_id, s.module_name
        ORDER BY s.module_id
    """)
    assessments_by_module = cursor.fetchall()
    for module_id, module_name, emp_count, assess_count in assessments_by_module:
        print(f"  Module {module_id}: {module_name}")
        print(f"    - {emp_count} 个员工有评估")
        print(f"    - {assess_count} 条评估记录")
    
    # 特别检查缺失的两个模块
    print("\n🔍 详细检查缺失的两个模块:")
    
    missing_modules = [
        "CIP in indirect area_LEAN",
        "Digital Transformation"
    ]
    
    for module_name in missing_modules:
        print(f"\n--- {module_name} ---")
        
        # 检查技能
        cursor.execute("""
            SELECT id, skill_name, display_order
            FROM skills
            WHERE module_name = ?
            ORDER BY display_order
        """, (module_name,))
        skills = cursor.fetchall()
        print(f"  技能数量: {len(skills)}")
        for skill_id, skill_name, display_order in skills:
            print(f"    - Skill ID {skill_id}: {skill_name} (显示顺序: {display_order})")
        
        # 检查评估数据
        cursor.execute("""
            SELECT ca.employee_id, e.name, s.skill_name, ca.current_level, ca.target_level
            FROM competency_assessments ca
            JOIN skills s ON ca.skill_id = s.id
            JOIN employees e ON ca.employee_id = e.id
            WHERE s.module_name = ?
        """, (module_name,))
        assessments = cursor.fetchall()
        print(f"  评估数据数量: {len(assessments)}")
        if assessments:
            print("  前5条记录:")
            for i, (emp_id, emp_name, skill_name, current, target) in enumerate(assessments[:5], 1):
                print(f"    {i}. {emp_name} - {skill_name}: C={current}, T={target}")
    
    cursor.close()
    conn.close()

if __name__ == "__main__":
    main()
