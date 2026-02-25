"""
任务匹配路由
Task Matching Router - 智能任务分配系统
"""

from fastapi import APIRouter, HTTPException, Depends
from typing import List, Dict, Any
from datetime import datetime, timedelta
from uuid import UUID
import logging
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from models import MessageResponse
from database import get_db
from .auth import get_current_user

logger = logging.getLogger(__name__)
router = APIRouter()


# ============================================================================
# 辅助函数
# ============================================================================

def count_work_slots(start_date: datetime, end_date: datetime) -> int:
    """
    计算工作日时段数（排除周末）
    每个工作日 = 2个时段（AM + PM）
    """
    count = 0
    current = start_date
    while current <= end_date:
        # 0=周一, 6=周日
        if current.weekday() < 5:  # 周一到周五
            count += 2
        current += timedelta(days=1)
    return count


def calculate_skill_score(candidate_assessments: List[Dict], required_items: List[Dict]) -> Dict[str, Any]:
    """
    计算候选人的技能匹配评分
    
    参数:
        candidate_assessments: 候选人的能力评估列表
        required_items: 任务要求的能力列表
    
    返回:
        {
            'skill_score': float,  # 技能评分 (0-1+)
            'items': [...],        # 详细计算过程
            'sum_w': int           # 总权重
        }
    """
    items = []
    sum_w = 0
    
    for req in required_items:
        item_id = req['skill_id']
        required_level = req['required_level']
        is_key = req['is_key']
        
        # 查找候选人对该技能的评估
        assessment = next(
            (a for a in candidate_assessments if a['skill_id'] == item_id),
            None
        )
        
        Ci = assessment['current_level'] if assessment else 0
        Ti = assessment['target_level'] if assessment else 0
        Ri = required_level
        
        # 计算单项得分
        base = min(Ci / Ri, 1.0) if Ri > 0 else 0
        bonus = 0.1 if Ti > Ci else 0
        w = 2 if is_key else 1
        si = (base + bonus) * w
        
        items.append({
            'skill_id': item_id,
            'Ci': Ci,
            'Ri': Ri,
            'Ti': Ti,
            'is_key': is_key,
            'base': round(base, 2),
            'bonus': bonus,
            'w': w,
            'si': round(si, 2)
        })
        
        sum_w += w
    
    # 计算加权平均
    total_score = sum(item['si'] for item in items)
    skill_score = total_score / sum_w if sum_w > 0 else 0
    
    return {
        'skill_score': round(skill_score, 2),
        'items': items,
        'sum_w': sum_w
    }


def check_role_gate(
    role: str,
    candidate_assessments: List[Dict],
    required_items: List[Dict],
    role_thresholds: Dict[str, Dict[str, float]]
) -> str:
    """
    检查候选人是否满足角色门槛
    
    返回: 'OK' | 'LEAD_LOW' | 'EXPERT_LOW'
    """
    if role not in ['Lead', 'Expert']:
        return 'OK'
    
    # 计算关键项平均分
    key_skill_ids = [req['skill_id'] for req in required_items if req['is_key']]
    key_assessments = [a for a in candidate_assessments if a['skill_id'] in key_skill_ids]
    
    key_item_mean = 0
    if key_assessments:
        key_item_mean = sum(a['current_level'] for a in key_assessments) / len(key_assessments)
    
    # 计算模块平均分
    all_skill_ids = [req['skill_id'] for req in required_items]
    module_assessments = [a for a in candidate_assessments if a['skill_id'] in all_skill_ids]
    
    module_mean = 0
    if module_assessments:
        module_mean = sum(a['current_level'] for a in module_assessments) / len(module_assessments)
    
    # 检查阈值
    threshold = role_thresholds.get(role, {})
    if (key_item_mean >= threshold.get('keyItem', 0) and 
        module_mean >= threshold.get('moduleMean', 0)):
        return 'OK'
    
    return 'LEAD_LOW' if role == 'Lead' else 'EXPERT_LOW'


