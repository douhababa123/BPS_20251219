"""
测试数据库中的技能和评估数据
"""
import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

from database import Database

def test_data():
    """测试数据"""
    db = Database()
    conn = db.connect()
    cursor = conn.cursor()
    
    try:
        # 检查技能数据
        print("=" * 70)
        print("📊 检查技能表数据")
        print("=" * 70)
        cursor.execute("""
            SELECT COUNT(*) as total,
                   COUNT(DISTINCT module_id) as modules,
                   COUNT(DISTINCT module_name) as module_names
            FROM dbo.skills
            WHERE is_active = 1
        """)
        stats = cursor.fetchone()
        print(f"✅ 技能总数: {stats[0]}")
        print(f"✅ 模块数量: {stats[1]}")
        print(f"✅ 模块名称数: {stats[2]}")
        
        # 显示前5条技能
        cursor.execute("""
            SELECT TOP 5 id, module_id, module_name, skill_name, display_order
            FROM dbo.skills
            WHERE is_active = 1
            ORDER BY display_order
        """)
        print("\n前5条技能数据:")
        for row in cursor.fetchall():
            print(f"  ID: {row[0]}, 模块: {row[1]}-{row[2]}, 技能: {row[3]}, 顺序: {row[4]}")
        
        # 检查评估数据
        print("\n" + "=" * 70)
        print("📊 检查评估表数据")
        print("=" * 70)
        cursor.execute("""
            SELECT COUNT(*) as total,
                   COUNT(DISTINCT employee_id) as employees,
                   COUNT(DISTINCT skill_id) as skills
            FROM dbo.competency_assessments
        """)
        stats = cursor.fetchone()
        print(f"✅ 评估记录总数: {stats[0]}")
        print(f"✅ 员工数量: {stats[1]}")
        print(f"✅ 技能数量: {stats[2]}")
        
        # 显示前3条评估
        cursor.execute("""
            SELECT TOP 3 
                ca.id,
                e.name as employee_name,
                s.skill_name,
                ca.current_level,
                ca.target_level,
                ca.gap
            FROM dbo.competency_assessments ca
            LEFT JOIN dbo.employees e ON ca.employee_id = e.id
            LEFT JOIN dbo.skills s ON ca.skill_id = s.id
            ORDER BY ca.created_at DESC
        """)
        print("\n前3条评估数据:")
        for row in cursor.fetchall():
            print(f"  ID: {row[0]}, 员工: {row[1]}, 技能: {row[2]}, 当前: {row[3]}, 目标: {row[4]}, 差距: {row[5]}")
        
        # 检查员工数据
        print("\n" + "=" * 70)
        print("📊 检查员工表数据")
        print("=" * 70)
        cursor.execute("""
            SELECT COUNT(*) as total,
                   COUNT(DISTINCT department_id) as departments
            FROM dbo.employees
            WHERE is_active = 1
        """)
        stats = cursor.fetchone()
        print(f"✅ 员工总数: {stats[0]}")
        print(f"✅ 部门数量: {stats[1]}")
        
        # 检查部门数据
        print("\n" + "=" * 70)
        print("📊 检查部门表数据")
        print("=" * 70)
        cursor.execute("""
            SELECT COUNT(*) as total
            FROM dbo.departments
        """)
        total = cursor.fetchone()[0]
        print(f"✅ 部门总数: {total}")
        
        cursor.execute("""
            SELECT TOP 5 id, name, code
            FROM dbo.departments
        """)
        print("\n前5个部门:")
        for row in cursor.fetchall():
            print(f"  ID: {row[0]}, 名称: {row[1]}, 代码: {row[2]}")
        
        print("\n" + "=" * 70)
        print("✅ 数据检查完成！")
        print("=" * 70)
        
    except Exception as e:
        print(f"❌ 检查失败: {e}")
        import traceback
        traceback.print_exc()
    finally:
        cursor.close()
        conn.close()

if __name__ == "__main__":
    test_data()
