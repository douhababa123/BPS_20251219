"""
审计日志 API 路由
提供审计日志查询接口（管理员专用）
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from typing import Optional, Dict
from datetime import datetime
from auth import verify_admin
from audit import query_audit_logs, query_record_history, get_audit_stats
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/admin/audit-logs")


@router.get("")
def list_audit_logs(
    table_name: Optional[str] = Query(None, description="表名筛选"),
    record_id: Optional[str] = Query(None, description="记录ID筛选"),
    operation_type: Optional[str] = Query(None, description="操作类型筛选"),
    operator_id: Optional[str] = Query(None, description="操作人ID筛选"),
    start_time: Optional[datetime] = Query(None, description="开始时间"),
    end_time: Optional[datetime] = Query(None, description="结束时间"),
    limit: int = Query(100, ge=1, le=1000, description="返回数量"),
    offset: int = Query(0, ge=0, description="偏移量"),
    current_user: Dict = Depends(verify_admin)
):
    """
    查询审计日志（管理员专用）
    
    支持多条件筛选：
    - table_name: 按表名筛选
    - record_id: 按记录ID筛选
    - operation_type: 按操作类型筛选 (INSERT/UPDATE/DELETE)
    - operator_id: 按操作人筛选
    - start_time, end_time: 按时间范围筛选
    - limit, offset: 分页参数
    
    返回：
    - logs: 日志列表
    - count: 返回的日志数量
    - filters: 使用的筛选条件
    """
    
    try:
        logs = query_audit_logs(
            table_name=table_name,
            record_id=record_id,
            operation_type=operation_type,
            operator_id=operator_id,
            start_time=start_time,
            end_time=end_time,
            limit=limit,
            offset=offset
        )
        
        # 构建筛选条件摘要
        filters_used = {}
        if table_name:
            filters_used['table_name'] = table_name
        if record_id:
            filters_used['record_id'] = record_id
        if operation_type:
            filters_used['operation_type'] = operation_type
        if operator_id:
            filters_used['operator_id'] = operator_id
        if start_time:
            filters_used['start_time'] = start_time.isoformat()
        if end_time:
            filters_used['end_time'] = end_time.isoformat()
        
        logger.info(f"🔍 审计日志查询: {len(logs)} 条记录, 筛选条件: {filters_used}, 操作人: {current_user['name']}")
        
        return {
            'logs': logs,
            'count': len(logs),
            'filters': filters_used,
            'pagination': {
                'limit': limit,
                'offset': offset
            }
        }
    
    except Exception as e:
        logger.error(f"❌ 查询审计日志失败: {e}")
        raise HTTPException(status_code=500, detail=f"查询审计日志失败: {str(e)}")


@router.get("/record/{table_name}/{record_id}")
def get_record_history_api(
    table_name: str,
    record_id: str,
    current_user: Dict = Depends(verify_admin)
):
    """
    查询特定记录的历史变更（管理员专用）
    
    返回指定表中特定记录的所有历史变更，按时间倒序排列。
    
    参数：
    - table_name: 表名
    - record_id: 记录ID
    
    返回：
    - table_name: 表名
    - record_id: 记录ID
    - history: 历史变更列表
    - count: 变更次数
    """
    
    try:
        history = query_record_history(table_name, record_id)
        
        logger.info(f"🔍 记录历史查询: {table_name}.{record_id}, {len(history)} 条变更, 操作人: {current_user['name']}")
        
        return {
            'table_name': table_name,
            'record_id': record_id,
            'history': history,
            'count': len(history)
        }
    
    except Exception as e:
        logger.error(f"❌ 查询记录历史失败: {e}")
        raise HTTPException(status_code=500, detail=f"查询记录历史失败: {str(e)}")


@router.get("/stats")
def get_audit_statistics(
    days: int = Query(7, ge=1, le=365, description="统计最近多少天"),
    current_user: Dict = Depends(verify_admin)
):
    """
    获取审计日志统计信息（管理员专用）
    
    返回指定时间范围内的审计日志统计数据：
    - 总记录数
    - 按操作类型统计
    - 按表统计
    - 最活跃的操作人
    
    参数：
    - days: 统计最近多少天（1-365）
    """
    
    try:
        stats = get_audit_stats(days=days)
        
        logger.info(f"📊 审计日志统计查询: 最近{days}天, 操作人: {current_user['name']}")
        
        return stats
    
    except Exception as e:
        logger.error(f"❌ 获取审计统计失败: {e}")
        raise HTTPException(status_code=500, detail=f"获取审计统计失败: {str(e)}")


@router.get("/operations")
def get_operation_types(current_user: Dict = Depends(verify_admin)):
    """
    获取所有操作类型（管理员专用）
    
    返回系统支持的操作类型列表，用于前端筛选器。
    """
    return {
        'operation_types': ['INSERT', 'UPDATE', 'DELETE'],
        'descriptions': {
            'INSERT': '新增记录',
            'UPDATE': '更新记录',
            'DELETE': '删除记录'
        }
    }


@router.get("/tables")
def get_audited_tables(current_user: Dict = Depends(verify_admin)):
    """
    获取有审计日志的表列表（管理员专用）
    
    返回所有有审计记录的表名，用于前端筛选器。
    """
    
    try:
        logs = query_audit_logs(limit=10000)
        
        # 提取唯一的表名
        table_names = list(set(log['table_name'] for log in logs))
        table_names.sort()
        
        logger.info(f"📋 审计表列表查询: {len(table_names)} 个表, 操作人: {current_user['name']}")
        
        return {
            'tables': table_names,
            'count': len(table_names)
        }
    
    except Exception as e:
        logger.error(f"❌ 获取审计表列表失败: {e}")
        raise HTTPException(status_code=500, detail=f"获取审计表列表失败: {str(e)}")