def generate_match_reason(skill_score: float, time_score: float, qualified: bool, role_gate: str) -> str:
    """
    生成匹配原因说明
    """
    reasons = []
    
    # 计算综合得分
    final_score = skill_score * 0.5 + time_score * 0.5
    
    # 技能评估（匹配程度）
    if skill_score >= 1.0:
        reasons.append("✅ 能力完全匹配")
    elif skill_score >= 0.8:
        reasons.append("✅ 能力基本满足")
    elif skill_score >= 0.6:
        reasons.append("⚠️ 能力略有不足")
    else:
        reasons.append("❌ 能力不满足")
    
    # 时间可用性
    if time_score >= 0.8:
        reasons.append("✅ 时间充裕")
    elif time_score >= 0.5:
        reasons.append("✅ 时间可用")
    elif time_score >= 0.3:
        reasons.append("⚠️ 时间紧张")
    else:
        reasons.append("❌ 时间冲突")
    
    # 角色门槛
    if role_gate == 'OK':
        reasons.append("✅ 角色达标")
    else:
        reasons.append(f"⚠️ 角色不足")
    
    # 总结（按规范：得分>=1为合适人选）
    if qualified:
        reasons.append(f"🎯 合适人选 ({final_score:.2f})")
    else:
        reasons.append(f"📋 推荐候选 ({final_score:.2f})")
    
    return " | ".join(reasons)


# ============================================================================
# API 端点
# ============================================================================

@router.get("/modules")
def get_modules(cursor=Depends(get_db)):
    """
    获取所有能力模块列表
    用于任务匹配界面的模块选择
    
    注意：skills表中同一个module_id可能对应多个module_name（中英文）
    这里使用ROW_NUMBER()只取第一个
    """
    cursor.execute("""
        WITH RankedModules AS (
            SELECT 
                module_id, 
                module_name,
                ROW_NUMBER() OVER (PARTITION BY module_id ORDER BY module_name) as rn
            FROM dbo.skills
            WHERE is_active = 1
        )
        SELECT module_id, module_name
        FROM RankedModules
        WHERE rn = 1
        ORDER BY module_id
    """)
    
    modules = []
    skill_count_query = """
        SELECT COUNT(*) FROM dbo.skills 
        WHERE module_id = ? AND is_active = 1
    """
    
    for row in cursor.fetchall():
        module_id = row[0]
        module_name = row[1]
        
        # 获取该模块下的技能数量
        cursor.execute(skill_count_query, module_id)
        skill_count = cursor.fetchone()[0]
        
        modules.append({
            'id': module_id,
            'name': module_name,
            'skillCount': skill_count
        })
    
    return modules


@router.get("/skills")
def get_skills(module_id: int = None, cursor=Depends(get_db)):
    """
    获取技能列表，可按模块筛选
    """
    if module_id:
        cursor.execute("""
            SELECT id, module_id, module_name, skill_name, skill_code, display_order
            FROM dbo.skills
            WHERE module_id = ? AND is_active = 1
            ORDER BY display_order, skill_name
        """, module_id)
    else:
        cursor.execute("""
            SELECT id, module_id, module_name, skill_name, skill_code, display_order
            FROM dbo.skills
            WHERE is_active = 1
            ORDER BY module_id, display_order, skill_name
        """)
    
    skills = []
    for row in cursor.fetchall():
        skills.append({
            'id': row[0],
            'moduleId': row[1],
            'moduleName': row[2],
            'name': row[3],  # skill_name映射为name
            'skillName': row[3],  # 同时保留skillName字段
            'code': row[4] if row[4] else None,
            'displayOrder': row[5] if row[5] else 0,  # 添加displayOrder字段
            'isKeyDefault': False,
        })
    
    return skills


