"""
审计日志查询 API 路由
功能：查询导入历史记录

端点：
- GET /api/audit-logs/import-history - 查询导入历史（按批次聚合）
- GET /api/audit-logs - 查询详细日志记录
"""

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from typing import Optional, Dict, List
from database import db
from auth import verify_admin
import logging

logger = logging.getLogger(__name__)

router = APIRouter()


# ============================================================================
# Pydantic 模型
# ============================================================================

class ImportHistoryItem(BaseModel):
    """导入历史记录项"""
    batch_id: str  # 使用 operated_at 作为批次标识
    table_name: str
    operation_count: int
    operator_name: str
    operator_email: str
    operated_at: str
    success_count: int  # INSERT 操作数量
    preview: str  # 前3条记录预览


class AuditLogDetail(BaseModel):
    """审计日志详情"""
    id: str
    table_name: str
    record_id: str
    operation_type: str
    field_name: Optional[str]
    old_value: Optional[str]
    new_value: Optional[str]
    operator_name: str
    operator_email: str
    operated_at: str


# ============================================================================
# API Endpoints
# ============================================================================

@router.get("/import-history")
def get_import_history(
    table_name: Optional[str] = Query(None, description="按表名筛选"),
    limit: int = Query(20, description="返回记录数"),
    current_user: Dict = Depends(verify_admin)
):
    """
    获取导入历史记录（按批次聚合）
    
    功能：
    - 按时间窗口（5分钟内）聚合为一个批次
    - 统计每个批次的操作数量
    - 显示操作人信息
    
    返回：
    - 批次列表，按时间倒序
    """
    try:
        with db.get_cursor() as cursor:
            # 构建查询条件
            where_clause = "WHERE operation_type IN ('INSERT', 'DELETE')"
            params = []
            
            if table_name:
                where_clause += " AND table_name = ?"
                params.append(table_name)
            
            # 查询最近的导入操作（按批次聚合）
            # 使用时间窗口（5分钟内）作为批次标识
            sql = f"""
                WITH BatchedLogs AS (
                    SELECT 
                        table_name,
                        operation_type,
                        operator_name,
                        operator_email,
                        operated_at,
                        record_id,
                        -- 按5分钟窗口分组
                        DATEADD(MINUTE, 
                            DATEDIFF(MINUTE, '2000-01-01', operated_at) / 5 * 5, 
                            '2000-01-01'
                        ) AS batch_time
                    FROM dbo.data_audit_logs
                    {where_clause}
                )
                SELECT TOP ({limit})
                    batch_time,
                    table_name,
                    COUNT(*) AS operation_count,
                    SUM(CASE WHEN operation_type = 'INSERT' THEN 1 ELSE 0 END) AS success_count,
                    SUM(CASE WHEN operation_type = 'DELETE' THEN 1 ELSE 0 END) AS failed_count,
                    MAX(operator_name) AS operator_name,
                    MAX(operator_email) AS operator_email,
                    MAX(operated_at) AS operated_at,
                    STRING_AGG(CAST(record_id AS NVARCHAR(MAX)), ', ') WITHIN GROUP (ORDER BY operated_at) AS record_ids
                FROM BatchedLogs
                GROUP BY batch_time, table_name
                ORDER BY batch_time DESC
            """
            
            cursor.execute(sql, params)
            rows = cursor.fetchall()
            
            # 格式化结果
            history = []
            for row in rows:
                # 截取前3条记录作为预览
                record_ids = row[8] if row[8] else ""
                record_list = record_ids.split(', ')
                preview = ', '.join(record_list[:3])
                if len(record_list) > 3:
                    preview += f' ...+{len(record_list) - 3}条'
                
                history.append({
                    'batch_id': str(row[0]),  # batch_time
                    'table_name': row[1],
                    'operation_count': row[2],
                    'success_count': row[3],
                    'failed_count': row[4],
                    'operator_name': row[5],
                    'operator_email': row[6],
                    'operated_at': str(row[7]),
                    'preview': preview
                })
            
            logger.info(f"✅ 查询导入历史: {len(history)} 个批次, 操作人: {current_user['name']}")
            return history
    
    except Exception as e:
        logger.error(f"❌ 查询导入历史失败: {e}")
        raise


@router.get("")
def get_audit_logs(
    table_name: Optional[str] = Query(None, description="按表名筛选"),
    operation_type: Optional[str] = Query(None, description="按操作类型筛选"),
    limit: int = Query(100, description="返回记录数"),
    current_user: Dict = Depends(verify_admin)
):
    """
    获取审计日志详细记录
    
    参数：
    - table_name: 表名筛选
    - operation_type: 操作类型 (INSERT/UPDATE/DELETE)
    - limit: 返回记录数
    
    返回：
    - 审计日志列表，按时间倒序
    """
    try:
        with db.get_cursor() as cursor:
            # 构建查询条件
            where_conditions = []
            params = []
            
            if table_name:
                where_conditions.append("table_name = ?")
                params.append(table_name)
            
            if operation_type:
                where_conditions.append("operation_type = ?")
                params.append(operation_type)
            
            where_clause = "WHERE " + " AND ".join(where_conditions) if where_conditions else ""
            
            # 查询日志
            sql = f"""
                SELECT TOP ({limit})
                    id,
                    table_name,
                    record_id,
                    operation_type,
                    field_name,
                    old_value,
                    new_value,
                    operator_name,
                    operator_email,
                    operated_at
                FROM dbo.data_audit_logs
                {where_clause}
                ORDER BY operated_at DESC
            """
            
            cursor.execute(sql, params)
            rows = cursor.fetchall()
            
            # 格式化结果
            logs = []
            for row in rows:
                logs.append({
                    'id': str(row[0]),
                    'table_name': row[1],
                    'record_id': row[2],
                    'operation_type': row[3],
                    'field_name': row[4],
                    'old_value': row[5],
                    'new_value': row[6],
                    'operator_name': row[7],
                    'operator_email': row[8],
                    'operated_at': str(row[9])
                })
            
            logger.info(f"✅ 查询审计日志: {len(logs)} 条记录, 操作人: {current_user['name']}")
            return logs
    
    except Exception as e:
        logger.error(f"❌ 查询审计日志失败: {e}")
        raise
