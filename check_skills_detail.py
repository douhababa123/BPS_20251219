"""
详细检查SQL Server数据库中skill表的数据
对比期望数据和实际数据
"""

import pyodbc
import sys

# SQL Server连接配置
connection_string = (
    "DRIVER={ODBC Driver 17 for SQL Server};"
    "SERVER=10.88.43.154;"
    "DATABASE=DCCT_BPS_Debug;"
    "UID=TEST;"
    "PWD=123456;"
    "TrustServerCertificate=yes;"
)

# 期望的module_name数量
EXPECTED_COUNTS = {
    'BPS elements': 5,
    'Investment efficiency_PGL': 5,
    'Investment efficiency_IE': 4,
    'Waste-free&stable flow_TPM': 5,
    'Waste-free&stable flow_LBP': 5,
    "Everybody's CIP": 3,
    'Leadership commitment': 5,
    'CIP in indirect area_LEAN': 5,
    'Digital Transformation': 2,
}

def check_skills_detail():
    """详细检查skills表数据"""
    try:
        # 连接数据库
        print("🔌 正在连接SQL Server数据库...")
        conn = pyodbc.connect(connection_string, timeout=10)
        cursor = conn.cursor()
        print("✅ 数据库连接成功！\n")
        
        # 查询1: 统计每个module_name的数量
        print("=" * 80)
        print("📊 对比期望数据 vs 实际数据")
        print("=" * 80)
        
        query = """
        SELECT module_name, COUNT(*) as count
        FROM skills
        WHERE module_name IN (
            'BPS elements',
            'Investment efficiency_PGL',
            'Investment efficiency_IE',
            'Waste-free&stable flow_TPM',
            'Waste-free&stable flow_LBP',
            'Everybody''s CIP',
            'Leadership commitment',
            'CIP in indirect area_LEAN',
            'Digital Transformation'
        )
        GROUP BY module_name
        ORDER BY module_name
        """
        
        cursor.execute(query)
        actual_data = {row[0]: row[1] for row in cursor.fetchall()}
        
        print(f"\n{'Module Name':<35} {'期望':<10} {'实际':<10} {'状态':<15}")
        print("-" * 80)
        
        has_issues = False
        for module_name, expected_count in EXPECTED_COUNTS.items():
            actual_count = actual_data.get(module_name, 0)
            if actual_count == expected_count:
                status = "✅ 正确"
            elif actual_count < expected_count:
                status = f"❌ 缺少 {expected_count - actual_count}"
                has_issues = True
            else:
                status = f"⚠️  多了 {actual_count - expected_count}"
                has_issues = True
            
            print(f"{module_name:<35} {expected_count:<10} {actual_count:<10} {status:<15}")
        
        print("-" * 80)
        
        if not has_issues:
            print("\n✅ 所有英文module_name数据正确！")
        else:
            print("\n❌ 发现数据不一致！")
        
        # 查询2: 显示所有skills表数据
        print("\n" + "=" * 80)
        print("📋 skills表完整数据（英文module_name）")
        print("=" * 80)
        
        query_detail = """
        SELECT id, module_id, module_name, skill_name, skill_code, display_order, is_active
        FROM skills
        WHERE module_name IN (
            'BPS elements',
            'Investment efficiency_PGL',
            'Investment efficiency_IE',
            'Waste-free&stable flow_TPM',
            'Waste-free&stable flow_LBP',
            'Everybody''s CIP',
            'Leadership commitment',
            'CIP in indirect area_LEAN',
            'Digital Transformation'
        )
        ORDER BY module_name, display_order
        """
        
        cursor.execute(query_detail)
        rows = cursor.fetchall()
        
        current_module = None
        print()
        for row in rows:
            id, module_id, module_name, skill_name, skill_code, display_order, is_active = row
            
            if module_name != current_module:
                if current_module is not None:
                    print()
                print(f"\n【{module_name}】 (期望: {EXPECTED_COUNTS.get(module_name, '?')} 条)")
                print("-" * 80)
                current_module = module_name
            
            active_status = "✅" if is_active else "❌"
            print(f"  {id:<5} | 模块ID:{module_id:<3} | {skill_name:<40} | {skill_code or 'N/A':<15} | 顺序:{display_order:<3} | {active_status}")
        
        # 查询3: 检查是否有重复的skill_name
        print("\n" + "=" * 80)
        print("🔍 检查重复的skill_name")
        print("=" * 80)
        
        query_duplicates = """
        SELECT module_name, skill_name, COUNT(*) as count
        FROM skills
        WHERE module_name IN (
            'BPS elements',
            'Investment efficiency_PGL',
            'Investment efficiency_IE',
            'Waste-free&stable flow_TPM',
            'Waste-free&stable flow_LBP',
            'Everybody''s CIP',
            'Leadership commitment',
            'CIP in indirect area_LEAN',
            'Digital Transformation'
        )
        GROUP BY module_name, skill_name
        HAVING COUNT(*) > 1
        ORDER BY module_name, skill_name
        """
        
        cursor.execute(query_duplicates)
        duplicates = cursor.fetchall()
        
        if duplicates:
            print("\n⚠️  发现重复的skill_name:")
            for row in duplicates:
                print(f"  {row[0]} - {row[1]}: {row[2]} 次")
        else:
            print("\n✅ 没有重复的skill_name")
        
        # 查询4: 检查所有module_name（包括中文）
        print("\n" + "=" * 80)
        print("📊 所有module_name统计（包括中文）")
        print("=" * 80)
        
        query_all = """
        SELECT module_name, COUNT(*) as count
        FROM skills
        GROUP BY module_name
        ORDER BY module_name
        """
        
        cursor.execute(query_all)
        all_modules = cursor.fetchall()
        
        print(f"\n{'Module Name':<35} {'记录数':<10}")
        print("-" * 80)
        for row in all_modules:
            print(f"{row[0]:<35} {row[1]:<10}")
        print("-" * 80)
        print(f"总计: {len(all_modules)} 个不同的module_name")
        
        # 关闭连接
        cursor.close()
        conn.close()
        print("\n✅ 检查完成！")
        
    except pyodbc.Error as e:
        print(f"\n❌ 数据库错误: {e}")
        sys.exit(1)
    except Exception as e:
        print(f"\n❌ 发生错误: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

if __name__ == "__main__":
    check_skills_detail()