@router.post("/preview")
def preview_matching(
    request: Dict[str, Any],
    cursor=Depends(get_db)
):
    """
    预览任务匹配结果
    
    请求体:
    {
        "name": "任务名称",
        "role": "Lead|Expert|Member|Coach",
        "moduleId": 1,
        "type": "WS",
        "location": "FDCCh",
        "topic": "TPM",
        "startDate": "2025-02-01",
        "endDate": "2025-02-07",
        "required": [
            {"skill_id": 10, "required_level": 4, "is_key": true},
            {"skill_id": 11, "required_level": 3, "is_key": false}
        ],
        "suggestedUserId": "uuid-string"  // 可选
    }
    """
    try:
        # 解析请求参数
        role = request.get('role')
        module_id = request.get('moduleId')
        start_date = datetime.fromisoformat(request.get('startDate'))
        end_date = datetime.fromisoformat(request.get('endDate'))
        required_items = request.get('required', [])
        suggested_user_id = request.get('suggestedUserId')
        
        # 角色门槛配置（与前端 constants.ts ROLE_THRESHOLDS 保持一致）
        role_thresholds = {
            'Lead': {'keyItem': 4.0, 'moduleMean': 3.5},
            'Expert': {'keyItem': 4.5, 'moduleMean': 4.0}
        }
        
        # 计算任务时段数
        total_slots = count_work_slots(start_date, end_date)
        
        # 获取所有活跃员工
        cursor.execute("""
            SELECT e.id, e.name, 
                   d.name as dept_name
            FROM dbo.employees e
            LEFT JOIN dbo.departments d ON e.department_id = d.id
            WHERE e.is_active = 1
        """)
        
        employees = []
        for row in cursor.fetchall():
            employees.append({
                'id': str(row[0]),
                'name': row[1],
                'dept': row[2] or 'Unknown',
                'homeLocation': 'N/A'  # 工厂信息暂不可用
            })
        
        candidates = []
        
        # 遍历每个员工进行匹配计算
        for emp in employees:
            employee_id = emp['id']
            
            # 1. 获取员工的能力评估
            skill_ids = tuple([req['skill_id'] for req in required_items])
            if not skill_ids:
                continue
                
            placeholders = ','.join(['?' for _ in skill_ids])
            cursor.execute(f"""
                SELECT skill_id, current_level, target_level
                FROM dbo.competency_assessments
                WHERE employee_id = ? 
                  AND skill_id IN ({placeholders})
                ORDER BY assessment_date DESC
            """, employee_id, *skill_ids)
            
            assessments = []
            for row in cursor.fetchall():
                assessments.append({
                    'skill_id': row[0],
                    'current_level': row[1],
                    'target_level': row[2]
                })
            
            # 2. 计算技能评分
            skill_result = calculate_skill_score(assessments, required_items)
            
            # 3. 计算时间可用性（从任务表查询已占用时段）
            # 查询该员工在任务时间段内的已分配任务
            cursor.execute("""
                SELECT COUNT(*) as task_count
                FROM dbo.tasks
                WHERE assigned_employee_id = ?
                  AND (
                      (start_date <= ? AND end_date >= ?)
                      OR
                      (start_date >= ? AND end_date <= ?)
                      OR
                      (start_date <= ? AND end_date >= ?)
                  )
                  AND status NOT IN ('cancelled', 'completed')
            """, employee_id, 
                request.get('endDate'), request.get('startDate'),  # 任务开始在时间段内
                request.get('startDate'), request.get('endDate'),  # 任务完全在时间段内
                request.get('startDate'), request.get('endDate'))  # 任务结束在时间段内
            
            cursor.fetchone()  # 消费结果集（occupied_tasks 不直接使用，由下方精确查询替代）
            
            # 优化：查询实际占用的工时，而不是简单乘以2
            # 如果有time_slot字段，可以更精确计算
            cursor.execute("""
                SELECT COALESCE(SUM(
                    CASE 
                        WHEN time_slot = 'FULL_DAY' THEN 2
                        WHEN time_slot = 'AM' THEN 1
                        WHEN time_slot = 'PM' THEN 1
                        ELSE 2
                    END
                ), 0) as occupied_slots
                FROM dbo.tasks
                WHERE assigned_employee_id = ?
                  AND (
                      (start_date <= ? AND end_date >= ?)
                      OR
                      (start_date >= ? AND end_date <= ?)
                      OR
                      (start_date <= ? AND end_date >= ?)
                  )
                  AND status NOT IN ('cancelled', 'completed')
            """, employee_id, 
                request.get('endDate'), request.get('startDate'),
                request.get('startDate'), request.get('endDate'),
                request.get('startDate'), request.get('endDate'))
            
            occupied_slots_result = cursor.fetchone()
            occupied_slots = occupied_slots_result[0] if occupied_slots_result else 0
            
            free_slots = max(total_slots - occupied_slots, 0)
            time_score = min(free_slots / total_slots, 1.0) if total_slots > 0 else 0
            
            # 时间完全不可用的候选人，时间分数为0
            if free_slots <= 0:
                time_score = 0
            
            # 4. 计算综合评分（按规范：0.5匹配程度 + 0.5可用时间率）
            skill_weight = 0.5
            time_weight = 0.5
            
            # 匹配得分 = 0.5 * 匹配程度 + 0.5 * 可用时间率
            final_score = skill_result['skill_score'] * skill_weight + time_score * time_weight
            
            # 合格标准：能力匹配>=70% 且 时间可用率>=50%
            qualified = skill_result['skill_score'] >= 0.7 and time_score >= 0.5
            
            # 5. 角色门槛检查
            role_gate = check_role_gate(role, assessments, required_items, role_thresholds)
            
            # 6. 标签
            badges = []
            if suggested_user_id and employee_id == suggested_user_id:
                badges.append('suggested')
            
            candidates.append({
                'userId': employee_id,
                'name': emp['name'],
                'dept': emp['dept'],
                'homeLocation': emp['homeLocation'],
                'skillScore': round(skill_result['skill_score'], 2),
                'timeScore': round(time_score, 2),
                'finalScore': round(final_score, 2),
                'qualified': qualified,
                'roleGate': role_gate,
                'badges': badges,
                'explain': {
                    'items': skill_result['items'],
                    'sumW': skill_result['sum_w'],
                    'skillScore': round(skill_result['skill_score'], 2),
                    'time': {
                        'totalSlots': total_slots,
                        'occupiedSlots': occupied_slots,
                        'freeSlots': free_slots,
                        'timeScore': round(time_score, 2),
                        'availability': f"{round(time_score * 100)}%"
                    },
                    'weights': {
                        'skill': 0.5,
                        'time': 0.5
                    },
                    'reason': generate_match_reason(
                        skill_result['skill_score'], 
                        time_score, 
                        qualified, 
                        role_gate
                    )
                }
            })
        
        # 排序候选人
        def sort_key(c):
            # 建议人选优先
            if 'suggested' in c['badges']:
                return (0, -c['finalScore'])
            # 合格人选优先
            if c['qualified']:
                return (1, -c['finalScore'])
            # 其他按分数排序
            return (2, -c['finalScore'])
        
        candidates.sort(key=sort_key)
        top5 = candidates[:5]
        
        logger.info(f"✅ 任务匹配完成: 共 {len(candidates)} 位候选人，返回 Top {len(top5)} 位")
        
        return top5
        
    except Exception as e:
        logger.error(f"❌ 任务匹配失败: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/assign")
