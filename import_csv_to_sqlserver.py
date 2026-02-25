"""
CSV 数据批量导入 SQL Server 脚本
用途: 自动将 csv_data 目录下的所有 CSV 文件导入到 SQL Server
特性: 
- 按外键依赖顺序导入
- 自动处理 IDENTITY_INSERT
- 支持字段映射
- 显示进度和错误信息
"""

import pyodbc
import csv
import os
import re
from datetime import datetime
from pathlib import Path
import sys

# 设置 UTF-8 编码（Windows 命令行支持）
if sys.platform == 'win32':
    sys.stdout.reconfigure(encoding='utf-8')
    sys.stderr.reconfigure(encoding='utf-8')

# ============================================================================
# 配置区域

# ============================================================================

# SQL Server 连接配置
SQL_SERVER_CONFIG = {
    'server': '10.88.43.154',
    'database': 'DCCT_BPS_Debug',
    'username': 'TEST',
    'password': '123456',
    'driver': '{ODBC Driver 17 for SQL Server}'
}

# CSV 文件目录
CSV_DIR = Path(__file__).parent / 'csv_data'

# 导入顺序配置（按外键依赖顺序）
IMPORT_ORDER = [
    # 第一批：无外键依赖
    {
        'file': 'departments.csv',
        'table': 'departments',
        'identity_insert': True,  # 需要手动指定 ID
        'skip_columns': []
    },
    {
        'file': 'factories.csv',
        'table': 'factories',
        'identity_insert': True,  # 需要保留 id
        'skip_columns': []
    },
    {
        'file': 'task_types.csv',
        'table': 'task_types',
        'identity_insert': True,  # 需要保留 id
        'skip_columns': []
    },
    {
        'file': 'resource_task_types.csv',
        'table': 'resource_task_types',
        'identity_insert': True,  # 需要手动指定 ID
        'skip_columns': []
    },
    {
        'file': 'skills.csv',
        'table': 'skills',
        'identity_insert': True,  # 需要手动指定 ID
        'skip_columns': [],
        'disable_constraints': True  # skill_code 有 NULL 值会违反唯一约束
    },
    {
        'file': 'competency_definitions.csv',
        'table': 'competency_definitions',
        'identity_insert': True,  # id 字段需要保留原值
        'skip_columns': []
    },
    # 第二批：依赖第一批
    {
        'file': 'employees.csv',
        'table': 'employees',
        'identity_insert': False,  # 没有 IDENTITY 列
        'skip_columns': ['position', 'auth_user_id'],  # SQL Server 表中没有这些字段
        'column_mapping': {
            # CSV 字段名 -> SQL Server 字段名（如果不同）
        }
    },
    # 第三批：依赖 employees
    {
        'file': 'competency_assessments.csv',
        'table': 'competency_assessments',
        'identity_insert': False,  # 没有 IDENTITY 列
        'skip_columns': ['gap']  # gap 是计算列，不能导入
    },
    {
        'file': 'tasks.csv',
        'table': 'tasks',
        'identity_insert': False,  # 没有 IDENTITY 列
        'skip_columns': ['days_count', 'source', 
                        'is_cross_factory', 'request_factory']  # 保留 task_type 和 task_location
    },
    {
        'file': 'resource_planning_tasks.csv',
        'table': 'resource_planning_tasks',
        'identity_insert': True,  # 需要保留 id
        'skip_columns': []
    },
    {
        'file': 'schedule_change_notifications.csv',
        'table': 'schedule_change_notifications',
        'identity_insert': False,  # 没有 IDENTITY 列
        'skip_columns': []
    },
]

# ============================================================================
# 工具函数
# ============================================================================

