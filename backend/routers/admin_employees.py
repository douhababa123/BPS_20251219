"""
员工管理 API 路由
Phase 3.2: employees 表 CRUD + 审计日志集成

功能：
- CREATE: 创建员工（验证 department_id）
- READ: 查询员工列表和详情
- UPDATE: 更新员工信息（字段级审计）
- DELETE: 软删除员工（is_active=false）
"""

from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import Optional, Dict, List
from database import db
from auth import verify_admin
from audit import log_audit, log_audit_batch
import logging
import csv
import pandas as pd
from io import BytesIO
from io import StringIO

logger = logging.getLogger(__name__)

router = APIRouter()


# ============================================================================
# Pydantic 模型
# ============================================================================

class EmployeeCreate(BaseModel):
    """创建员工请求模型"""
    employee_id: str
    name: str
    department_id: int
    email: Optional[str] = None
    position: Optional[str] = None
    phone: Optional[str] = None


class EmployeeUpdate(BaseModel):
    """更新员工请求模型"""
    employee_id: Optional[str] = None
    name: Optional[str] = None
    department_id: Optional[int] = None
    email: Optional[str] = None
    position: Optional[str] = None
    phone: Optional[str] = None


class EmployeeResponse(BaseModel):
    """员工响应模型"""
    id: str
    employee_id: str
    name: str
    department_id: Optional[int]
    email: Optional[str]
    position: Optional[str]
    phone: Optional[str]
    is_active: bool


class BatchDeleteRequest(BaseModel):
    """批量删除请求模型"""
    ids: List[str]


class BatchDeleteResponse(BaseModel):
    """批量删除响应模型"""
    deleted: int
    failed: int
    errors: List[Dict[str, str]]


# ============================================================================
# API Endpoints
# ============================================================================

@router.post("", status_code=201)
def create_employee(
    emp_data: EmployeeCreate,
    current_user: Dict = Depends(verify_admin)
):
    """
    创建员工（仅管理员）
    
    自动记录审计日志：
    - table_name: employees
    - operation_type: INSERT
    - new_value: 新员工的完整数据
    """
    
    try:
        # 1. 检查 employee_id 是否重复
        with db.get_cursor() as cursor:
            cursor.execute("""
                SELECT COUNT(*) as count
                FROM dbo.employees
                WHERE employee_id = ? AND is_active = 1
            """, (emp_data.employee_id,))
            
            if cursor.fetchone()[0] > 0:
                raise HTTPException(400, f"员工编号 '{emp_data.employee_id}' 已存在")
        
        # 2. 验证 department_id 是否存在
        if emp_data.department_id:
            with db.get_cursor() as cursor:
                cursor.execute("""
                    SELECT COUNT(*) as count
                    FROM dbo.departments
                    WHERE id = ? AND is_active = 1
                """, (emp_data.department_id,))
                
                if cursor.fetchone()[0] == 0:
                    raise HTTPException(400, f"部门 ID '{emp_data.department_id}' 不存在")
        
        # 3. 插入新员工（id 是 uniqueidentifier，使用 NEWID()）
        with db.get_cursor() as cursor:
            cursor.execute("""
                INSERT INTO dbo.employees (employee_id, name, department_id, email, position, phone, is_active)
                OUTPUT INSERTED.id
                VALUES (?, ?, ?, ?, ?, ?, 1)
            """, (emp_data.employee_id, emp_data.name, emp_data.department_id,
                  emp_data.email, emp_data.position, emp_data.phone))
            
            emp_id = str(cursor.fetchone()[0])
        
        # 4. 记录审计日志
        log_audit(
            table_name='employees',
            record_id=emp_id,
            operation_type='INSERT',
            operator_id=current_user['user_id'],
            operator_name=current_user['name'],
            operator_email=current_user['email'],
            new_value=emp_data.dict().__str__()
        )
        
        logger.info(f"✅ 创建员工: {emp_data.name} ({emp_data.employee_id}) by {current_user['name']}")
        
        return {
            'id': emp_id,
            'employee_id': emp_data.employee_id,
            'name': emp_data.name,
            'department_id': emp_data.department_id,
            'email': emp_data.email,
            'position': emp_data.position,
            'phone': emp_data.phone,
            'is_active': True
        }
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ 创建员工失败: {e}")
        raise HTTPException(500, f"创建员工失败: {str(e)}")


