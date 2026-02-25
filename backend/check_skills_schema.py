"""
检查 skills 表结构
Phase 3.3 准备工作
"""

from database import db

def check_skills_schema():
    """检查 skills 表的结构"""
    
    with db.get_cursor() as cursor:
        # 1. 查询表字段
        cursor.execute("""
            SELECT 
                COLUMN_NAME,
                DATA_TYPE,
                CHARACTER_MAXIMUM_LENGTH,
                IS_NULLABLE,
                COLUMN_DEFAULT
            FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_NAME = 'skills'
            ORDER BY ORDINAL_POSITION
        """)
        
        print("\n📋 skills 表字段:")
        print("-" * 80)
        for row in cursor.fetchall():
            col_name = row[0]
            data_type = row[1]
            max_len = f"({row[2]})" if row[2] else ""
            nullable = "NULL" if row[3] == 'YES' else "NOT NULL"
            default = f" DEFAULT {row[4]}" if row[4] else ""
            print(f"  {col_name:20s} {data_type}{max_len:15s} {nullable:10s}{default}")
        
        # 2. 检查是否有 is_active 字段
        cursor.execute("""
            SELECT COUNT(*) 
            FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_NAME = 'skills' AND COLUMN_NAME = 'is_active'
        """)
        
        if cursor.fetchone()[0] > 0:
            print("\n✅ skills 表已有 is_active 字段")
        else:
            print("\n⚠️ skills 表缺少 is_active 字段 (需要添加)")
        
        # 3. 检查外键约束
        cursor.execute("""
            SELECT 
                fk.name AS FK_Name,
                OBJECT_NAME(fk.parent_object_id) AS Table_Name,
                COL_NAME(fkc.parent_object_id, fkc.parent_column_id) AS Column_Name,
                OBJECT_NAME(fk.referenced_object_id) AS Referenced_Table,
                COL_NAME(fkc.referenced_object_id, fkc.referenced_column_id) AS Referenced_Column
            FROM sys.foreign_keys AS fk
            INNER JOIN sys.foreign_key_columns AS fkc 
                ON fk.object_id = fkc.constraint_object_id
            WHERE OBJECT_NAME(fk.parent_object_id) = 'skills'
        """)
        
        fk_rows = cursor.fetchall()
        print(f"\n🔗 外键约束 ({len(fk_rows)} 个):")
        print("-" * 80)
        if fk_rows:
            for row in fk_rows:
                print(f"  {row[0]}: {row[2]} -> {row[3]}.{row[4]}")
        else:
            print("  (无外键约束)")
        
        # 4. 检查主键类型
        cursor.execute("""
            SELECT 
                c.name,
                t.name AS data_type,
                c.is_identity
            FROM sys.columns c
            JOIN sys.types t ON c.user_type_id = t.user_type_id
            WHERE c.object_id = OBJECT_ID('skills')
            AND c.name = 'id'
        """)
        
        pk_row = cursor.fetchone()
        if pk_row:
            is_identity = "IDENTITY (自增)" if pk_row[2] else "NOT IDENTITY"
            print(f"\n🔑 主键类型:")
            print(f"  id: {pk_row[1]} ({is_identity})")
        
        # 5. 查询示例数据
        cursor.execute("""
            SELECT TOP 3 
                id, module_id, module_name, skill_name, display_order, is_active
            FROM skills
            ORDER BY module_id, display_order
        """)
        
        print(f"\n📊 示例数据 (前3条):")
        print("-" * 80)
        for row in cursor.fetchall():
            print(f"  ID={row[0]}, module_id={row[1]}, module={row[2]}, skill={row[3]}, order={row[4]}, active={row[5]}")

if __name__ == "__main__":
    check_skills_schema()
