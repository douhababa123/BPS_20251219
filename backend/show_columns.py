"""检查数据库实际列名"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import pyodbc
from config import settings

def get_db_connection():
    connection_string = (
        f"DRIVER={{{settings.db_driver}}};"
        f"SERVER={settings.db_server};"
        f"DATABASE={settings.db_database};"
        f"UID={settings.db_username};"
        f"PWD={settings.db_password};"
        f"TrustServerCertificate=yes;"
    )
    return pyodbc.connect(connection_string)

def show_columns(table_name):
    conn = get_db_connection()
    cursor = conn.cursor()
    
    cursor.execute(f"""
        SELECT COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH
        FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_NAME = '{table_name}'
        ORDER BY ORDINAL_POSITION
    """)
    
    print(f"\n表: {table_name}")
    print("="*70)
    for row in cursor.fetchall():
        col_name, data_type, max_len = row
        length = f"({max_len})" if max_len else ""
        print(f"  {col_name:<40} {data_type}{length}")
    
    cursor.close()
    conn.close()

if __name__ == "__main__":
    show_columns('competency_definitions')
    show_columns('competency_assessments')