@router.get("")
def list_employees(
    include_inactive: bool = Query(False, description="是否包含已删除的员工"),
    current_user: Dict = Depends(verify_admin)
):
    """查询员工列表（仅管理员）"""
    
    try:
        with db.get_cursor() as cursor:
            if include_inactive:
                sql = """
                    SELECT id, employee_id, name, department_id, email, position, phone, is_active
                    FROM dbo.employees
                    ORDER BY created_at DESC
                """
            else:
                sql = """
                    SELECT id, employee_id, name, department_id, email, position, phone, is_active
                    FROM dbo.employees
                    WHERE is_active = 1
                    ORDER BY created_at DESC
                """
            
            cursor.execute(sql)
            
            columns = ['id', 'employee_id', 'name', 'department_id', 'email', 'position', 'phone', 'is_active']
            rows = cursor.fetchall()
            
            employees = []
            for row in rows:
                emp = dict(zip(columns, row))
                emp['id'] = str(emp['id'])  # UUID to string
                employees.append(emp)
            
            logger.info(f"🔍 查询员工列表: {len(employees)} 个员工, 操作人: {current_user['name']}")
            
            return {
                'employees': employees,
                'count': len(employees)
            }
    
    except Exception as e:
        logger.error(f"❌ 查询员工列表失败: {e}")
        raise HTTPException(500, f"查询员工列表失败: {str(e)}")


@router.get("/{emp_id}")
def get_employee(
    emp_id: str,
    current_user: Dict = Depends(verify_admin)
):
    """查询员工详情（仅管理员）"""
    
    try:
        with db.get_cursor() as cursor:
            cursor.execute("""
                SELECT id, employee_id, name, department_id, email, position, phone, is_active
                FROM dbo.employees
                WHERE id = ?
            """, (emp_id,))
            
            row = cursor.fetchone()
            
            if not row:
                raise HTTPException(404, "员工不存在")
            
            emp = {
                'id': str(row[0]),
                'employee_id': row[1],
                'name': row[2],
                'department_id': row[3],
                'email': row[4],
                'position': row[5],
                'phone': row[6],
                'is_active': row[7]
            }
            
            logger.info(f"🔍 查询员工详情: {emp['name']}, 操作人: {current_user['name']}")
            
            return emp
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ 查询员工详情失败: {e}")
        raise HTTPException(500, f"查询员工详情失败: {str(e)}")


