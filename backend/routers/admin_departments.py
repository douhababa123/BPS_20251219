"""
部门管理 API 路由
仅管理员可访问，包含审计日志集成

API 端点：
- POST   /api/admin/departments - 创建部门
- GET    /api/admin/departments - 查询部门列表
- GET    /api/admin/departments/{id} - 查询部门详情
- PUT    /api/admin/departments/{id} - 更新部门
- DELETE /api/admin/departments/{id} - 软删除部门
"""

from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File
from fastapi.responses import StreamingResponse
from typing import Dict, List, Optional
from pydantic import BaseModel, Field
from auth import verify_admin
from audit import log_audit, log_audit_batch
from database import db
import logging
import pandas as pd
from io import BytesIO
import uuid
import csv
from io import StringIO

logger = logging.getLogger(__name__)

router = APIRouter()


# ============================================================================
# Pydantic Models
# ============================================================================

class DepartmentCreate(BaseModel):
    """创建部门请求模型"""
    name: str = Field(..., min_length=1, max_length=100, description="部门名称")
    code: Optional[str] = Field(None, max_length=50, description="部门代码（可选）")
    description: Optional[str] = Field(None, max_length=500, description="部门描述")


class DepartmentUpdate(BaseModel):
    """更新部门请求模型"""
    name: Optional[str] = Field(None, min_length=1, max_length=100, description="部门名称")
    code: Optional[str] = Field(None, min_length=1, max_length=50, description="部门代码")
    description: Optional[str] = Field(None, max_length=500, description="部门描述")


class DepartmentResponse(BaseModel):
    """部门响应模型"""
    id: str
    name: str
    code: str
    description: Optional[str]
    is_active: bool


class BatchDeleteRequest(BaseModel):
    """批量删除请求模型"""
    ids: List[str] = Field(..., min_items=1, description="部门 ID 列表")


class BatchDeleteResponse(BaseModel):
    """批量删除响应模型"""
    deleted: int = Field(..., description="成功删除的数量")
    failed: int = Field(..., description="失败的数量")
    errors: List[Dict[str, str]] = Field(default_factory=list, description="错误详情")


# ============================================================================
# API Endpoints
# ============================================================================

@router.post("", status_code=201)
def create_department(
    dept_data: DepartmentCreate,
    current_user: Dict = Depends(verify_admin)
):
    """
    创建部门（仅管理员）
    
    自动记录审计日志：
    - table_name: departments
    - operation_type: INSERT
    - new_value: 新部门的完整数据
    """
    
    try:
        # 1. 检查 code 是否重复（code 为可选字段）
        if dept_data.code:
            with db.get_cursor() as cursor:
                cursor.execute("""
                    SELECT COUNT(*) as count
                    FROM dbo.departments
                    WHERE code = ? AND is_active = 1
                """, (dept_data.code,))
                
                if cursor.fetchone()[0] > 0:
                    raise HTTPException(400, f"部门代码 '{dept_data.code}' 已存在")
        
        # 2. 插入新部门（使用数据库自增 ID）
        with db.get_cursor() as cursor:
            cursor.execute("""
                INSERT INTO dbo.departments (name, code, description)
                OUTPUT INSERTED.id
                VALUES (?, ?, ?)
            """, (dept_data.name, dept_data.code, dept_data.description))
            
            dept_id = cursor.fetchone()[0]
        
        # 3. 记录审计日志
        log_audit(
            table_name='departments',
            record_id=str(dept_id),
            operation_type='INSERT',
            operator_id=current_user['user_id'],
            operator_name=current_user['name'],
            operator_email=current_user['email'],
            new_value=dept_data.dict().__str__()
        )
        
        logger.info(f"✅ 创建部门: {dept_data.name} ({dept_data.code}) by {current_user['name']}")
        
        return {
            'id': str(dept_id),
            'name': dept_data.name,
            'code': dept_data.code,
            'description': dept_data.description,
            'is_active': True  # 新创建的部门默认激活
        }
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ 创建部门失败: {e}")
        raise HTTPException(500, f"创建部门失败: {str(e)}")


