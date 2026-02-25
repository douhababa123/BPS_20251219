import pyodbc

conn = pyodbc.connect(
    'DRIVER={ODBC Driver 17 for SQL Server};'
    'SERVER=10.88.43.154;'
    'DATABASE=DCCT_BPS_Debug;'
    'UID=TEST;'
    'PWD=123456'
)

cursor = conn.cursor()

print("\n执行导入前修复SQL...")
print("=" * 60)

# 1. 删除 skills 表的唯一约束
try:
    cursor.execute("""
        IF EXISTS (SELECT * FROM sys.key_constraints WHERE name = 'uq_skills_code')
        BEGIN
            ALTER TABLE dbo.skills DROP CONSTRAINT uq_skills_code;
        END
    """)
    conn.commit()
    print("✅ 已删除 skills 表的唯一约束 uq_skills_code")
except Exception as e:
    print(f"ℹ️  删除约束时出错: {e}")
    conn.rollback()

# 2. 删除唯一索引（如果存在）
try:
    cursor.execute("""
        IF EXISTS (SELECT * FROM sys.indexes WHERE name = 'uq_skills_code')
        BEGIN
            DROP INDEX uq_skills_code ON dbo.skills;
        END
    """)
    conn.commit()
    print("✅ 已删除 skills 表的唯一索引 uq_skills_code")
except Exception as e:
    print(f"ℹ️  删除索引时出错: {e}")
    conn.rollback()

# 3. 修改 tasks 表的 task_type 列允许 NULL
try:
    cursor.execute("""
        SELECT IS_NULLABLE 
        FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_NAME = 'tasks' AND COLUMN_NAME = 'task_type'
    """)
    result = cursor.fetchone()
    if result and result[0] == 'NO':
        cursor.execute("ALTER TABLE dbo.tasks ALTER COLUMN task_type NVARCHAR(50) NULL")
        conn.commit()
        print("✅ 已修改 tasks.task_type 列允许 NULL")
    else:
        print("ℹ️  tasks.task_type 列已经允许 NULL")
except Exception as e:
    print(f"ℹ️  修改列时出错: {e}")
    conn.rollback()

print("\n✅ 临时修复完成，可以开始导入数据")
print("=" * 60)

conn.close()
