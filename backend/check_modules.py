"""
检查数据库中的模块数据
"""
import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

from database import Database

def check_modules():
    """检查模块数据"""
    db = Database()
    conn = db.connect()
    cursor = conn.cursor()
    
    try:
        # 查询所有不同的模块
        cursor.execute("""
            SELECT DISTINCT module_id, module_name
            FROM dbo.skills
            WHERE is_active = 1
            ORDER BY module_id
        """)
        
        modules = cursor.fetchall()
        
        print(f"\n📊 数据库中的模块列表（共 {len(modules)} 个）：")
        print("=" * 80)
        for i, (module_id, module_name) in enumerate(modules, 1):
            # 统计该模块下的技能数量
            cursor.execute("""
                SELECT COUNT(*) 
                FROM dbo.skills 
                WHERE module_id = ? AND is_active = 1
            """, module_id)
            skill_count = cursor.fetchone()[0]
            
            print(f"{i}. Module ID: {module_id} | Name: {module_name} | Skills: {skill_count}")
        
        print("=" * 80)
        
        # 检查是否有评估数据
        print("\n📋 检查评估数据...")
        cursor.execute("""
            SELECT COUNT(*) as total,
                   COUNT(DISTINCT employee_id) as employees,
                   COUNT(DISTINCT skill_id) as skills
            FROM dbo.competency_assessments
        """)
        
        total, employees, skills_count = cursor.fetchone()
        print(f"评估记录总数: {total}")
        print(f"涉及员工数: {employees}")
        print(f"涉及技能数: {skills_count}")
        
        # 按模块统计评估数据
        print("\n📊 按模块统计评估数据：")
        cursor.execute("""
            SELECT s.module_id, s.module_name, COUNT(DISTINCT ca.id) as assessment_count
            FROM dbo.skills s
            LEFT JOIN dbo.competency_assessments ca ON s.id = ca.skill_id
            WHERE s.is_active = 1
            GROUP BY s.module_id, s.module_name
            ORDER BY s.module_id
        """)
        
        for module_id, module_name, count in cursor.fetchall():
            print(f"  {module_name} (ID: {module_id}): {count} 条评估")
        
    except Exception as e:
        print(f"❌ 查询失败: {e}")
    finally:
        cursor.close()
        conn.close()

if __name__ == "__main__":
    check_modules()