def assign_task(
    assignment: Dict[str, Any],
    current_user: dict = Depends(get_current_user),
    cursor=Depends(get_db)
):
    """
    提交任务申请（任何已登录用户）
    创建 status=pending_approval 的任务，并通知所有 admin 审批

    请求体:
    {
        "taskName": "任务名称",
        "employeeId": "uuid",
        "taskType": "WS",
        "location": "FDCCh",
        "startDate": "2025-02-01",
        "endDate": "2025-02-07",
        "required": [...],
        "notes": "备注"
    }
    """
    try:
        requester_id = current_user['user_id']

        # 1. 创建 pending_approval 任务
        cursor.execute("""
            INSERT INTO dbo.tasks (
                task_name, task_type, task_location,
                assigned_employee_id, start_date, end_date,
                notes, status, requester_id, created_at, updated_at
            ) OUTPUT INSERTED.id
            VALUES (?, ?, ?, ?, ?, ?, ?, 'pending_approval', ?, GETDATE(), GETDATE())
        """,
            assignment.get('taskName'),
            assignment.get('taskType'),
            assignment.get('location'),
            assignment.get('employeeId'),
            assignment.get('startDate'),
            assignment.get('endDate'),
            (assignment.get('notes', '') + ' [来源:智能匹配系统]').strip(),
            requester_id
        )

        # 获取新任务 ID（OUTPUT INSERTED.id 直接返回生成的 UUID）
        task_row = cursor.fetchone()
        task_id = str(task_row[0]) if task_row else None

        # 2. 通知所有 admin 审批
        from .notifications import create_notification, get_all_admin_ids
        task_name = assignment.get('taskName', '未命名任务')
        admin_ids = get_all_admin_ids(cursor)
        for admin_id in admin_ids:
            create_notification(
                cursor, admin_id,
                'task_submitted',
                f'新任务申请待审批：{task_name}',
                f'有新的任务申请需要您审批，任务名称：{task_name}，时间：{assignment.get("startDate")} ~ {assignment.get("endDate")}',
                task_id
            )

        cursor.commit()
        logger.info(f"✅ 任务申请提交: {task_name} -> 待审批，任务ID: {task_id}")

        return {
            'success': True,
            'taskId': task_id,
            'status': 'pending_approval',
            'message': '任务申请已提交，等待 Site PS 审批'
        }

    except Exception as e:
        cursor.rollback()
        logger.error(f"❌ 任务申请提交失败: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/force-assign")
