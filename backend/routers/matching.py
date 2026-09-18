"""
任务匹配路由
Task Matching Router - 智能任务分配系统
"""

from fastapi import APIRouter, HTTPException, Depends
from typing import List, Dict, Any
from datetime import date, datetime, timedelta
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

SCHEDULE_EXEMPT_EMPLOYEE_CODES = frozenset({
    '15001437',
    'sch_tyler_tan',
})


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


def calculate_competency_fit(candidate_assessments: List[Dict], required_items: List[Dict]) -> Dict[str, Any]:
    """Calculate eligibility and the time-tie competency priorities."""

    assessments_by_skill = {
        int(item['skill_id']): item
        for item in candidate_assessments
    }
    total_weight = 0
    target_exact_weight = 0
    current_exact_weight = 0
    weighted_overqualification = 0
    eligible = bool(required_items)
    items = []

    for req in required_items:
        skill_id = int(req['skill_id'])
        required_level = int(req['required_level'])
        weight = 2 if req.get('is_key') else 1
        assessment = assessments_by_skill.get(skill_id)
        total_weight += weight

        if not assessment:
            eligible = False
            continue

        current_level = int(assessment['current_level'])
        target_level = int(assessment['target_level'])
        target_exact = target_level == required_level
        current_exact = current_level == required_level
        if not target_exact and current_level < required_level:
            eligible = False

        if target_exact:
            target_exact_weight += weight
        if current_exact:
            current_exact_weight += weight
        weighted_overqualification += max(current_level - required_level, 0) * weight
        items.append({
            'itemId': skill_id,
            'Ci': current_level,
            'Ri': required_level,
            'Ti': target_level,
            'isKey': bool(req.get('is_key')),
            'w': weight,
            'fitType': (
                'target_match' if target_exact
                else 'current_match' if current_exact
                else 'overqualified'
            ),
        })

    target_match_rate = round(target_exact_weight / total_weight, 2) if total_weight else 0
    current_match_rate = round(current_exact_weight / total_weight, 2) if total_weight else 0
    overqualification = round(weighted_overqualification / total_weight, 2) if total_weight else 0
    category = (
        'target_match' if target_exact_weight
        else 'current_match' if current_exact_weight
        else 'overqualified'
    )
    return {
        'eligible': eligible,
        'target_match_rate': target_match_rate,
        'current_match_rate': current_match_rate,
        'overqualification': overqualification,
        'category': category,
        'items': items,
        'sum_w': total_weight,
    }


def meets_required_levels(candidate_assessments: List[Dict], required_items: List[Dict]) -> bool:
    """A target-exact or current-at/above fit is required for every requested skill."""

    return calculate_competency_fit(candidate_assessments, required_items)['eligible']


def _as_date(value: Any) -> date:
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, date):
        return value
    return datetime.fromisoformat(str(value)).date()


def calculate_time_availability(start_date: Any, end_date: Any, task_rows: List[Any]) -> Dict[str, Any]:
    """Calculate requested weekday availability using 3.5h AM and 4.5h PM slots."""

    request_start = _as_date(start_date)
    request_end = _as_date(end_date)
    requested_slots = set()
    current = request_start
    while current <= request_end:
        if current.weekday() < 5:
            requested_slots.add((current.isoformat(), 'AM'))
            requested_slots.add((current.isoformat(), 'PM'))
        current += timedelta(days=1)

    occupied = {}
    for task_start, task_end, time_slot, task_name in task_rows:
        current = max(_as_date(task_start), request_start)
        last_date = min(_as_date(task_end), request_end)
        normalized_slot = str(time_slot or 'FULL_DAY').upper()
        slots = (normalized_slot,) if normalized_slot in ('AM', 'PM') else ('AM', 'PM')
        while current <= last_date:
            if current.weekday() < 5:
                for slot in slots:
                    key = (current.isoformat(), slot)
                    if key in requested_slots:
                        occupied.setdefault(key, task_name or '')
            current += timedelta(days=1)

    slot_hours = {'AM': 3.5, 'PM': 4.5}
    total_hours = sum(slot_hours[slot] for _, slot in requested_slots)
    occupied_hours = sum(slot_hours[slot] for _, slot in occupied)
    free_hours = max(total_hours - occupied_hours, 0)
    time_score = free_hours / total_hours if total_hours else 0
    conflicts = [
        {'date': day, 'slot': slot, 'taskName': occupied[(day, slot)]}
        for day, slot in sorted(occupied)
    ]
    return {
        'total_slots': len(requested_slots),
        'occupied_slots': len(occupied),
        'free_slots': len(requested_slots) - len(occupied),
        'total_hours': round(total_hours, 1),
        'occupied_hours': round(occupied_hours, 1),
        'free_hours': round(free_hours, 1),
        'time_score': round(time_score, 4),
        'conflicts': conflicts,
    }


