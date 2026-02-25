"""检查 employees 表结构"""
from database import db

print("=" * 60)
print("检查 employees 表结构")
print("=" * 60)

with db.get_cursor() as cursor:
    # 获取列信息
    cursor.execute("""
        SELECT 
            COLUMN_NAME,
            DATA_TYPE,
            CHARACTER_MAXIMUM_LENGTH,
            IS_NULLABLE,
            COLUMNPROPERTY(OBJECT_ID(TABLE_SCHEMA + '.' + TABLE_NAME), COLUMN_NAME, 'IsIdentity') as IsIdentity
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_NAME = 'employees'
        ORDER BY ORDINAL_POSITION
    """)
    
    columns = cursor.fetchall()
    
    print(f"\n表字段 ({len(columns)} 个):")
    print("-" * 60)
    for col in columns:
        name = col[0]
        dtype = col[1]
        length = col[2] if col[2] else ''
        nullable = col[3]
        is_identity = col[4]
        print(f"{name}: {dtype}{f'({length})' if length else ''}, Nullable:{nullable}, IsIdentity:{is_identity}")
    
    # 检查是否有 is_active 字段
    has_is_active = any(col[0] == 'is_active' for col in columns)
    
    print("\n" + "=" * 60)
    if has_is_active:
        print("✅ employees 表已有 is_active 字段")
    else:
        print("❌ employees 表缺少 is_active 字段，需要添加")
    print("=" * 60)
    
    # 检查外键约束
    cursor.execute("""
        SELECT 
            fk.name AS ForeignKey,
            OBJECT_NAME(fk.parent_object_id) AS TableName,
            COL_NAME(fkc.parent_object_id, fkc.parent_column_id) AS ColumnName,
            OBJECT_NAME(fk.referenced_object_id) AS ReferencedTable,
            COL_NAME(fkc.referenced_object_id, fkc.referenced_column_id) AS ReferencedColumn
        FROM sys.foreign_keys AS fk
        INNER JOIN sys.foreign_key_columns AS fkc
            ON fk.object_id = fkc.constraint_object_id
        WHERE OBJECT_NAME(fk.parent_object_id) = 'employees'
    """)
    
    fks = cursor.fetchall()
    if fks:
        print(f"\n外键约束 ({len(fks)} 个):")
        print("-" * 60)
        for fk in fks:
            print(f"{fk[0]}: {fk[2]} -> {fk[3]}.{fk[4]}")