@router.put("/{emp_id}")
def update_employee(
    emp_id: str,
    emp_data: EmployeeUpdate,
    current_user: Dict = Depends(verify_admin)
):
    """
    更新员工（仅管理员）
    
    自动记录字段级审计日志：
    - 只记录实际变更的字段
    - 每个字段一条日志（field_name, old_value, new_value）
    """
    
    try:
        # 1. 查询旧值
        with db.get_cursor() as cursor:
            cursor.execute("""
                SELECT employee_id, name, department_id, email, position, phone
                FROM dbo.employees
                WHERE id = ? AND is_active = 1
            """, (emp_id,))
            
            old_row = cursor.fetchone()
            
            if not old_row:
                raise HTTPException(404, "员工不存在")
            
            old_data = {
                'employee_id': old_row[0],
                'name': old_row[1],
                'department_id': old_row[2],
                'email': old_row[3],
                'position': old_row[4],
                'phone': old_row[5]
            }
        
        # 2. 验证 department_id（如果要更新）
        if emp_data.department_id is not None:
            with db.get_cursor() as cursor:
                cursor.execute("""
                    SELECT COUNT(*) as count
                    FROM dbo.departments
                    WHERE id = ? AND is_active = 1
                """, (emp_data.department_id,))
                
                if cursor.fetchone()[0] == 0:
                    raise HTTPException(400, f"部门 ID '{emp_data.department_id}' 不存在")
        
        # 3. 构建更新语句（只更新非 None 的字段）
        update_fields = []
        params = []
        logs = []
        
        for field, new_value in emp_data.dict(exclude_none=True).items():
            old_value = old_data.get(field)
            if old_value != new_value:
                update_fields.append(f"{field} = ?")
                params.append(new_value)
                
                # 准备审计日志
                logs.append({
                    'table_name': 'employees',
                    'record_id': emp_id,
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
        
        # 4. 检查 employee_id 重复（如果要更新 employee_id）
        if 'employee_id' in emp_data.dict(exclude_none=True):
            with db.get_cursor() as cursor:
                cursor.execute("""
                    SELECT COUNT(*) as count
                    FROM dbo.employees
                    WHERE employee_id = ? AND id != ? AND is_active = 1
                """, (emp_data.employee_id, emp_id))
                
                if cursor.fetchone()[0] > 0:
                    raise HTTPException(400, f"员工编号 '{emp_data.employee_id}' 已被其他员工使用")
        
        # 5. 执行更新
        params.append(emp_id)
        sql = f"""
            UPDATE dbo.employees
            SET {', '.join(update_fields)}
            WHERE id = ?
        """
        
        with db.get_cursor() as cursor:
            cursor.execute(sql, params)
        
        # 6. 批量记录审计日志
        if logs:
            log_audit_batch(logs)
        
        logger.info(f"✅ 更新员工: {emp_id}, {len(logs)} 个字段变更, 操作人: {current_user['name']}")
        
        # 7. 返回更新后的数据
        with db.get_cursor() as cursor:
            cursor.execute("""
                SELECT id, employee_id, name, department_id, email, position, phone, is_active
                FROM dbo.employees
                WHERE id = ?
            """, (emp_id,))
            
            row = cursor.fetchone()
            
            return {
                'id': str(row[0]),
                'employee_id': row[1],
                'name': row[2],
                'department_id': row[3],
                'email': row[4],
                'position': row[5],
                'phone': row[6],
                'is_active': row[7]
            }
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ 更新员工失败: {e}")
        raise HTTPException(500, f"更新员工失败: {str(e)}")


@router.delete("/{emp_id}")
def delete_employee(
    emp_id: str,
    current_user: Dict = Depends(verify_admin)
):
    """
    软删除员工（仅管理员）
    
    设置 is_active = false，不物理删除记录
    记录审计日志：operation_type='DELETE'
    """
    
    try:
        # 1. 查询旧值
        with db.get_cursor() as cursor:
            cursor.execute("""
                SELECT employee_id, name
                FROM dbo.employees
                WHERE id = ? AND is_active = 1
            """, (emp_id,))
            
            old_row = cursor.fetchone()
            
            if not old_row:
                raise HTTPException(404, "员工不存在或已被删除")
        
        # 2. 软删除（设置 is_active = false）
        with db.get_cursor() as cursor:
            cursor.execute("""
                UPDATE dbo.employees
                SET is_active = 0
                WHERE id = ?
            """, (emp_id,))
        
        # 3. 记录审计日志
        log_audit(
            table_name='employees',
            record_id=emp_id,
            operation_type='DELETE',
            operator_id=current_user['user_id'],
            operator_name=current_user['name'],
            operator_email=current_user['email'],
            old_value=f"employee_id={old_row[0]}, name={old_row[1]}"
        )
        
        logger.info(f"✅ 删除员工: {old_row[1]} ({old_row[0]}), 操作人: {current_user['name']}")
        
        return {
            'message': f'员工 "{old_row[1]}" 已删除'
        }
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ 删除员工失败: {e}")
        raise HTTPException(500, f"删除员工失败: {str(e)}")


@router.post("/batch-delete")
def batch_delete_employees(
    request: BatchDeleteRequest,
    current_user: Dict = Depends(verify_admin)
):
    """
    批量软删除员工（仅管理员）
    
    功能：
    - 批量设置多个员工的 is_active = false
    - 跳过不存在或已删除的员工
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
    
    for emp_id in request.ids:
        try:
            # 1. 查询员工是否存在且激活
            with db.get_cursor() as cursor:
                cursor.execute("""
                    SELECT employee_id, name
                    FROM dbo.employees
                    WHERE id = ? AND is_active = 1
                """, (emp_id,))
                
                old_row = cursor.fetchone()
                
                if not old_row:
                    failed_count += 1
                    errors.append({
                        'id': emp_id,
                        'error': '员工不存在或已被删除'
                    })
                    continue
            
            # 2. 软删除
            with db.get_cursor() as cursor:
                cursor.execute("""
                    UPDATE dbo.employees
                    SET is_active = 0
                    WHERE id = ?
                """, (emp_id,))
            
            # 3. 准备审计日志
            audit_logs.append({
                'table_name': 'employees',
                'record_id': emp_id,
                'operation_type': 'DELETE',
                'operator_id': current_user['user_id'],
                'operator_name': current_user['name'],
                'operator_email': current_user['email'],
                'old_value': f"employee_id={old_row[0]}, name={old_row[1]}"
            })
            
            deleted_count += 1
            logger.info(f"✅ 批量删除员工: {old_row[1]} ({emp_id})")
        
        except Exception as e:
            failed_count += 1
            errors.append({
                'id': emp_id,
                'error': str(e)
            })
            logger.error(f"❌ 批量删除员工失败 ({emp_id}): {e}")
    
    # 4. 批量记录审计日志
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
def export_employees_csv(
    include_inactive: bool = Query(False, description="是否包含已删除的员工"),
    department_id: Optional[int] = Query(None, description="按部门筛选"),
    fields: Optional[str] = Query(None, description="导出字段（逗号分隔），默认全部字段"),
    current_user: Dict = Depends(verify_admin)
):
    """
    导出员工列表为 CSV 文件（仅管理员）
    
    参数：
    - include_inactive: 是否包含已删除的员工
    - department_id: 按部门筛选
    - fields: 指定导出字段，例如 'id,name,employee_id'，默认导出所有字段
    
    返回：
    - CSV 文件流，浏览器自动下载
    """
    
    try:
        # 1. 定义可用字段
        available_fields = ['id', 'employee_id', 'name', 'department_id', 'email', 'position', 'phone', 'is_active']
        
        # 2. 解析导出字段
        if fields:
            selected_fields = [f.strip() for f in fields.split(',')]
            invalid_fields = [f for f in selected_fields if f not in available_fields]
            if invalid_fields:
                raise HTTPException(400, f"无效的字段: {', '.join(invalid_fields)}")
        else:
            selected_fields = available_fields
        
        # 3. 构建查询条件
        where_conditions = []
        params = []
        
        if not include_inactive:
            where_conditions.append("is_active = 1")
        
        if department_id is not None:
            where_conditions.append("department_id = ?")
            params.append(department_id)
        
        where_clause = "WHERE " + " AND ".join(where_conditions) if where_conditions else ""
        field_list = ', '.join(selected_fields)
        
        # 4. 查询数据
        with db.get_cursor() as cursor:
            sql = f"""
                SELECT {field_list}
                FROM dbo.employees
                {where_clause}
                ORDER BY name
            """
            cursor.execute(sql, params)
            rows = cursor.fetchall()
        
        # 5. 生成 CSV
        output = StringIO()
        writer = csv.writer(output)
        
        # 写入表头（中文）
        header_map = {
            'id': 'ID',
            'employee_id': '员工工号',
            'name': '姓名',
            'department_id': '部门ID',
            'email': '邮箱',
            'position': '职位',
            'phone': '电话',
            'is_active': '是否激活'
        }
        headers = [header_map[f] for f in selected_fields]
        writer.writerow(headers)
        
        # 写入数据行
        for row in rows:
            writer.writerow(row)
        
        # 6. 准备响应
        csv_content = output.getvalue()
        output.close()
        
        logger.info(f"✅ 导出员工 CSV: {len(rows)} 条记录, 操作人: {current_user['name']}")
        
        # 7. 返回 CSV 文件流
        return StreamingResponse(
            iter([csv_content.encode('utf-8-sig')]),  # BOM for Excel compatibility
            media_type="text/csv",
            headers={
                "Content-Disposition": "attachment; filename=employees.csv"
            }
        )
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ 导出员工 CSV 失败: {e}")
        raise HTTPException(500, f"导出 CSV 失败: {str(e)}")


@router.post("/import/csv")
async def import_employees_csv(
    file: UploadFile = File(...),
    current_user: Dict = Depends(verify_admin)
):
    """
    从 CSV/Excel 文件导入员工（仅管理员，pandas 增强版）
    
    文件格式支持：
    - CSV (.csv) - UTF-8编码
    - Excel (.xlsx) - 直接读取
    
    CSV/Excel 格式要求：
    - 第一行：表头（中文或英文）
    - 必填字段：员工工号/employee_id, 姓名/name, 部门ID/department_id
    - 可选字段：邮箱/email, 职位/position, 电话/phone
    
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
        
        # 3. 使用 pandas 解析
        try:
            if file.filename.endswith('.xlsx'):
                df = pd.read_excel(BytesIO(content), dtype=str)
            else:
                df = pd.read_csv(BytesIO(content), encoding='utf-8-sig', dtype=str)
        except Exception as e:
            raise HTTPException(400, f"文件解析失败: {str(e)}")
        
        
        # 4. 字段映射
        field_mapping = {
            'ID': 'id',
            'id': 'id',
            '员工工号': 'employee_id',
            'employee_id': 'employee_id',
            '姓名': 'name',
            'name': 'name',
            '部门ID': 'department_id',
            'department_id': 'department_id',
            '邮箱': 'email',
            'email': 'email',
            '职位': 'position',
            'position': 'position',
            '电话': 'phone',
            'phone': 'phone'
        }
        
        # 5. 重命名列并填充NA
        df_renamed = df.rename(columns=field_mapping)
        df_renamed = df_renamed.fillna('')
        
        success_count = 0
        failed_count = 0
        errors = []
        audit_logs = []
        
        # 6. 逐行处理
        for idx, row in df_renamed.iterrows():
            row_num = idx + 2
            try:
                # 提取并清理字段值
                employee_id = str(row.get('employee_id', '')).strip()
                name = str(row.get('name', '')).strip()
                department_id_str = str(row.get('department_id', '')).strip()
                email = str(row.get('email', '')).strip() or None
                position = str(row.get('position', '')).strip() or None
                phone = str(row.get('phone', '')).strip() or None
                
                # 验证必填字段
                if not employee_id:
                    raise ValueError("员工工号不能为空")
                if not name:
                    raise ValueError("姓名不能为空")
                if not department_id_str:
                    raise ValueError("部门ID不能为空")
                
                # 验证 department_id 是整数
                try:
                    dept_id = int(department_id_str)
                except (ValueError, TypeError):
                    raise ValueError("部门ID必须是整数")
                
                # 检查 department 是否存在
                with db.get_cursor() as cursor:
                    cursor.execute("""
                        SELECT COUNT(*) FROM dbo.departments
                        WHERE id = ? AND is_active = 1
                    """, (dept_id,))
                    if cursor.fetchone()[0] == 0:
                        raise ValueError(f"部门ID {dept_id} 不存在")
                
                # 检查 employee_id 是否已存在
                with db.get_cursor() as cursor:
                    cursor.execute("""
                        SELECT COUNT(*) FROM dbo.employees
                        WHERE employee_id = ? AND is_active = 1
                    """, (employee_id,))
                    if cursor.fetchone()[0] > 0:
                        raise ValueError(f"员工工号 '{employee_id}' 已存在")
                
                # 插入数据
                with db.get_cursor() as cursor:
                    cursor.execute("""
                        INSERT INTO dbo.employees (
                            employee_id, name, department_id, email, position, phone
                        )
                        OUTPUT INSERTED.id
                        VALUES (?, ?, ?, ?, ?, ?)
                    """, (
                        employee_id,
                        name,
                        dept_id,
                        email,
                        position,
                        phone
                    ))
                    emp_id = str(cursor.fetchone()[0])
                
                # 准备审计日志
                audit_logs.append({
                    'table_name': 'employees',
                    'record_id': emp_id,
                    'operation_type': 'INSERT',
                    'operator_id': current_user['user_id'],
                    'operator_name': current_user['name'],
                    'operator_email': current_user['email'],
                    'new_value': f"employee_id={employee_id}, name={name}"
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
        
        logger.info(f"✅ CSV 导入完成: {success_count} 成功, {failed_count} 失败, 操作人: {current_user['name']}")
        
        return {
            'success': success_count,
            'failed': failed_count,
            'errors': errors
        }
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ 导入 CSV 失败: {e}")
        raise HTTPException(500, f"导入 CSV 失败: {str(e)}")