def matching_candidate_sort_key(candidate: Dict[str, Any]):
    return (
        -candidate['timeScore'],
        -candidate['targetMatchRate'],
        -candidate['currentMatchRate'],
        candidate['overqualification'],
        0 if 'suggested' in candidate['badges'] else 1,
        candidate['name'].casefold(),
    )


def is_schedule_exempt_employee(employee_code: str) -> bool:
    return str(employee_code or '').strip().casefold() in SCHEDULE_EXEMPT_EMPLOYEE_CODES


def candidate_passes_hard_gates(
    candidate_assessments: List[Dict],
    required_items: List[Dict],
    role_gate: str,
) -> bool:
    return (
        meets_required_levels(candidate_assessments, required_items)
        and role_gate == 'OK'
    )


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

    def req_key(req: Dict) -> Any:
        return req.get('skill_name') or req['skill_id']

    def assessment_key(assessment: Dict) -> Any:
        return assessment.get('skill_name') or assessment['skill_id']
    
    # 计算关键项平均分
    key_skill_ids = [req_key(req) for req in required_items if req['is_key']]
    key_assessments = [a for a in candidate_assessments if assessment_key(a) in key_skill_ids]
    
    key_item_mean = 0
    if key_assessments:
        key_item_mean = sum(a['current_level'] for a in key_assessments) / len(key_assessments)
    
    # 计算模块平均分
    all_skill_ids = [req_key(req) for req in required_items]
    module_assessments = [a for a in candidate_assessments if assessment_key(a) in all_skill_ids]
    
    module_mean = 0
    if module_assessments:
        module_mean = sum(a['current_level'] for a in module_assessments) / len(module_assessments)
    
    # 检查阈值
    threshold = role_thresholds.get(role, {})
    if (key_item_mean >= threshold.get('keyItem', 0) and 
        module_mean >= threshold.get('moduleMean', 0)):
        return 'OK'
    
    return 'LEAD_LOW' if role == 'Lead' else 'EXPERT_LOW'