@router.get("")
def list_departments(
    include_inactive: bool = Query(False, description="是否包含已删除的部门"),
    current_user: Dict = Depends(verify_admin)
):
    """
    查询部门列表（仅管理员）
    
    默认只返回 is_active=true 的部门
    """
    
    try:
        where_clause = "" if include_inactive else "WHERE is_active = 1"
        
        with db.get_cursor() as cursor:
            cursor.execute(f"""
                SELECT id, name, code, description, is_active
                FROM dbo.departments
                {where_clause}
                ORDER BY name
            """)
            
            columns = ['id', 'name', 'code', 'description', 'is_active']
            rows = cursor.fetchall()
            
            departments = []
            for row in rows:
                dept = dict(zip(columns, row))
                dept['id'] = str(dept['id'])
                departments.append(dept)
            
            logger.info(f"🔍 查询部门列表: {len(departments)} 个部门, 操作人: {current_user['name']}")
            
            return {
                'departments': departments,
                'count': len(departments)
            }
    
    except Exception as e:
        logger.error(f"❌ 查询部门列表失败: {e}")
        raise HTTPException(500, f"查询部门列表失败: {str(e)}")


@router.get("/{dept_id}")
def get_department(
    dept_id: str,
    current_user: Dict = Depends(verify_admin)
):
    """查询部门详情（仅管理员）"""
    
    try:
        # 验证 dept_id 是有效的整数
        try:
            dept_id_int = int(dept_id)
        except (ValueError, TypeError):
            raise HTTPException(404, "部门不存在")
        
        with db.get_cursor() as cursor:
            cursor.execute("""
                SELECT id, name, code, description, is_active
                FROM dbo.departments
                WHERE id = ? AND is_active = 1
            """, (dept_id_int,))
            
            row = cursor.fetchone()
            
            if not row:
                raise HTTPException(404, "部门不存在或已被删除")
            
            dept = {
                'id': str(row[0]),
                'name': row[1],
                'code': row[2],
                'description': row[3],
                'is_active': row[4]
            }
            
            logger.info(f"🔍 查询部门详情: {dept['name']}, 操作人: {current_user['name']}")
            
            return dept
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ 查询部门详情失败: {e}")
        raise HTTPException(500, f"查询部门详情失败: {str(e)}")


@router.put("/{dept_id}")
def update_department(
    dept_id: str,
    dept_data: DepartmentUpdate,
    current_user: Dict = Depends(verify_admin)
):
    """
    更新部门（仅管理员）
    
    自动记录字段级审计日志：
    - 只记录实际变更的字段
    - 每个字段一条日志（field_name, old_value, new_value）
    """
    
    try:
        # 0. 验证 dept_id 是有效的整数
        try:
            dept_id_int = int(dept_id)
        except (ValueError, TypeError):
            raise HTTPException(404, "部门不存在")
        
        # 1. 查询旧值
        with db.get_cursor() as cursor:
            cursor.execute("""
                SELECT name, code, description
                FROM dbo.departments
                WHERE id = ? AND is_active = 1
            """, (dept_id_int,))
            
            old_row = cursor.fetchone()
            
            if not old_row:
                raise HTTPException(404, "部门不存在")
            
            old_data = {
                'name': old_row[0],
                'code': old_row[1],
                'description': old_row[2]
            }
        
        # 2. 构建更新语句（只更新非 None 的字段）
        update_fields = []
        params = []
        logs = []
        
        for field, new_value in dept_data.dict(exclude_none=True).items():
            old_value = old_data.get(field)
            if old_value != new_value:
                update_fields.append(f"{field} = ?")
                params.append(new_value)
                
                # 准备审计日志
                logs.append({
                    'table_name': 'departments',
                    'record_id': str(dept_id_int),
                    'operation_type': 'UPDATE',
                    'field_name': field,
                    'old_value': str(old_value) if old_value else None,
                    'new_value': str(new_value) if new_value else None,
                    'operator_id': current_user['user_id'],
                    'operator_name': current_user['name'],
                    'operator_email': current_user['email']
                })
        
        if not update_fields:
            return {'message': '没有需要更新的字段'}
        
        # 3. 检查 code 重复（如果要更新 code）
        if 'code' in dept_data.dict(exclude_none=True):
            with db.get_cursor() as cursor:
                cursor.execute("""
                    SELECT COUNT(*) as count
                    FROM dbo.departments
                    WHERE code = ? AND id != ? AND is_active = 1
                """, (dept_data.code, dept_id_int))
                
                if cursor.fetchone()[0] > 0:
                    raise HTTPException(400, f"部门代码 '{dept_data.code}' 已被其他部门使用")
        
        # 4. 执行更新
        params.append(dept_id_int)
        sql = f"""
            UPDATE dbo.departments
            SET {', '.join(update_fields)}
            WHERE id = ?
        """
        
        with db.get_cursor() as cursor:
            cursor.execute(sql, params)
        
        # 5. 批量记录审计日志
        if logs:
            log_audit_batch(logs)
        
        logger.info(f"✅ 更新部门: {dept_id_int}, {len(logs)} 个字段变更, 操作人: {current_user['name']}")
        
        # 6. 返回更新后的数据
        with db.get_cursor() as cursor:
            cursor.execute("""
                SELECT id, name, code, description, is_active
                FROM dbo.departments
                WHERE id = ?
            """, (dept_id_int,))
            
            row = cursor.fetchone()
            
            return {
                'id': str(row[0]),
                'name': row[1],
                'code': row[2],
                'description': row[3],
                'is_active': row[4]
            }
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ 更新部门失败: {e}")
        raise HTTPException(500, f"更新部门失败: {str(e)}")