def get_connection():
    """创建 SQL Server 连接"""
    conn_str = (
        f"DRIVER={SQL_SERVER_CONFIG['driver']};"
        f"SERVER={SQL_SERVER_CONFIG['server']};"
        f"DATABASE={SQL_SERVER_CONFIG['database']};"
        f"UID={SQL_SERVER_CONFIG['username']};"
        f"PWD={SQL_SERVER_CONFIG['password']};"
        f"TrustServerCertificate=yes;"
    )
    return pyodbc.connect(conn_str)


def print_header(text):
    """打印标题"""
    print("\n" + "=" * 80)
    print(f"  {text}")
    print("=" * 80)


def print_info(text, prefix="ℹ️"):
    """打印信息"""
    print(f"{prefix} {text}")


def print_success(text):
    """打印成功消息"""
    print(f"✅ {text}")


def print_error(text):
    """打印错误消息"""
    print(f"❌ {text}")


def print_warning(text):
    """打印警告消息"""
    print(f"⚠️  {text}")


def read_csv_file(file_path, skip_columns=None):
    """读取 CSV 文件"""
    skip_columns = skip_columns or []
    rows = []
    
    with open(file_path, 'r', encoding='utf-8-sig') as f:
        reader = csv.DictReader(f)
        headers = [h for h in reader.fieldnames if h not in skip_columns]
        
        for row in reader:
            # 过滤掉跳过的列
            filtered_row = {k: v for k, v in row.items() if k not in skip_columns}
            rows.append(filtered_row)
    
    return headers, rows


def get_table_columns(cursor, table_name):
    """获取表的列信息"""
    query = """
        SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, 
               COLUMNPROPERTY(OBJECT_ID(TABLE_SCHEMA + '.' + TABLE_NAME), COLUMN_NAME, 'IsIdentity') AS IS_IDENTITY
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_NAME = ?
        ORDER BY ORDINAL_POSITION
    """
    cursor.execute(query, table_name)
    columns = {}
    for row in cursor.fetchall():
        columns[row[0]] = {
            'data_type': row[1],
            'is_nullable': row[2] == 'YES',
            'is_identity': row[3] == 1
        }
    return columns


def convert_value(value, data_type):
    """转换数据类型"""
    if value is None or value == '':
        return None
    
    # 布尔类型转换
    if data_type == 'bit':
        if isinstance(value, str):
            return 1 if value.lower() in ('true', '1', 't', 'yes') else 0
        return 1 if value else 0
    
    # 数字类型
    if data_type in ('int', 'bigint', 'smallint', 'tinyint'):
        try:
            return int(float(value))
        except (ValueError, TypeError):
            return None
    
    if data_type in ('decimal', 'numeric', 'float', 'real'):
        try:
            return float(value)
        except (ValueError, TypeError):
            return None
    
    # 日期时间类型 - 转换为 SQL Server 支持的格式
    if data_type in ('datetime', 'datetime2', 'date', 'smalldatetime'):
        if isinstance(value, str) and value:
            # PostgreSQL 格式可能是：
            # 2025-11-25 02:51:25.096953+00
            # 2024-01-29T15:30:00.000+08:00
            # 使用正则表达式提取日期时间部分（忽略毫秒和时区）
            # 匹配：YYYY-MM-DD HH:MM:SS (忽略后面的毫秒和时区)
            match = re.match(r'(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2}:\d{2})', value)
            if match:
                return f"{match.group(1)} {match.group(2)}"
            # 只有日期
            match = re.match(r'(\d{4}-\d{2}-\d{2})', value)
            if match:
                return match.group(1)
            return None
        return value
    
    # 字符串类型 - 处理空字符串
    if data_type in ('nvarchar', 'varchar', 'nchar', 'char', 'text', 'ntext'):
        return value if value != '' else None
    
    return value



def clear_table(cursor, table_name):
    """清空表数据"""
    try:
        cursor.execute(f"DELETE FROM dbo.{table_name}")
        print_info(f"已清空表 {table_name} 的现有数据")
    except Exception as e:
        print_warning(f"清空表 {table_name} 失败: {e}")


