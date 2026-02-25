"""
审计日志模块
提供数据变更审计日志记录和查询功能

功能：
- log_audit(): 记录单条审计日志
- log_audit_batch(): 批量记录审计日志
- query_audit_logs(): 查询审计日志（支持多条件筛选）
- query_record_history(): 查询特定记录的历史变更
"""

from database import db
from typing import Dict, List, Optional
from datetime import datetime
import logging
import uuid

logger = logging.getLogger(__name__)


def log_audit(
    table_name: str,
    record_id: str,
    operation_type: str,
    operator_id: str,
    operator_name: str,
    operator_email: str,
    field_name: Optional[str] = None,
    old_value: Optional[str] = None,
    new_value: Optional[str] = None
) -> str:
    """
    记录单条审计日志
    
    Args:
        table_name: 表名
        record_id: 记录ID
        operation_type: 操作类型 (INSERT/UPDATE/DELETE)
        operator_id: 操作人ID
        operator_name: 操作人姓名
        operator_email: 操作人邮箱
        field_name: 字段名（UPDATE时使用）
        old_value: 旧值（UPDATE/DELETE时使用）
        new_value: 新值（INSERT/UPDATE时使用）
    
    Returns:
        str: 日志ID
    """
    
    # 验证操作类型
    if operation_type not in ['INSERT', 'UPDATE', 'DELETE']:
        raise ValueError(f"无效的操作类型: {operation_type}")
    
    log_id = str(uuid.uuid4())
    
    with db.get_cursor() as cursor:
        cursor.execute("""
            INSERT INTO dbo.data_audit_logs (
                id, table_name, record_id, operation_type,
                field_name, old_value, new_value,
                operator_id, operator_name, operator_email
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            log_id, table_name, record_id, operation_type,
            field_name, old_value, new_value,
            operator_id, operator_name, operator_email
        ))
    
    logger.info(f"📝 审计日志已记录: {operation_type} {table_name}.{record_id} by {operator_name}")
    return log_id


def log_audit_batch(logs: List[Dict]) -> List[str]:
    """
    批量记录审计日志
    
    Args:
        logs: 日志列表，每个日志包含 log_audit() 所需的所有参数
    
    Returns:
        List[str]: 日志ID列表
    """
    log_ids = []
    
    for log_data in logs:
        try:
            log_id = log_audit(**log_data)
            log_ids.append(log_id)
        except Exception as e:
            logger.error(f"❌ 批量记录审计日志失败: {e}")
            raise
    
    logger.info(f"📝 批量审计日志已记录: {len(log_ids)} 条")
    return log_ids


def query_audit_logs(
    table_name: Optional[str] = None,
    record_id: Optional[str] = None,
    operation_type: Optional[str] = None,
    operator_id: Optional[str] = None,
    start_time: Optional[datetime] = None,
    end_time: Optional[datetime] = None,
    limit: int = 100,
    offset: int = 0
) -> List[Dict]:
    """
    查询审计日志（支持多条件筛选）
    
    Args:
        table_name: 表名
        record_id: 记录ID
        operation_type: 操作类型
        operator_id: 操作人ID
        start_time: 开始时间
        end_time: 结束时间
        limit: 返回数量限制
        offset: 偏移量（分页）
    
    Returns:
        List[Dict]: 审计日志列表
    """
    
    # 构建 WHERE 条件
    where_clauses = []
    params = []
    
    if table_name:
        where_clauses.append("table_name = ?")
        params.append(table_name)
    
    if record_id:
        where_clauses.append("record_id = ?")
        params.append(record_id)
    
    if operation_type:
        where_clauses.append("operation_type = ?")
        params.append(operation_type)
    
    if operator_id:
        where_clauses.append("operator_id = ?")
        params.append(operator_id)
    
    if start_time:
        where_clauses.append("operated_at >= ?")
        params.append(start_time)
    
    if end_time:
        where_clauses.append("operated_at <= ?")
        params.append(end_time)
    
    # 构建完整SQL
    where_sql = " AND ".join(where_clauses) if where_clauses else "1=1"
    
    sql = f"""
        SELECT 
            id, table_name, record_id, operation_type,
            field_name, old_value, new_value,
            operator_id, operator_name, operator_email,
            operated_at
        FROM dbo.data_audit_logs
        WHERE {where_sql}
        ORDER BY operated_at DESC
        OFFSET ? ROWS FETCH NEXT ? ROWS ONLY
    """
    
    params.extend([offset, limit])
    
    with db.get_cursor() as cursor:
        cursor.execute(sql, params)
        columns = [col[0] for col in cursor.description]
        rows = cursor.fetchall()
        
        results = []
        for row in rows:
            log = dict(zip(columns, row))
            # 转换 datetime 为 ISO 字符串
            if log['operated_at']:
                log['operated_at'] = log['operated_at'].isoformat()
            # 转换 UUID 为字符串
            log['id'] = str(log['id'])
            log['operator_id'] = str(log['operator_id'])
            results.append(log)
        
        return results


def query_record_history(table_name: str, record_id: str) -> List[Dict]:
    """
    查询特定记录的历史变更
    
    Args:
        table_name: 表名
        record_id: 记录ID
    
    Returns:
        List[Dict]: 历史变更列表（按时间倒序）
    """
    return query_audit_logs(
        table_name=table_name,
        record_id=record_id,
        limit=1000  # 返回所有历史记录
    )


def get_audit_stats(days: int = 7) -> Dict:
    """
    获取审计日志统计信息
    
    Args:
        days: 统计最近多少天的数据
    
    Returns:
        Dict: 统计信息
    """
    
    with db.get_cursor() as cursor:
        # 总记录数
        cursor.execute("""
            SELECT COUNT(*) as total
            FROM dbo.data_audit_logs
            WHERE operated_at >= DATEADD(day, -?, GETDATE())
        """, (days,))
        total = cursor.fetchone()[0]
        
        # 按操作类型统计
        cursor.execute("""
            SELECT operation_type, COUNT(*) as count
            FROM dbo.data_audit_logs
            WHERE operated_at >= DATEADD(day, -?, GETDATE())
            GROUP BY operation_type
        """, (days,))
        by_operation = {row[0]: row[1] for row in cursor.fetchall()}
        
        # 按表统计
        cursor.execute("""
            SELECT TOP 10 table_name, COUNT(*) as count
            FROM dbo.data_audit_logs
            WHERE operated_at >= DATEADD(day, -?, GETDATE())
            GROUP BY table_name
            ORDER BY count DESC
        """, (days,))
        by_table = {row[0]: row[1] for row in cursor.fetchall()}
        
        # 最活跃的操作人
        cursor.execute("""
            SELECT TOP 10 operator_name, operator_email, COUNT(*) as count
            FROM dbo.data_audit_logs
            WHERE operated_at >= DATEADD(day, -?, GETDATE())
            GROUP BY operator_name, operator_email
            ORDER BY count DESC
        """, (days,))
        top_operators = [
            {'name': row[0], 'email': row[1], 'count': row[2]}
            for row in cursor.fetchall()
        ]
        
        return {
            'period_days': days,
            'total_logs': total,
            'by_operation': by_operation,
            'by_table': by_table,
            'top_operators': top_operators
        }


if __name__ == '__main__':
    # 测试审计日志功能
    print("📝 测试审计日志功能")
    print("=" * 60)
    
    # 查找测试用户
    with db.get_cursor() as cursor:
        cursor.execute("""
            SELECT id, name, email
            FROM dbo.users
            WHERE email = 'admin@bosch.com'
        """)
        user = cursor.fetchone()
    
    if user:
        # 测试记录审计日志
        log_id = log_audit(
            table_name='test_table',
            record_id='test-001',
            operation_type='UPDATE',
            field_name='test_field',
            old_value='旧值',
            new_value='新值',
            operator_id=str(user[0]),
            operator_name=user[1],
            operator_email=user[2]
        )
        print(f"✅ 测试日志已创建: {log_id}")
        
        # 查询日志
        logs = query_audit_logs(table_name='test_table', limit=5)
        print(f"✅ 查询到 {len(logs)} 条日志")
        
        # 获取统计信息
        stats = get_audit_stats(days=7)
        print(f"✅ 最近7天共 {stats['total_logs']} 条日志")
    else:
        print("❌ 未找到测试用户")