@router.delete("/{dept_id}")
def delete_department(
    dept_id: str,
    current_user: Dict = Depends(verify_admin)
):
    """
    软删除部门（仅管理员）
    
    设置 is_active = false，不物理删除记录
    记录审计日志：operation_type='DELETE'
    """
    
    try:
        # 0. 验证 dept_id 是有效的整数
        try:
            dept_id_int = int(dept_id)
        except (ValueError, TypeError):
            raise HTTPException(404, "部门不存在或已被删除")
        
        # 1. 查询旧值
        with db.get_cursor() as cursor:
            cursor.execute("""
                SELECT name, code, description
                FROM dbo.departments
                WHERE id = ? AND is_active = 1
            """, (dept_id_int,))
            
            old_row = cursor.fetchone()
            
            if not old_row:
                raise HTTPException(404, "部门不存在或已被删除")
        
        # 2. 软删除（设置 is_active = false）
        with db.get_cursor() as cursor:
            cursor.execute("""
                UPDATE dbo.departments
                SET is_active = 0
                WHERE id = ?
            """, (dept_id_int,))
        
        # 3. 记录审计日志
        log_audit(
            table_name='departments',
            record_id=str(dept_id_int),
            operation_type='DELETE',
            operator_id=current_user['user_id'],
            operator_name=current_user['name'],
            operator_email=current_user['email'],
            old_value=f"name={old_row[0]}, code={old_row[1]}"
        )
        
        logger.info(f"✅ 删除部门: {old_row[0]} ({old_row[1]}), 操作人: {current_user['name']}")
        
        return {
            'message': f'部门 "{old_row[0]}" 已删除'
        }
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ 删除部门失败: {e}")
        raise HTTPException(500, f"删除部门失败: {str(e)}")


@router.post("/batch-delete")
def batch_delete_departments(
    request: BatchDeleteRequest,
    current_user: Dict = Depends(verify_admin)
):
    """
    批量软删除部门（仅管理员）
    
    功能：
    - 批量设置多个部门的 is_active = false
    - 跳过不存在或已删除的部门
    - 返回详细的成功/失败统计
    - 每个删除操作记录审计日志
    
    返回：
    - deleted: 成功删除的数量
    - failed: 失败的数量
    - errors: 失败详情列表 [{id, error}]
    """
    
    deleted_count = 0
    failed_count = 0
    errors = []
    audit_logs = []
    
    for dept_id_str in request.ids:
        try:
            # 1. 验证 ID 是整数
            try:
                dept_id = int(dept_id_str)
            except (ValueError, TypeError):
                failed_count += 1
                errors.append({
                    'id': dept_id_str,
                    'error': 'ID 格式无效'
                })
                continue
            
            # 2. 查询部门是否存在且激活
            with db.get_cursor() as cursor:
                cursor.execute("""
                    SELECT name, code, description
                    FROM dbo.departments
                    WHERE id = ? AND is_active = 1
                """, (dept_id,))
                
                old_row = cursor.fetchone()
                
                if not old_row:
                    failed_count += 1
                    errors.append({
                        'id': dept_id_str,
                        'error': '部门不存在或已被删除'
                    })
                    continue
            
            # 3. 软删除
            with db.get_cursor() as cursor:
                cursor.execute("""
                    UPDATE dbo.departments
                    SET is_active = 0
                    WHERE id = ?
                """, (dept_id,))
            
            # 4. 准备审计日志
            audit_logs.append({
                'table_name': 'departments',
                'record_id': str(dept_id),
                'operation_type': 'DELETE',
                'operator_id': current_user['user_id'],
                'operator_name': current_user['name'],
                'operator_email': current_user['email'],
                'old_value': f"name={old_row[0]}, code={old_row[1]}"
            })
            
            deleted_count += 1
            logger.info(f"✅ 批量删除部门: {old_row[0]} ({dept_id})")
        
        except Exception as e:
            failed_count += 1
            errors.append({
                'id': dept_id_str,
                'error': str(e)
            })
            logger.error(f"❌ 批量删除部门失败 ({dept_id_str}): {e}")
    
    # 5. 批量记录审计日志
    if audit_logs:
        try:
            log_audit_batch(audit_logs)
        except Exception as e:
            logger.error(f"❌ 记录审计日志失败: {e}")
    
    logger.info(f"✅ 批量删除完成: {deleted_count} 成功, {failed_count} 失败, 操作人: {current_user['name']}")
    
    return {
        'deleted': deleted_count,
        'failed': failed_count,
        'errors': errors
    }


