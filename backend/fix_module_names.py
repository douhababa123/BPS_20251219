"""
修复skills表中的module_name不一致问题
统一使用中文模块名称
"""
import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

from database import Database

# 9大模块的正确中文名称映射
MODULE_NAME_MAP = {
    1: 'BPS elements',
    2: 'Investment efficiency (PGL/IE)',  
    3: 'Investment efficiency (PGL/IE)',
    4: 'Waste-free & stable flow (TPM/LBP)',
    5: 'Waste-free & stable flow (TPM/LBP)', 
    6: "Everybody's CIP",
    7: 'Leadership commitment',
    8: 'CIP in indirect area (LEAN)',
    9: 'Digital Transformation'
}

def fix_module_names():
    """修复模块名称"""
    db = Database()
    conn = db.connect()
    cursor = conn.cursor()
    
    try:
        print("\n🔧 开始修复module_name...")
        print("=" * 80)
        
        # 查看修复前的状态
        cursor.execute("""
            SELECT DISTINCT module_id, module_name
            FROM dbo.skills
            WHERE is_active = 1
            ORDER BY module_id, module_name
        """)
        
        print("\n📋 修复前的模块列表：")
        for module_id, module_name in cursor.fetchall():
            print(f"  Module ID: {module_id} | Name: {module_name}")
        
        # 执行修复 - 为每个module_id统一使用正确的名称
        for module_id, correct_name in MODULE_NAME_MAP.items():
            cursor.execute("""
                UPDATE dbo.skills
                SET module_name = ?
                WHERE module_id = ? AND is_active = 1
            """, correct_name, module_id)
            
            updated = cursor.rowcount
            if updated > 0:
                print(f"\n✅ Module ID {module_id}: 更新 {updated} 条记录 → {correct_name}")
        
        conn.commit()
        print("\n" + "=" * 80)
        print("✅ module_name 修复完成！")
        
        # 查看修复后的状态
        cursor.execute("""
            SELECT DISTINCT module_id, module_name
            FROM dbo.skills
            WHERE is_active = 1
            ORDER BY module_id
        """)
        
        print("\n📋 修复后的模块列表（应该只有9个）：")
        modules = cursor.fetchall()
        for i, (module_id, module_name) in enumerate(modules, 1):
            # 统计该模块的技能数
            cursor.execute("""
                SELECT COUNT(*) 
                FROM dbo.skills 
                WHERE module_id = ? AND is_active = 1
            """, module_id)
            skill_count = cursor.fetchone()[0]
            
            print(f"{i}. Module ID: {module_id} | Name: {module_name} | Skills: {skill_count}")
        
        print("\n" + "=" * 80)
        print(f"📊 总计: {len(modules)} 个模块")
        
        if len(modules) != 9:
            print(f"\n⚠️ 警告: 期望9个模块，实际有 {len(modules)} 个")
        else:
            print("\n🎉 完美！正好9个模块")
        
    except Exception as e:
        print(f"❌ 修复失败: {e}")
        conn.rollback()
    finally:
        cursor.close()
        conn.close()

if __name__ == "__main__":
    fix_module_names()
