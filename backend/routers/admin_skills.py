"""
技能管理 API 路由
Phase 3.3: skills 表 CRUD + 审计日志集成

功能：
- CREATE: 创建技能（验证 skill_code 唯一性）
- READ: 查询技能列表和详情（支持按 module_id 过滤）
- UPDATE: 更新技能信息（字段级审计）
- DELETE: 软删除技能（is_active=false）
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

class SkillCreate(BaseModel):
    """创建技能请求模型"""
    module_id: int
    module_name: str
    skill_name: str
    skill_code: Optional[str] = None
    description: Optional[str] = None
    display_order: Optional[int] = 0


class SkillUpdate(BaseModel):
    """更新技能请求模型"""
    module_id: Optional[int] = None
    module_name: Optional[str] = None
    skill_name: Optional[str] = None
    skill_code: Optional[str] = None
    description: Optional[str] = None
    display_order: Optional[int] = None


class SkillResponse(BaseModel):
    """技能响应模型"""
    id: int
    module_id: int
    module_name: str
    skill_name: str
    skill_code: Optional[str]
    description: Optional[str]
    display_order: int
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
def create_skill(
    skill_data: SkillCreate,
    current_user: Dict = Depends(verify_admin)
):
    """
    创建技能（仅管理员）
    
    自动记录审计日志：
    - table_name: skills
    - operation_type: INSERT
    - new_value: 新技能的完整数据
    """
    
    try:
        # 1. 检查 skill_code 是否重复（如果提供）
        if skill_data.skill_code:
            with db.get_cursor() as cursor:
                cursor.execute("""
                    SELECT COUNT(*) as count
                    FROM dbo.skills
                    WHERE skill_code = ? AND is_active = 1
                """, (skill_data.skill_code,))
                
                if cursor.fetchone()[0] > 0:
                    raise HTTPException(400, f"技能代码 '{skill_data.skill_code}' 已存在")
        
        # 2. 插入新技能（id 是 IDENTITY，自动生成）
        with db.get_cursor() as cursor:
            cursor.execute("""
                INSERT INTO dbo.skills 
                (module_id, module_name, skill_name, skill_code, description, display_order, is_active)
                OUTPUT INSERTED.id
                VALUES (?, ?, ?, ?, ?, ?, 1)
            """, (skill_data.module_id, skill_data.module_name, skill_data.skill_name,
                  skill_data.skill_code, skill_data.description, skill_data.display_order))
            
            skill_id = cursor.fetchone()[0]
        
        # 3. 记录审计日志
        log_audit(
            table_name='skills',
            record_id=str(skill_id),
            operation_type='INSERT',
            operator_id=current_user['user_id'],
            operator_name=current_user['name'],
            operator_email=current_user['email'],
            new_value=skill_data.dict().__str__()
        )
        
        logger.info(f"✅ 创建技能: {skill_data.skill_name} (ID={skill_id}) by {current_user['name']}")
        
        return {
            'id': skill_id,
            'module_id': skill_data.module_id,
            'module_name': skill_data.module_name,
            'skill_name': skill_data.skill_name,
            'skill_code': skill_data.skill_code,
            'description': skill_data.description,
            'display_order': skill_data.display_order,
            'is_active': True
        }
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ 创建技能失败: {e}")
        raise HTTPException(500, f"创建技能失败: {str(e)}")


@router.get("")
def list_skills(
    module_id: Optional[int] = Query(None, description="按模块 ID 过滤"),
    include_inactive: bool = Query(False, description="是否包含已删除的技能"),
    current_user: Dict = Depends(verify_admin)
):
    """查询技能列表（仅管理员）"""
    
    try:
        with db.get_cursor() as cursor:
            # 构建 SQL 查询
            where_clauses = []
            params = []
            
            if not include_inactive:
                where_clauses.append("is_active = 1")
            
            if module_id is not None:
                where_clauses.append("module_id = ?")
                params.append(module_id)
            
            where_sql = " WHERE " + " AND ".join(where_clauses) if where_clauses else ""
            
            sql = f"""
                SELECT id, module_id, module_name, skill_name, skill_code, 
                       description, display_order, is_active
                FROM dbo.skills
                {where_sql}
                ORDER BY module_id, display_order, skill_name
            """
            
            cursor.execute(sql, params)
            
            columns = ['id', 'module_id', 'module_name', 'skill_name', 'skill_code',
                      'description', 'display_order', 'is_active']
            rows = cursor.fetchall()
            
            skills = []
            for row in rows:
                skill = dict(zip(columns, row))
                skills.append(skill)
            
            logger.info(f"🔍 查询技能列表: {len(skills)} 个技能 (module_id={module_id}), 操作人: {current_user['name']}")
            
            return {
                'skills': skills,
                'count': len(skills)
            }
    
    except Exception as e:
        logger.error(f"❌ 查询技能列表失败: {e}")
        raise HTTPException(500, f"查询技能列表失败: {str(e)}")


@router.get("/{skill_id}")
def get_skill(
    skill_id: int,
    current_user: Dict = Depends(verify_admin)
):
    """查询技能详情（仅管理员）"""
    
    try:
        with db.get_cursor() as cursor:
            cursor.execute("""
                SELECT id, module_id, module_name, skill_name, skill_code,
                       description, display_order, is_active
                FROM dbo.skills
                WHERE id = ?
            """, (skill_id,))
            
            row = cursor.fetchone()
            
            if not row:
                raise HTTPException(404, "技能不存在")
            
            skill = {
                'id': row[0],
                'module_id': row[1],
                'module_name': row[2],
                'skill_name': row[3],
                'skill_code': row[4],
                'description': row[5],
                'display_order': row[6],
                'is_active': row[7]
            }
            
            logger.info(f"🔍 查询技能详情: {skill['skill_name']}, 操作人: {current_user['name']}")
            
            return skill
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ 查询技能详情失败: {e}")
        raise HTTPException(500, f"查询技能详情失败: {str(e)}")


@router.put("/{skill_id}")
def update_skill(
    skill_id: int,
    skill_data: SkillUpdate,
    current_user: Dict = Depends(verify_admin)
):
    """
    更新技能（仅管理员）
    
    自动记录字段级审计日志：
    - 只记录实际变更的字段
    - 每个字段一条日志（field_name, old_value, new_value）
    """
    
    try:
        # 1. 查询旧值
        with db.get_cursor() as cursor:
            cursor.execute("""
                SELECT module_id, module_name, skill_name, skill_code, description, display_order
                FROM dbo.skills
                WHERE id = ? AND is_active = 1
            """, (skill_id,))
            
            old_row = cursor.fetchone()
            
            if not old_row:
                raise HTTPException(404, "技能不存在")
            
            old_data = {
                'module_id': old_row[0],
                'module_name': old_row[1],
                'skill_name': old_row[2],
                'skill_code': old_row[3],
                'description': old_row[4],
                'display_order': old_row[5]
            }
        
        # 2. 构建更新语句（只更新非 None 的字段）
        update_fields = []
        params = []
        logs = []
        
        for field, new_value in skill_data.dict(exclude_none=True).items():
            old_value = old_data.get(field)
            if old_value != new_value:
                update_fields.append(f"{field} = ?")
                params.append(new_value)
                
                # 准备审计日志
                logs.append({
                    'table_name': 'skills',
                    'record_id': str(skill_id),
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
        
        # 3. 检查 skill_code 重复（如果要更新 skill_code）
        if 'skill_code' in skill_data.dict(exclude_none=True) and skill_data.skill_code:
            with db.get_cursor() as cursor:
                cursor.execute("""
                    SELECT COUNT(*) as count
                    FROM dbo.skills
                    WHERE skill_code = ? AND id != ? AND is_active = 1
                """, (skill_data.skill_code, skill_id))
                
                if cursor.fetchone()[0] > 0:
                    raise HTTPException(400, f"技能代码 '{skill_data.skill_code}' 已被其他技能使用")
        
        # 4. 执行更新
        params.append(skill_id)
        sql = f"""
            UPDATE dbo.skills
            SET {', '.join(update_fields)}
            WHERE id = ?
        """
        
        with db.get_cursor() as cursor:
            cursor.execute(sql, params)
        
        # 5. 批量记录审计日志
        if logs:
            log_audit_batch(logs)
        
        logger.info(f"✅ 更新技能: ID={skill_id}, {len(logs)} 个字段变更, 操作人: {current_user['name']}")
        
        # 6. 返回更新后的数据
        with db.get_cursor() as cursor:
            cursor.execute("""
                SELECT id, module_id, module_name, skill_name, skill_code,
                       description, display_order, is_active
                FROM dbo.skills
                WHERE id = ?
            """, (skill_id,))
            
            row = cursor.fetchone()
            
            return {
                'id': row[0],
                'module_id': row[1],
                'module_name': row[2],
                'skill_name': row[3],
                'skill_code': row[4],
                'description': row[5],
                'display_order': row[6],
                'is_active': row[7]
            }
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ 更新技能失败: {e}")
        raise HTTPException(500, f"更新技能失败: {str(e)}")


@router.delete("/{skill_id}")
def delete_skill(
    skill_id: int,
    current_user: Dict = Depends(verify_admin)
):
    """
    软删除技能（仅管理员）
    
    设置 is_active = false，不物理删除记录
    记录审计日志：operation_type='DELETE'
    """
    
    try:
        # 1. 查询旧值
        with db.get_cursor() as cursor:
            cursor.execute("""
                SELECT skill_name, skill_code
                FROM dbo.skills
                WHERE id = ? AND is_active = 1
            """, (skill_id,))
            
            old_row = cursor.fetchone()
            
            if not old_row:
                raise HTTPException(404, "技能不存在或已被删除")
        
        # 2. 软删除（设置 is_active = false）
        with db.get_cursor() as cursor:
            cursor.execute("""
                UPDATE dbo.skills
                SET is_active = 0
                WHERE id = ?
            """, (skill_id,))
        
        # 3. 记录审计日志
        log_audit(
            table_name='skills',
            record_id=str(skill_id),
            operation_type='DELETE',
            operator_id=current_user['user_id'],
            operator_name=current_user['name'],
            operator_email=current_user['email'],
            old_value=f"skill_name={old_row[0]}, skill_code={old_row[1]}"
        )
        
        logger.info(f"✅ 删除技能: {old_row[0]} (ID={skill_id}), 操作人: {current_user['name']}")
        
        return {
            'message': f'技能 "{old_row[0]}" 已删除'
        }
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ 删除技能失败: {e}")
        raise HTTPException(500, f"删除技能失败: {str(e)}")


@router.post("/batch-delete")
def batch_delete_skills(
    request: BatchDeleteRequest,
    current_user: Dict = Depends(verify_admin)
):
    """
    批量软删除技能（仅管理员）
    
    功能：
    - 批量设置多个技能的 is_active = false
    - 跳过不存在或已删除的技能
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
    
    for skill_id_str in request.ids:
        try:
            # 1. 验证 ID 是整数
            try:
                skill_id = int(skill_id_str)
            except (ValueError, TypeError):
                failed_count += 1
                errors.append({
                    'id': skill_id_str,
                    'error': 'ID 格式无效'
                })
                continue
            
            # 2. 查询技能是否存在且激活
            with db.get_cursor() as cursor:
                cursor.execute("""
                    SELECT skill_name, skill_code
                    FROM dbo.skills
                    WHERE id = ? AND is_active = 1
                """, (skill_id,))
                
                old_row = cursor.fetchone()
                
                if not old_row:
                    failed_count += 1
                    errors.append({
                        'id': skill_id_str,
                        'error': '技能不存在或已被删除'
                    })
                    continue
            
            # 3. 软删除
            with db.get_cursor() as cursor:
                cursor.execute("""
                    UPDATE dbo.skills
                    SET is_active = 0
                    WHERE id = ?
                """, (skill_id,))
            
            # 4. 准备审计日志
            audit_logs.append({
                'table_name': 'skills',
                'record_id': str(skill_id),
                'operation_type': 'DELETE',
                'operator_id': current_user['user_id'],
                'operator_name': current_user['name'],
                'operator_email': current_user['email'],
                'old_value': f"skill_name={old_row[0]}, skill_code={old_row[1]}"
            })
            
            deleted_count += 1
            logger.info(f"✅ 批量删除技能: {old_row[0]} ({skill_id})")
        
        except Exception as e:
            failed_count += 1
            errors.append({
                'id': skill_id_str,
                'error': str(e)
            })
            logger.error(f"❌ 批量删除技能失败 ({skill_id_str}): {e}")
    
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
def export_skills_csv(
    include_inactive: bool = Query(False, description="是否包含已删除的技能"),
    module_id: Optional[int] = Query(None, description="按模块筛选"),
    fields: Optional[str] = Query(None, description="导出字段（逗号分隔），默认全部字段"),
    current_user: Dict = Depends(verify_admin)
):
    """
    导出技能列表为 CSV 文件（仅管理员）
    
    参数：
    - include_inactive: 是否包含已删除的技能
    - module_id: 按模块筛选
    - fields: 指定导出字段，例如 'id,skill_name,module_name'，默认导出所有字段
    
    返回：
    - CSV 文件流，浏览器自动下载
    """
    
    try:
        # 1. 定义可用字段
        available_fields = ['id', 'module_id', 'module_name', 'skill_name', 'skill_code', 'description', 'display_order', 'is_active']
        
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
        
        if module_id is not None:
            where_conditions.append("module_id = ?")
            params.append(module_id)
        
        where_clause = "WHERE " + " AND ".join(where_conditions) if where_conditions else ""
        field_list = ', '.join(selected_fields)
        
        # 4. 查询数据
        with db.get_cursor() as cursor:
            sql = f"""
                SELECT {field_list}
                FROM dbo.skills
                {where_clause}
                ORDER BY module_id, display_order
            """
            cursor.execute(sql, params)
            rows = cursor.fetchall()
        
        # 5. 生成 CSV
        output = StringIO()
        writer = csv.writer(output)
        
        # 写入表头（中文）
        header_map = {
            'id': 'ID',
            'module_id': '模块ID',
            'module_name': '模块名称',
            'skill_name': '技能名称',
            'skill_code': '技能代码',
            'description': '描述',
            'display_order': '显示顺序',
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
        
        logger.info(f"✅ 导出技能 CSV: {len(rows)} 条记录, 操作人: {current_user['name']}")
        
        # 7. 返回 CSV 文件流
        return StreamingResponse(
            iter([csv_content.encode('utf-8-sig')]),  # BOM for Excel compatibility
            media_type="text/csv",
            headers={
                "Content-Disposition": "attachment; filename=skills.csv"
            }
        )
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ 导出技能 CSV 失败: {e}")
        raise HTTPException(500, f"导出 CSV 失败: {str(e)}")


@router.post("/import/csv")
async def import_skills_csv(
    file: UploadFile = File(...),
    current_user: Dict = Depends(verify_admin)
):
    """
    从 CSV/Excel 文件导入技能（仅管理员，pandas 增强版）
    
    文件格式支持：
    - CSV (.csv) - UTF-8编码
    - Excel (.xlsx) - 直接读取
    
    CSV/Excel 格式要求：
    - 第一行：表头（中文或英文）
    - 必填字段：模块ID/module_id, 模块名称/module_name, 技能名称/skill_name, 显示顺序/display_order
    - 可选字段：技能代码/skill_code, 描述/description
    
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
            '模块ID': 'module_id',
            'module_id': 'module_id',
            '模块名称': 'module_name',
            'module_name': 'module_name',
            '技能名称': 'skill_name',
            'skill_name': 'skill_name',
            '技能代码': 'skill_code',
            'skill_code': 'skill_code',
            '描述': 'description',
            'description': 'description',
            '显示顺序': 'display_order',
            'display_order': 'display_order'
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
                module_id_str = str(row.get('module_id', '')).strip()
                module_name = str(row.get('module_name', '')).strip()
                skill_name = str(row.get('skill_name', '')).strip()
                skill_code = str(row.get('skill_code', '')).strip() or None
                description = str(row.get('description', '')).strip() or None
                display_order_str = str(row.get('display_order', '')).strip()
                
                # 验证必填字段
                if not module_id_str:
                    raise ValueError("模块ID不能为空")
                if not module_name:
                    raise ValueError("模块名称不能为空")
                if not skill_name:
                    raise ValueError("技能名称不能为空")
                if not display_order_str:
                    raise ValueError("显示顺序不能为空")
                
                # 验证数字字段
                try:
                    module_id = int(module_id_str)
                    display_order = int(display_order_str)
                except (ValueError, TypeError):
                    raise ValueError("模块ID和显示顺序必须是整数")
                
                # 插入数据
                with db.get_cursor() as cursor:
                    cursor.execute("""
                        INSERT INTO dbo.skills (
                            module_id, module_name, skill_name, skill_code, description, display_order
                        )
                        OUTPUT INSERTED.id
                        VALUES (?, ?, ?, ?, ?, ?)
                    """, (
                        module_id,
                        module_name,
                        skill_name,
                        skill_code,
                        description,
                        display_order
                    ))
                    skill_id = cursor.fetchone()[0]
                
                # 准备审计日志
                audit_logs.append({
                    'table_name': 'skills',
                    'record_id': str(skill_id),
                    'operation_type': 'INSERT',
                    'operator_id': current_user['user_id'],
                    'operator_name': current_user['name'],
                    'operator_email': current_user['email'],
                    'new_value': f"skill_name={skill_name}, module={module_name}"
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