def import_table(cursor, config):
    """导入单个表"""
    file_path = CSV_DIR / config['file']
    table_name = config['table']
    
    print(f"\n📦 导入表: {table_name}")
    print(f"   文件: {config['file']}")
    
    # 检查文件是否存在
    if not file_path.exists():
        print_error(f"文件不存在: {file_path}")
        return False
    
    # 读取 CSV 文件
    try:
        headers, rows = read_csv_file(file_path, config.get('skip_columns', []))
        print_info(f"CSV 文件包含 {len(rows)} 行数据")
    except Exception as e:
        print_error(f"读取 CSV 文件失败: {e}")
        return False
    
    if len(rows) == 0:
        print_warning("CSV 文件为空，跳过导入")
        return True
    
    # 获取表结构
    try:
        table_columns = get_table_columns(cursor, table_name)
        print_info(f"SQL Server 表包含 {len(table_columns)} 个字段")
    except Exception as e:
        print_error(f"获取表结构失败: {e}")
        return False
    
    # 清空表数据
    clear_table(cursor, table_name)
    
    # 禁用约束（如果需要）
    if config.get('disable_constraints', False):
        cursor.execute(f"ALTER TABLE dbo.{table_name} NOCHECK CONSTRAINT ALL")
        print_info("已禁用约束")
    
    # 开启 IDENTITY_INSERT（如果需要）
    if config.get('identity_insert', False):
        cursor.execute(f"SET IDENTITY_INSERT dbo.{table_name} ON")
        print_info("已开启 IDENTITY_INSERT")
    
    try:
        # 匹配 CSV 列和表列
        csv_columns = []
        sql_columns = []
        
        for csv_col in headers:
            # 使用列映射（如果有）
            sql_col = config.get('column_mapping', {}).get(csv_col, csv_col)
            
            if sql_col in table_columns:
                csv_columns.append(csv_col)
                sql_columns.append(sql_col)
        
        if len(sql_columns) == 0:
            print_error("没有匹配的列，无法导入")
            return False
        
        print_info(f"匹配到 {len(sql_columns)} 个字段: {', '.join(sql_columns[:5])}...")
        
        # 构建 INSERT 语句
        placeholders = ', '.join(['?'] * len(sql_columns))
        insert_sql = f"INSERT INTO dbo.{table_name} ({', '.join(sql_columns)}) VALUES ({placeholders})"
        
        # 批量插入数据
        success_count = 0
        error_count = 0
        
        for i, row in enumerate(rows, 1):
            try:
                # 准备数据
                values = []
                for csv_col, sql_col in zip(csv_columns, sql_columns):
                    raw_value = row.get(csv_col, '')
                    col_info = table_columns[sql_col]
                    converted_value = convert_value(raw_value, col_info['data_type'])
                    values.append(converted_value)
                
                # 执行插入
                cursor.execute(insert_sql, values)
                success_count += 1
                
                # 显示进度
                if i % 100 == 0 or i == len(rows):
                    print(f"   进度: {i}/{len(rows)} ({i*100//len(rows)}%)", end='\r')
                
            except Exception as e:
                error_count += 1
                if error_count <= 5:  # 只显示前 5 个错误
                    print(f"\n⚠️  第 {i} 行导入失败: {e}")
        
        print()  # 换行
        
        if error_count > 0:
            print_warning(f"导入完成，成功 {success_count} 行，失败 {error_count} 行")
        else:
            print_success(f"成功导入 {success_count} 行数据")
        
        # 提交事务
        cursor.commit()
        
        return True
        
    except Exception as e:
        print_error(f"导入失败: {e}")
        cursor.rollback()
        return False
        
    finally:
        # 关闭 IDENTITY_INSERT（如果开启了）
        if config.get('identity_insert', False):
            try:
                cursor.execute(f"SET IDENTITY_INSERT dbo.{table_name} OFF")
                print_info("已关闭 IDENTITY_INSERT")
            except:
                pass
            
            # 重新启用约束（如果之前禁用了）
            try:
                if config.get('disable_constraints', False):
                    cursor.execute(f"ALTER TABLE dbo.{table_name} CHECK CONSTRAINT ALL")
                    print_info("已重新启用约束")
            except:
                pass


