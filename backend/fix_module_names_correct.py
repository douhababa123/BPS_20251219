"""
修复模块名称 - 根据文档中的9大模块定义
"""

import pyodbc
import sys
sys.path.append('.')
from config import Settings

settings = Settings()

# 根据文档中的9大模块定义（必须精确匹配）
MODULE_MAPPING = {
    1: "BPS elements",
    2: "Investment efficiency_PGL",
    3: "Waste-free, stable flow_IE",
    4: "Waste-free, stable flow_TPM",
    5: "Waste-free, stable flow_LBP",
    6: "Everybody's CIP",
    7: "Leadership commitment",
    8: "CIP in indirect area_LEAN",
    9: "Digital Transformation"
}

def main():
    print("🔧 开始修复模块名称...")
    
    # 连接数据库
    conn = pyodbc.connect(
        f"DRIVER={{ODBC Driver 17 for SQL Server}};"
        f"SERVER={settings.db_server};"
        f"DATABASE={settings.db_database};"
        f"UID={settings.db_username};"
        f"PWD={settings.db_password}"
    )
    cursor = conn.cursor()
    
    # 更新每个module_id的名称
    for module_id, module_name in MODULE_MAPPING.items():
        cursor.execute(
            "UPDATE skills SET module_name = ? WHERE module_id = ?",
            (module_name, module_id)
        )
        affected = cursor.rowcount
        print(f"  ✅ Module ID {module_id}: 更新了 {affected} 条记录 → {module_name}")
    
    # 提交更改
    conn.commit()
    print("\n✅ 所有模块名称已更新")
    
    # 验证结果
    print("\n📊 验证唯一模块名称:")
    cursor.execute("""
        SELECT DISTINCT module_name 
        FROM skills 
        ORDER BY module_name
    """)
    modules = cursor.fetchall()
    print(f"\n共有 {len(modules)} 个唯一模块:")
    for idx, (module_name,) in enumerate(modules, 1):
        print(f"  {idx}. {module_name}")
    
    if len(modules) == 9:
        print("\n🎉 完美！正好9个模块")
    else:
        print(f"\n⚠️ 警告：发现 {len(modules)} 个模块，预期是9个")
    
    cursor.close()
    conn.close()

if __name__ == "__main__":
    main()
