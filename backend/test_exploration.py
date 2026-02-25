"""
探索性测试脚本 - 检查 4 个核心模块的数据库状态和 API
"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import pyodbc
from config import settings
import requests

def get_db_connection():
    """创建数据库连接"""
    connection_string = (
        f"DRIVER={{{settings.db_driver}}};"
        f"SERVER={settings.db_server};"
        f"DATABASE={settings.db_database};"
        f"UID={settings.db_username};"
        f"PWD={settings.db_password};"
        f"TrustServerCertificate=yes;"
    )
    return pyodbc.connect(connection_string)

def test_database():
    """测试数据库表数据"""
    print("\n" + "="*60)
    print("📊 数据库探索性测试")
    print("="*60 + "\n")
    
    conn = get_db_connection()
    cursor = conn.cursor()
    
    tables = {
        'competency_definitions': '能力定义',
        'competency_assessments': '能力评估',
        'tasks': '任务',
        'schedule_change_notifications': '日程变更通知'
    }
    
    for table, name in tables.items():
        try:
            cursor.execute(f'SELECT COUNT(*) FROM dbo.{table}')
            count = cursor.fetchone()[0]
            print(f"✅ {name} ({table}): {count} 条记录")
            
            # 获取列信息
            cursor.execute(f"""
                SELECT COLUMN_NAME, DATA_TYPE 
                FROM INFORMATION_SCHEMA.COLUMNS 
                WHERE TABLE_NAME = '{table}'
                ORDER BY ORDINAL_POSITION
            """)
            columns = cursor.fetchall()
            col_names = [col[0] for col in columns[:5]]
            print(f"   列字段: {', '.join(col_names)}...")
            
            # 获取示例数据
            if count > 0:
                cursor.execute(f'SELECT TOP 1 * FROM dbo.{table}')
                row = cursor.fetchone()
                print(f"   示例ID: {row[0]}")
            
        except Exception as e:
            print(f"❌ {name} ({table}): 错误 - {str(e)}")
        print()
    
    cursor.close()
    conn.close()

def test_api_endpoints():
    """测试 API 端点"""
    print("\n" + "="*60)
    print("🌐 API 端点探索性测试")
    print("="*60 + "\n")
    
    base_url = "http://localhost:8000/api"
    endpoints = {
        '/competency-definitions': '能力定义',
        '/competency-assessments': '能力评估',
        '/tasks': '任务',
        '/schedule-change-notifications': '日程变更通知'
    }
    
    for endpoint, name in endpoints.items():
        try:
            response = requests.get(f"{base_url}{endpoint}", timeout=5)
            if response.status_code == 200:
                data = response.json()
                count = len(data) if isinstance(data, list) else 1
                print(f"✅ {name}: HTTP {response.status_code}, {count} 条记录")
                if count > 0 and isinstance(data, list):
                    keys = list(data[0].keys())[:5]
                    print(f"   返回字段: {', '.join(keys)}...")
            else:
                print(f"❌ {name}: HTTP {response.status_code}")
                if response.text:
                    error = response.json() if 'application/json' in response.headers.get('content-type', '') else response.text[:100]
                    print(f"   错误: {error}")
        except Exception as e:
            print(f"❌ {name}: {str(e)}")
        print()

if __name__ == "__main__":
    print("\n🧪 开始探索性测试...")
    test_database()
    test_api_endpoints()
    print("="*60)
    print("✅ 探索性测试完成")
    print("="*60 + "\n")