def force_assign_task(
    assignment: Dict[str, Any],
    current_user: dict = Depends(get_current_user),
    cursor=Depends(get_db)
):
    """
    强制指派（仅 admin 可用）
    跳过 pending_approval，直接创建 status=planned 任务，并通知被指派工程师

    请求体同 /assign
    """
    # 权限检查
    if current_user.get('role') != 'admin':
        raise HTTPException(status_code=403, detail="仅 Site PS (admin) 可使用强制指派")

    try:
        requester_id = current_user['user_id']

        # 1. 直接创建 planned 任务（跳过审批）
        cursor.execute("""
            INSERT INTO dbo.tasks (
                task_name, task_type, task_location,
                assigned_employee_id, start_date, end_date,
                notes, status, requester_id, created_at, updated_at
            ) OUTPUT INSERTED.id
            VALUES (?, ?, ?, ?, ?, ?, ?, 'planned', ?, GETDATE(), GETDATE())
        """,
            assignment.get('taskName'),
            assignment.get('taskType'),
            assignment.get('location'),
            assignment.get('employeeId'),
            assignment.get('startDate'),
            assignment.get('endDate'),
            (assignment.get('notes', '') + ' [来源:智能匹配系统/强制指派]').strip(),
            requester_id
        )

        task_row = cursor.fetchone()
        task_id = str(task_row[0]) if task_row else None

        # 2. 通知被指派工程师
        employee_id = assignment.get('employeeId')
        task_name = assignment.get('taskName', '未命名任务')
        if employee_id:
            # 查找员工对应的 user（通过 employees 表）
            cursor.execute("""
                SELECT u.id FROM dbo.users u
                INNER JOIN dbo.employees e ON e.email = u.email
                WHERE e.id = ?
            """, employee_id)
            user_row = cursor.fetchone()
            if user_row:
                from .notifications import create_notification
                create_notification(
                    cursor, str(user_row[0]),
                    'task_approved',
                    f'您有新任务待确认：{task_name}',
                    f'Site PS 已为您分配任务：{task_name}，时间：{assignment.get("startDate")} ~ {assignment.get("endDate")}，请前往日程页确认接受。',
                    task_id
                )

        cursor.commit()
        logger.info(f"✅ 强制指派完成: {task_name} -> {employee_id}，任务ID: {task_id}")

        return {
            'success': True,
            'taskId': task_id,
            'status': 'planned',
            'message': '强制指派成功，任务已写入日程，等待工程师确认'
        }

    except Exception as e:
        cursor.rollback()
        logger.error(f"❌ 强制指派失败: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/history")
def get_matching_history(
    limit: int = 20,
    current_user: dict = Depends(get_current_user),
    cursor=Depends(get_db)
):
    """
    获取匹配历史记录
    - admin: 看到所有通过智能匹配系统提交的任务
    - 普通用户: 只看到自己提交的任务
    """
    is_admin = current_user.get('role') == 'admin'
    requester_id = current_user.get('user_id')
    
    logger.info(f"🔍 查询匹配历史: user_id={requester_id}, is_admin={is_admin}, limit={limit}")

    if is_admin:
        cursor.execute("""
            SELECT TOP (?)
                t.id, t.task_name, t.task_type, t.task_location,
                t.assigned_employee_id, e.name as employee_name,
                t.start_date, t.end_date,
                t.created_at, t.status, t.rejection_reason,
                u.name as requester_name
            FROM dbo.tasks t
            LEFT JOIN dbo.employees e ON t.assigned_employee_id = e.id
            LEFT JOIN dbo.users u ON t.requester_id = u.id
            WHERE t.notes COLLATE Chinese_PRC_CI_AS LIKE N'%智能匹配系统%'
            ORDER BY t.created_at DESC
        """, limit)
    else:
        cursor.execute("""
            SELECT TOP (?)
                t.id, t.task_name, t.task_type, t.task_location,
                t.assigned_employee_id, e.name as employee_name,
                t.start_date, t.end_date,
                t.created_at, t.status, t.rejection_reason,
                u.name as requester_name
            FROM dbo.tasks t
            LEFT JOIN dbo.employees e ON t.assigned_employee_id = e.id
            LEFT JOIN dbo.users u ON t.requester_id = u.id
            WHERE t.notes COLLATE Chinese_PRC_CI_AS LIKE N'%智能匹配系统%'
              AND t.requester_id = ?
            ORDER BY t.created_at DESC
        """, limit, requester_id)

    history = []
    for row in cursor.fetchall():
        history.append({
            'id': str(row[0]),
            'taskName': row[1],
            'taskType': row[2],
            'location': row[3],
            'employeeId': str(row[4]) if row[4] else None,
            'employeeName': row[5],
            'startDate': row[6].isoformat() if row[6] else None,
            'endDate': row[7].isoformat() if row[7] else None,
            'createdAt': row[8].isoformat() if row[8] else None,
            'status': row[9] or 'pending_approval',
            'rejectionReason': row[10],
            'requesterName': row[11],
        })
    
    logger.info(f"📊 查询到 {len(history)} 条匹配历史记录")
    return history
