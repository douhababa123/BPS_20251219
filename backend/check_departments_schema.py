"""检查 departments 表结构"""
from database import db

with db.get_cursor() as cursor:
    # 查询表结构
    cursor.execute("""
        SELECT 
            COLUMN_NAME, 
            DATA_TYPE, 
            CHARACTER_MAXIMUM_LENGTH,
            IS_NULLABLE,
            COLUMNPROPERTY(OBJECT_ID('departments'), COLUMN_NAME, 'IsIdentity') as IsIdentity
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_NAME = 'departments'
        ORDER BY ORDINAL_POSITION
    """)
    
    print("departments 表结构:")
    print("=" * 80)
    for row in cursor.fetchall():
        print(f"{row[0]:20} {row[1]:15} MaxLen:{row[2]} Nullable:{row[3]} IsIdentity:{row[4]}")