@router.get("/export/csv")
def export_departments_csv(
    include_inactive: bool = Query(False, description="是否包含已删除的部门"),
    fields: Optional[str] = Query(None, description="导出字段（逗号分隔），默认全部字段"),
    current_user: Dict = Depends(verify_admin)
):
    """
    导出部门列表为 CSV 文件（仅管理员）
    
    参数：
    - include_inactive: 是否包含已删除的部门
    - fields: 指定导出字段，例如 'id,name,code'，默认导出所有字段
    
    返回：
    - CSV 文件流，浏览器自动下载
    """
    
    try:
        # 1. 定义可用字段
        available_fields = ['id', 'name', 'code', 'description', 'is_active']
        
        # 2. 解析导出字段
        if fields:
            selected_fields = [f.strip() for f in fields.split(',')]
            # 验证字段是否有效
            invalid_fields = [f for f in selected_fields if f not in available_fields]
            if invalid_fields:
                raise HTTPException(400, f"无效的字段: {', '.join(invalid_fields)}")
        else:
            selected_fields = available_fields
        
        # 3. 查询数据
        where_clause = "" if include_inactive else "WHERE is_active = 1"
        field_list = ', '.join(selected_fields)
        
        with db.get_cursor() as cursor:
            cursor.execute(f"""
                SELECT {field_list}
                FROM dbo.departments
                {where_clause}
                ORDER BY name
            """)
            rows = cursor.fetchall()
        
        # 4. 生成 CSV
        output = StringIO()
        writer = csv.writer(output)
        
        # 写入表头（中文）
        header_map = {
            'id': 'ID',
            'name': '部门名称',
            'code': '部门代码',
            'description': '描述',
            'is_active': '是否激活'
        }
        headers = [header_map[f] for f in selected_fields]
        writer.writerow(headers)
        
        # 写入数据行
        for row in rows:
            writer.writerow(row)
        
        # 5. 准备响应
        csv_content = output.getvalue()
        output.close()
        
        logger.info(f"✅ 导出部门 CSV: {len(rows)} 条记录, 操作人: {current_user['name']}")
        
        # 6. 返回 CSV 文件流
        return StreamingResponse(
            iter([csv_content.encode('utf-8-sig')]),  # BOM for Excel compatibility
            media_type="text/csv",
            headers={
                "Content-Disposition": "attachment; filename=departments.csv"
            }
        )
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ 导出部门 CSV 失败: {e}")
        raise HTTPException(500, f"导出 CSV 失败: {str(e)}")


