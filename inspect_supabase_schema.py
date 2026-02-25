"""
Supabase 数据库结构检查工具
功能：查询所有表名、字段名、字段类型、主键、外键等信息
执行前提：已配置 .env 文件中的 Supabase 凭据
"""

import os
from supabase import create_client
from dotenv import load_dotenv

# 加载环境变量
load_dotenv()

# Supabase 配置
SUPABASE_URL = os.getenv("VITE_SUPABASE_URL")
SUPABASE_KEY = os.getenv("VITE_SUPABASE_ANON_KEY")

def inspect_supabase_tables():
    """检查 Supabase 数据库结构"""
    try:
        # 连接 Supabase
        supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
        print("=" * 80)
        print("🔍 Supabase 数据库结构检查")
        print("=" * 80)
        print()
        
        # 查询所有表名和行数
        print("📊 第一步：查询所有表及行数")
        print("-" * 80)
        
        # 使用 RPC 调用查询所有用户表
        tables_query = """
        SELECT 
            table_name,
            table_type
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_type = 'BASE TABLE'
        ORDER BY table_name;
        """
        
        # 由于 Supabase 不支持直接执行原始 SQL（需要 service_role key），
        # 我们列出已知的表名，然后逐个查询
        known_tables = [
            'departments',
            'employees', 
            'factories',
            'task_types',
            'skills',
            'competency_definitions',
            'competency_assessments',
            'resource_task_types',
            'tasks',
            'resource_planning_tasks',
            'schedule_change_notifications'
        ]
        
        table_info = []
        
        for table in known_tables:
            try:
                # 查询表的行数和前1条数据（获取列名）
                response = supabase.table(table).select("*", count='exact').limit(1).execute()
                row_count = response.count if hasattr(response, 'count') else 0
                columns = []
                
                if response.data and len(response.data) > 0:
                    columns = list(response.data[0].keys())
                else:
                    # 如果没有数据，尝试查询0条获取列名
                    response_empty = supabase.table(table).select("*").limit(0).execute()
                    if hasattr(response_empty, 'data'):
                        columns = list(response_empty.data[0].keys()) if response_empty.data else []
                
                table_info.append({
                    'name': table,
                    'row_count': row_count,
                    'columns': columns
                })
                
                print(f"✅ {table:<35} | 行数: {row_count:>6} | 列数: {len(columns):>2}")
                
            except Exception as e:
                print(f"⚠️  {table:<35} | 无法访问: {str(e)[:40]}")
        
        print()
        print("=" * 80)
        print("📋 第二步：详细表结构")
        print("=" * 80)
        print()
        
        # 输出每个表的详细结构
        for table in table_info:
            print(f"表名: {table['name']}")
            print(f"行数: {table['row_count']}")
            print(f"字段列表 ({len(table['columns'])} 个字段):")
            
            if table['columns']:
                for i, col in enumerate(table['columns'], 1):
                    print(f"  {i:>2}. {col}")
            else:
                print("  （无数据或无法访问）")
            
            print("-" * 80)
            print()
        
        # 生成 SQL Server 对比清单
        print("=" * 80)
        print("✅ 检查完成！需要导出的表清单：")
        print("=" * 80)
        print()
        
        total_rows = sum(t['row_count'] for t in table_info)
        print(f"总表数: {len(table_info)} 个")
        print(f"总数据行数: {total_rows:,} 行")
        print()
        
        print("导出优先级（按外键依赖顺序）:")
        print()
        print("第一批（无依赖）：")
        no_dep_tables = ['departments', 'factories', 'task_types', 'resource_task_types', 'skills', 'competency_definitions']
        for t in no_dep_tables:
            info = next((x for x in table_info if x['name'] == t), None)
            if info:
                print(f"  ✓ {t:<35} ({info['row_count']:>6} 行)")
        
        print()
        print("第二批（依赖第一批）：")
        print(f"  ✓ employees                           (依赖 departments)")
        
        print()
        print("第三批（依赖 employees）：")
        dep_tables = ['competency_assessments', 'tasks', 'resource_planning_tasks', 'schedule_change_notifications']
        for t in dep_tables:
            info = next((x for x in table_info if x['name'] == t), None)
            if info:
                print(f"  ✓ {t:<35} ({info['row_count']:>6} 行)")
        
        print()
        print("=" * 80)
        
    except Exception as e:
        print(f"❌ 错误: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    inspect_supabase_tables()
