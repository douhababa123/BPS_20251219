"""
检查SQL Server数据库中skill表的module_name统计
统计不重复的技能数量
"""

import pyodbc
import sys

# SQL Server连接配置（根据backend/config.py）
connection_string = (
    "DRIVER={ODBC Driver 17 for SQL Server};"
    "SERVER=10.88.43.154;"
    "DATABASE=DCCT_BPS_Debug;"
    "UID=TEST;"
    "PWD=123456;"
    "TrustServerCertificate=yes;"
)

def check_skill_modules():
    """统计skill表中不重复的module_name数量"""
    try:
        # 连接数据库
        print("🔌 正在连接SQL Server数据库...")
        conn = pyodbc.connect(connection_string, timeout=10)
        cursor = conn.cursor()
        print("✅ 数据库连接成功！\n")
        
        # 查询1: 统计不重复的module_name数量
        print("=" * 60)
        print("📊 统计不重复的module_name数量")
        print("=" * 60)
        
        query_count = """
        SELECT COUNT(DISTINCT module_name) as unique_module_count
        FROM skills
        WHERE module_name IS NOT NULL
        """
        
        cursor.execute(query_count)
        result = cursor.fetchone()
        unique_count = result[0] if result else 0
        
        print(f"\n✅ 不重复的技能（module_name）总数: {unique_count}\n")
        
        # 查询2: 列出所有不重复的module_name
        print("=" * 60)
        print("📋 所有不重复的module_name列表")
        print("=" * 60)
        
        query_list = """
        SELECT DISTINCT module_name, COUNT(*) as count
        FROM skills
        WHERE module_name IS NOT NULL
        GROUP BY module_name
        ORDER BY module_name
        """
        
        cursor.execute(query_list)
        rows = cursor.fetchall()
        
        if rows:
            print(f"\n{'序号':<6} {'技能名称':<30} {'出现次数':<10}")
            print("-" * 60)
            for idx, row in enumerate(rows, 1):
                module_name = row[0]
                count = row[1]
                print(f"{idx:<6} {module_name:<30} {count:<10}")
            print("-" * 60)
            print(f"总计: {len(rows)} 个不重复的技能\n")
        else:
            print("\n⚠️  skill表中没有数据\n")
        
        # 查询3: 统计skill表总记录数
        print("=" * 60)
        print("📈 skill表统计信息")
        print("=" * 60)
        
        query_total = """
        SELECT 
            COUNT(*) as total_records,
            COUNT(DISTINCT module_name) as unique_modules,
            COUNT(DISTINCT skill_name) as unique_skills
        FROM skills
        """
        
        cursor.execute(query_total)
        stats = cursor.fetchone()
        
        if stats:
            print(f"\n总记录数: {stats[0]}")
            print(f"不重复的module_name: {stats[1]}")
            print(f"不重复的skill_name: {stats[2]}\n")
        
        # 关闭连接
        cursor.close()
        conn.close()
        print("✅ 查询完成！")
        
    except pyodbc.Error as e:
        print(f"\n❌ 数据库错误: {e}")
        sys.exit(1)
    except Exception as e:
        print(f"\n❌ 发生错误: {e}")
        sys.exit(1)

if __name__ == "__main__":
    check_skill_modules()