@router.post("/import/csv")
async def import_departments_csv(
    file: UploadFile = File(...),
    current_user: Dict = Depends(verify_admin)
):
    """
    从 CSV/Excel 文件导入部门（仅管理员，pandas 增强版）
    
    文件格式支持：
    - CSV (.csv) - UTF-8编码
    - Excel (.xlsx) - 直接读取
    
    CSV/Excel 格式要求：
    - 第一行：表头（中文或英文）
    - 必填字段：部门名称/name, 部门代码/code
    - 可选字段：描述/description
    
    返回：
    - success: 成功导入的数量
    - failed: 失败的数量
    - errors: 错误详情列表 [{row, error}]
    """
    
    try:
        # 1. 验证文件类型（支持 CSV 和 Excel）
        if not (file.filename.endswith('.csv') or file.filename.endswith('.xlsx')):
            raise HTTPException(400, "只支持 CSV 或 Excel 文件（.csv 或 .xlsx）")
        
        # 2. 读取文件内容
        content = await file.read()
        
        # 3. 使用 pandas 解析（根据文件类型自动选择）
        try:
            if file.filename.endswith('.xlsx'):
                # Excel 格式：直接读取，dtype=str 防止类型自动推断导致问题
                df = pd.read_excel(BytesIO(content), dtype=str)
            else:
                # CSV 格式：支持 BOM，dtype=str 保持原始字符串
                df = pd.read_csv(BytesIO(content), encoding='utf-8-sig', dtype=str)
        except Exception as e:
            raise HTTPException(400, f"文件解析失败: {str(e)}")
        
        # 4. 字段映射（支持中英文表头）
        field_mapping = {
            'ID': 'id',
            'id': 'id',
            '部门名称': 'name',
            'name': 'name',
            '部门代码': 'code',
            'code': 'code',
            '描述': 'description',
            'description': 'description'
        }
        
        # 5. 重命名列（映射到数据库字段）
        df_renamed = df.rename(columns=field_mapping)
        
        # 6. 填充 NA 值为空字符串（pandas 智能处理）
        df_renamed = df_renamed.fillna('')
        
        success_count = 0
        failed_count = 0
        errors = []
        audit_logs = []
        
        # 7. 逐行处理（使用 pandas iterrows，包含行号）
        for idx, row in df_renamed.iterrows():
            row_num = idx + 2  # Excel 行号（第1行是表头）
            try:
                # 提取并清理字段值
                name = str(row.get('name', '')).strip()
                code = str(row.get('code', '')).strip()
                description = str(row.get('description', '')).strip() or None
                # 提取并清理字段值
                name = str(row.get('name', '')).strip()
                code = str(row.get('code', '')).strip()
                description = str(row.get('description', '')).strip() or None
                
                # 验证必填字段
                if not name:
                    raise ValueError("部门名称不能为空")
                if not code:
                    raise ValueError("部门代码不能为空")
                
                # 检查 code 是否已存在
                with db.get_cursor() as cursor:
                    cursor.execute("""
                        SELECT COUNT(*) FROM dbo.departments
                        WHERE code = ? AND is_active = 1
                    """, (code,))
                    if cursor.fetchone()[0] > 0:
                        raise ValueError(f"部门代码 '{code}' 已存在")
                
                # 插入数据
                with db.get_cursor() as cursor:
                    cursor.execute("""
                        INSERT INTO dbo.departments (name, code, description)
                        OUTPUT INSERTED.id
                        VALUES (?, ?, ?)
                    """, (
                        name,
                        code,
                        description
                    ))
                    dept_id = cursor.fetchone()[0]
                
                # 准备审计日志
                audit_logs.append({
                    'table_name': 'departments',
                    'record_id': str(dept_id),
                    'operation_type': 'INSERT',
                    'operator_id': current_user['user_id'],
                    'operator_name': current_user['name'],
                    'operator_email': current_user['email'],
                    'new_value': f"name={name}, code={code}"
                })
                
                success_count += 1
            
            except ValueError as e:
                failed_count += 1
                errors.append({
                    'row': row_num,
                    'error': str(e)
                })
            except Exception as e:
                failed_count += 1
                errors.append({
                    'row': row_num,
                    'error': f"导入失败: {str(e)}"
                })
        
        # 6. 批量记录审计日志
        if audit_logs:
            try:
                log_audit_batch(audit_logs)
            except Exception as e:
                logger.error(f"❌ 记录审计日志失败: {e}")
        
        logger.info(f"✅ CSV/Excel 导入完成: {success_count} 成功, {failed_count} 失败, 操作人: {current_user['name']}")
        
        return {
            'success': success_count,
            'failed': failed_count,
            'errors': errors
        }
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ 导入文件失败: {e}")
        raise HTTPException(500, f"导入文件失败: {str(e)}")