def verify_import(cursor):
    """验证导入结果"""
    print_header("验证导入结果")
    
    # 查询所有表的行数
    expected_counts = {
        'departments': 14,
        'factories': 9,
        'task_types': 8,
        'resource_task_types': 11,
        'skills': 104,
        'competency_definitions': 39,
        'employees': 18,
        'competency_assessments': 375,
        'tasks': 15,
        'resource_planning_tasks': 2411,
        'schedule_change_notifications': 9,
    }
    
    total_expected = sum(expected_counts.values())
    total_actual = 0
    all_correct = True
    
    print(f"\n{'表名':<35} {'预期行数':<12} {'实际行数':<12} {'状态'}")
    print("-" * 70)
    
    for table, expected in expected_counts.items():
        try:
            cursor.execute(f"SELECT COUNT(*) FROM dbo.{table}")
            actual = cursor.fetchone()[0]
            total_actual += actual
            
            status = "✅" if actual == expected else "❌"
            if actual != expected:
                all_correct = False
            
            print(f"{table:<35} {expected:<12} {actual:<12} {status}")
        except Exception as e:
            print(f"{table:<35} {expected:<12} {'错误':<12} ❌")
            all_correct = False
    
    print("-" * 70)
    print(f"{'总计':<35} {total_expected:<12} {total_actual:<12} {'✅' if all_correct else '❌'}")
    
    if all_correct:
        print_success("\n所有表数据导入完整！")
    else:
        print_error("\n部分表数据不完整，请检查错误信息")
    
    return all_correct


# ============================================================================
# 主函数
# ============================================================================

def main():
    """主函数"""
    print_header("CSV 数据批量导入 SQL Server")
    print(f"开始时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"CSV 目录: {CSV_DIR}")
    print(f"SQL Server: {SQL_SERVER_CONFIG['server']}/{SQL_SERVER_CONFIG['database']}")
    
    # 检查 CSV 目录
    if not CSV_DIR.exists():
        print_error(f"CSV 目录不存在: {CSV_DIR}")
        return 1
    
    # 连接数据库
    print("\n🔌 连接 SQL Server...")
    try:
        conn = get_connection()
        cursor = conn.cursor()
        print_success("数据库连接成功")
    except Exception as e:
        print_error(f"数据库连接失败: {e}")
        return 1
    
    # 按顺序导入每个表
    print_header(f"开始导入 {len(IMPORT_ORDER)} 个表")
    
    success_count = 0
    for i, config in enumerate(IMPORT_ORDER, 1):
        print(f"\n[{i}/{len(IMPORT_ORDER)}] ", end='')
        
        if import_table(cursor, config):
            success_count += 1
        else:
            print_warning(f"表 {config['table']} 导入失败，继续下一个...")
    
    # 验证导入结果
    verify_import(cursor)
    
    # 关闭连接
    cursor.close()
    conn.close()
    
    # 总结
    print_header("导入完成")
    print(f"结束时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"成功导入: {success_count}/{len(IMPORT_ORDER)} 个表")
    
    if success_count == len(IMPORT_ORDER):
        print_success("✨ 所有数据导入成功！")
        return 0
    else:
        print_warning(f"⚠️  部分表导入失败 ({len(IMPORT_ORDER) - success_count} 个)")
        return 1


if __name__ == '__main__':
    try:
        exit_code = main()
        sys.exit(exit_code)
    except KeyboardInterrupt:
        print("\n\n⚠️  用户中断操作")
        sys.exit(1)
    except Exception as e:
        print_error(f"\n程序异常: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