def generate_match_reason(category: str, time_score: float) -> str:
    """Generate a concise explanation for the time-first ranking."""

    category_labels = {
        'target_match': '目标能力匹配',
        'current_match': '当前能力精准匹配',
        'overqualified': '当前能力高于要求',
    }
    availability = '时间完全匹配' if time_score == 1 else f'时间符合度 {round(time_score * 100)}%'
    return f"{availability}；{category_labels.get(category, '能力匹配')}"


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
        SELECT module_id, MIN(module_name) as module_name, COUNT(*) as skill_count
        FROM dbo.competency_definitions
        GROUP BY module_id
        ORDER BY module_id
    """)
    
    modules = []
    for row in cursor.fetchall():
        module_id = row[0]
        module_name = row[1]
        
        # 获取该模块下的技能数量
        skill_count = row[2]
        
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
    base_query = """
        SELECT
            COALESCE(exact_skill.id, fallback_skill.id) as id,
            cd.module_id,
            cd.module_name,
            cd.competency_type as skill_name,
            cd.competency_code as skill_code,
            COALESCE(exact_skill.display_order, fallback_skill.display_order, cd.id) as display_order
        FROM dbo.competency_definitions cd
        OUTER APPLY (
            SELECT TOP 1 s.id, s.display_order
            FROM dbo.skills s
            WHERE s.is_active = 1
              AND s.module_id = cd.module_id
              AND s.module_name = cd.module_name
              AND s.skill_name = cd.competency_type
            ORDER BY s.id
        ) exact_skill
        OUTER APPLY (
            SELECT TOP 1 s.id, s.display_order
            FROM dbo.skills s
            WHERE s.is_active = 1
              AND s.skill_name = cd.competency_type
            ORDER BY
              CASE WHEN s.module_id = cd.module_id THEN 0 ELSE 1 END,
              s.id
        ) fallback_skill
    """

    if module_id:
        cursor.execute(base_query + """
            WHERE cd.module_id = ?
            ORDER BY display_order, cd.competency_type
        """, module_id)
    else:
        cursor.execute(base_query + """
            ORDER BY cd.module_id, display_order, cd.competency_type
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
        if not request.get('startDate') or not request.get('endDate'):
            raise HTTPException(status_code=422, detail="必须提供任务开始和结束日期")
        start_date = datetime.fromisoformat(request.get('startDate'))
        end_date = datetime.fromisoformat(request.get('endDate'))
        if end_date < start_date:
            raise HTTPException(status_code=422, detail="任务结束日期不能早于开始日期")
        required_items = request.get('required', [])
        suggested_user_id = request.get('suggestedUserId')

        if not required_items:
            raise HTTPException(status_code=422, detail="至少需要一个能力要求")
        try:
            skill_ids = [int(req.get('skill_id')) for req in required_items]
            required_levels = [int(req.get('required_level')) for req in required_items]
        except (TypeError, ValueError):
            raise HTTPException(status_code=422, detail="能力要求格式无效")
        if len(skill_ids) != len(set(skill_ids)):
            raise HTTPException(status_code=422, detail="能力要求不能重复")
        if any(level < 0 or level > 4 for level in required_levels):
            raise HTTPException(status_code=422, detail="能力要求等级必须在 0 到 4 之间")
        required_items = [
            {
                **req,
                'skill_id': skill_ids[index],
                'required_level': required_levels[index],
                'is_key': bool(req.get('is_key')),
            }
            for index, req in enumerate(required_items)
        ]

        if required_items:
            requested_skill_ids = tuple(req['skill_id'] for req in required_items)
            placeholders = ','.join(['?' for _ in requested_skill_ids])
            cursor.execute(f"""
                SELECT id, skill_name
                FROM dbo.skills
                WHERE id IN ({placeholders})
            """, *requested_skill_ids)
            skill_names_by_id = {row[0]: row[1] for row in cursor.fetchall()}
            if len(skill_names_by_id) != len(requested_skill_ids):
                raise HTTPException(status_code=422, detail="能力要求中包含不存在的技能")
            required_items = [
                {
                    **req,
                    'skill_name': skill_names_by_id.get(req['skill_id'])
                }
                for req in required_items
            ]
        
        # 角色门槛配置（与前端 constants.ts ROLE_THRESHOLDS 保持一致）
        role_thresholds = {
            'Lead': {'keyItem': 4.0, 'moduleMean': 3.5},
            'Expert': {'keyItem': 4.5, 'moduleMean': 4.0}
        }
        
        # 计算任务时段数
        total_slots = count_work_slots(start_date, end_date)
        if total_slots == 0:
            raise HTTPException(status_code=422, detail="所选日期范围不包含工作日")
        
        # 获取所有活跃员工
        cursor.execute("""
            SELECT e.id, e.name,
                   d.name as dept_name,
                   e.employee_id
            FROM dbo.employees e
            LEFT JOIN dbo.departments d ON e.department_id = d.id
            WHERE ISNULL(e.is_active, 1) = 1
              AND EXISTS (
                  SELECT 1
                  FROM dbo.users u
                  WHERE ISNULL(u.is_active, 1) = 1
                    AND (
                        u.id = e.auth_user_id
                        OR (u.email IS NOT NULL AND e.email IS NOT NULL AND LOWER(u.email) = LOWER(e.email))
                    )
              )
        """)
        
        employees = []
        for row in cursor.fetchall():
            employees.append({
                'id': str(row[0]),
                'name': row[1],
                'dept': row[2] or 'Unknown',
                'homeLocation': 'N/A',  # 工厂信息暂不可用
                'employeeCode': row[3] or '',
            })
        
        candidates = []
        
        # 遍历每个员工进行匹配计算
        for emp in employees:
            employee_id = emp['id']
            
            # 1. 获取员工的能力评估
            requested_ids = tuple(int(req['skill_id']) for req in required_items)
            if not requested_ids:
                continue
                
            placeholders = ','.join(['?' for _ in requested_ids])
            cursor.execute(f"""
                SELECT
                    ca.skill_id,
                    s.skill_name,
                    ca.current_level,
                    ca.target_level
                FROM dbo.competency_assessments ca
                JOIN dbo.skills s ON s.id = ca.skill_id
                WHERE ca.employee_id = ?
                  AND ca.skill_id IN ({placeholders})
                  AND ISNULL(s.is_active, 1) = 1
            """, employee_id, *requested_ids)
            
            assessments = []
            for row in cursor.fetchall():
                assessments.append({
                    'skill_id': row[0],
                    'skill_name': row[1],
                    'current_level': row[2],
                    'target_level': row[3]
                })
            
            competency_fit = calculate_competency_fit(assessments, required_items)
            schedule_exempt = is_schedule_exempt_employee(emp['employeeCode'])
            task_rows = []
            if not schedule_exempt:
                cursor.execute("""
                    SELECT start_date, end_date, COALESCE(time_slot, 'FULL_DAY'), task_name
                    FROM dbo.tasks
                    WHERE assigned_employee_id = ?
                      AND start_date <= ?
                      AND end_date >= ?
                      AND status NOT IN ('cancelled', 'completed')
                """, employee_id, request.get('endDate'), request.get('startDate'))
                task_rows = cursor.fetchall()

            role_gate = check_role_gate(role, assessments, required_items, role_thresholds)
            if not candidate_passes_hard_gates(
                assessments,
                required_items,
                role_gate,
            ):
                continue

            availability = calculate_time_availability(start_date, end_date, task_rows)
            if schedule_exempt:
                availability = calculate_time_availability(start_date, end_date, [])
            time_score = availability['time_score']
            fully_available = time_score == 1.0
            
            # 6. 标签
            badges = []
            if suggested_user_id and employee_id == suggested_user_id:
                badges.append('suggested')
            
            candidates.append({
                'userId': employee_id,
                'name': emp['name'],
                'dept': emp['dept'],
                'homeLocation': emp['homeLocation'],
                'timeScore': round(time_score, 2),
                'targetMatchRate': competency_fit['target_match_rate'],
                'currentMatchRate': competency_fit['current_match_rate'],
                'overqualification': competency_fit['overqualification'],
                'matchCategory': competency_fit['category'],
                'qualified': True,
                'fullyAvailable': fully_available,
                'roleGate': role_gate,
                'badges': badges,
                'explain': {
                    'items': competency_fit['items'],
                    'sumW': competency_fit['sum_w'],
                    'targetMatchRate': competency_fit['target_match_rate'],
                    'currentMatchRate': competency_fit['current_match_rate'],
                    'overqualification': competency_fit['overqualification'],
                    'time': {
                        'totalSlots': availability['total_slots'],
                        'occupiedSlots': availability['occupied_slots'],
                        'freeSlots': availability['free_slots'],
                        'totalHours': availability['total_hours'],
                        'occupiedHours': availability['occupied_hours'],
                        'freeHours': availability['free_hours'],
                        'timeScore': round(time_score, 2),
                        'availability': f"{round(time_score * 100)}%",
                        'conflicts': availability['conflicts'],
                    },
                    'reason': generate_match_reason(competency_fit['category'], time_score),
                }
            })
        
        # 排序候选人
        candidates.sort(key=matching_candidate_sort_key)
        
        logger.info(f"✅ 任务匹配完成: 共 {len(candidates)} 位合格候选人")
        
        return candidates
        
    except HTTPException:
        raise
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
                t.created_at, t.updated_at, t.status, t.rejection_reason,
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
                t.created_at, t.updated_at, t.status, t.rejection_reason,
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
            'updatedAt': row[9].isoformat() if row[9] else None,
            'status': row[10] or 'pending_approval',
            'rejectionReason': row[11],
            'requesterName': row[12],
        })
    
    logger.info(f"📊 查询到 {len(history)} 条匹配历史记录")
    return history
