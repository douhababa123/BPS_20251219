"""
视图查询路由
提供各种业务视图的查询接口
"""

from fastapi import APIRouter, HTTPException, Depends
from typing import List, Optional, Dict, Any
from uuid import UUID
from datetime import datetime
import logging
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database import get_db
from .auth import get_current_user

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/employee-competency-matrix")
def get_employee_competency_matrix(
    department_id: Optional[int] = None,
    cursor=Depends(get_db)
):
    """
    获取员工能力矩阵视图
    显示每个员工在各个技能上的当前水平
    """
    query = """
        SELECT 
            e.id AS employee_id,
            e.employee_id AS employee_code,
            e.name AS employee_name,
            d.name AS department_name,
            s.skill_name,
            s.module_name,
            COALESCE(ca.current_level, 0) AS current_level,
            COALESCE(ca.target_level, 0) AS target_level,
            ca.assessment_date,
            ca.assessor_notes
        FROM dbo.employees e
        LEFT JOIN dbo.departments d ON e.department_id = d.id
        CROSS JOIN dbo.skills s
        LEFT JOIN dbo.competency_assessments ca 
            ON e.id = ca.employee_id AND s.id = ca.skill_id
        WHERE e.is_active = 1 AND s.is_active = 1
    """
    
    params = []
    if department_id:
        query += " AND e.department_id = ?"
        params.append(department_id)
    
    query += " ORDER BY e.name, s.module_name, s.skill_name"
    
    cursor.execute(query, params)
    
    results = []
    for row in cursor.fetchall():
        results.append({
            "employee_id": str(row[0]),
            "employee_code": row[1],
            "employee_name": row[2],
            "department_name": row[3],
            "skill_name": row[4],
            "module_name": row[5],
            "current_level": row[6],
            "target_level": row[7],
            "assessment_date": row[8],
            "assessor_notes": row[9]
        })
    
    return results


@router.get("/skill-gap-analysis")
def get_skill_gap_analysis(
    department_id: Optional[int] = None,
    min_gap: Optional[int] = 1,
    cursor=Depends(get_db)
):
    """
    技能差距分析视图
    显示有技能差距的员工（target_level > current_level）
    """
    query = """
        SELECT 
            e.id AS employee_id,
            e.employee_id AS employee_code,
            e.name AS employee_name,
            d.name AS department_name,
            s.skill_name,
            s.module_name,
            ca.current_level,
            ca.target_level,
            (ca.target_level - ca.current_level) AS gap,
            ca.assessment_date
        FROM dbo.competency_assessments ca
        JOIN dbo.employees e ON ca.employee_id = e.id
        JOIN dbo.departments d ON e.department_id = d.id
        JOIN dbo.skills s ON ca.skill_id = s.id
        WHERE ca.target_level > ca.current_level
    """
    
    params = []
    if department_id:
        query += " AND e.department_id = ?"
        params.append(department_id)
    if min_gap:
        query += " AND (ca.target_level - ca.current_level) >= ?"
        params.append(min_gap)
    
    query += " ORDER BY gap DESC, e.name"
    
    cursor.execute(query, params)
    
    results = []
    for row in cursor.fetchall():
        results.append({
            "employee_id": str(row[0]),
            "employee_code": row[1],
            "employee_name": row[2],
            "department_name": row[3],
            "skill_name": row[4],
            "module_name": row[5],
            "current_level": row[6],
            "target_level": row[7],
            "gap": row[8],
            "assessment_date": row[9]
        })
    
    return results


@router.get("/employee-workload")
def get_employee_workload(
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    employee_id: Optional[UUID] = None,
    cursor=Depends(get_db)
):
    """
    员工工作负载视图
    显示每个员工在指定时间段内的任务和工时统计
    """
    query = """
        SELECT 
            e.id AS employee_id,
            e.employee_id AS employee_code,
            e.name AS employee_name,
            d.name AS department_name,
            COUNT(t.id) AS task_count,
            SUM(COALESCE(t.total_hours, 0)) AS total_hours,
            AVG(COALESCE(t.hours_per_day, 0)) AS avg_hours_per_day
        FROM dbo.employees e
        LEFT JOIN dbo.departments d ON e.department_id = d.id
        LEFT JOIN dbo.tasks t ON e.id = t.assigned_employee_id
    """
    
    conditions = ["e.is_active = 1"]
    params = []
    
    if start_date:
        conditions.append("t.start_date >= ?")
        params.append(start_date)
    if end_date:
        conditions.append("t.end_date <= ?")
        params.append(end_date)
    if employee_id:
        conditions.append("e.id = ?")
        params.append(str(employee_id))
    
    if conditions:
        query += " WHERE " + " AND ".join(conditions)
    
    query += """
        GROUP BY e.id, e.employee_id, e.name, d.name
        ORDER BY total_hours DESC, e.name
    """
    
    cursor.execute(query, params)
    
    results = []
    for row in cursor.fetchall():
        results.append({
            "employee_id": str(row[0]),
            "employee_code": row[1],
            "employee_name": row[2],
            "department_name": row[3],
            "task_count": row[4],
            "total_hours": float(row[5]) if row[5] else 0,
            "avg_hours_per_day": float(row[6]) if row[6] else 0
        })
    
    return results


@router.get("/resource-planning-overview")
def get_resource_planning_overview(
    year: Optional[int] = None,
    week_number: Optional[int] = None,
    department_id: Optional[int] = None,
    cursor=Depends(get_db)
):
    """
    资源规划概览视图
    显示资源规划任务的统计信息
    """
    query = """
        SELECT 
            e.id AS employee_id,
            e.employee_id AS employee_code,
            e.name AS employee_name,
            d.name AS department_name,
            rpt.year,
            rpt.week_number,
            rpt.task_type_code,
            rtt.name AS task_type_name,
            rtt.color_hex,
            rpt.factory_code,
            rpt.hours,
            rpt.is_cross_factory
        FROM dbo.resource_planning_tasks rpt
        JOIN dbo.employees e ON rpt.employee_id = e.id
        LEFT JOIN dbo.departments d ON e.department_id = d.id
        LEFT JOIN dbo.resource_task_types rtt ON rpt.task_type_code = rtt.code
        WHERE 1=1
    """
    
    params = []
    if year:
        query += " AND rpt.year = ?"
        params.append(year)
    if week_number:
        query += " AND rpt.week_number = ?"
        params.append(week_number)
    if department_id:
        query += " AND e.department_id = ?"
        params.append(department_id)
    
    query += " ORDER BY rpt.year DESC, rpt.week_number DESC, e.name"
    
    cursor.execute(query, params)
    
    results = []
    for row in cursor.fetchall():
        results.append({
            "employee_id": str(row[0]),
            "employee_code": row[1],
            "employee_name": row[2],
            "department_name": row[3],
            "year": row[4],
            "week_number": row[5],
            "task_type_code": row[6],
            "task_type_name": row[7],
            "color_hex": row[8],
            "factory_code": row[9],
            "hours": float(row[10]) if row[10] else 0,
            "is_cross_factory": row[11]
        })
    
    return results


@router.get("/department-skill-distribution")
def get_department_skill_distribution(
    department_id: Optional[int] = None,
    cursor=Depends(get_db)
):
    """
    部门技能分布视图
    显示每个部门在各个技能上的人员分布情况
    """
    query = """
        SELECT 
            d.id AS department_id,
            d.name AS department_name,
            s.id AS skill_id,
            s.skill_name,
            s.module_name,
            COUNT(DISTINCT e.id) AS employee_count,
            AVG(COALESCE(ca.current_level, 0)) AS avg_current_level,
            AVG(COALESCE(ca.target_level, 0)) AS avg_target_level,
            SUM(CASE WHEN ca.current_level >= 1 THEN 1 ELSE 0 END) AS level_1_count,
            SUM(CASE WHEN ca.current_level >= 2 THEN 1 ELSE 0 END) AS level_2_count,
            SUM(CASE WHEN ca.current_level >= 3 THEN 1 ELSE 0 END) AS level_3_count
        FROM dbo.departments d
        CROSS JOIN dbo.skills s
        LEFT JOIN dbo.employees e ON d.id = e.department_id AND e.is_active = 1
        LEFT JOIN dbo.competency_assessments ca ON e.id = ca.employee_id AND s.id = ca.skill_id
        WHERE s.is_active = 1
    """
    
    params = []
    if department_id:
        query += " AND d.id = ?"
        params.append(department_id)
    
    query += """
        GROUP BY d.id, d.name, s.id, s.skill_name, s.module_name
        ORDER BY d.name, s.module_name, s.skill_name
    """
    
    cursor.execute(query, params)
    
    results = []
    for row in cursor.fetchall():
        results.append({
            "department_id": row[0],
            "department_name": row[1],
            "skill_id": row[2],
            "skill_name": row[3],
            "module_name": row[4],
            "employee_count": row[5],
            "avg_current_level": float(row[6]) if row[6] else 0,
            "avg_target_level": float(row[7]) if row[7] else 0,
            "level_1_count": row[8],
            "level_2_count": row[9],
            "level_3_count": row[10]
        })
    
    return results


@router.get("/task-timeline")
def get_task_timeline(
    employee_id: Optional[UUID] = None,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    cursor=Depends(get_db)
):
    """
    任务时间线视图
    显示任务的时间线分布
    """
    query = """
        SELECT 
            t.id AS task_id,
            t.task_name,
            t.task_type,
            t.task_location,
            t.start_date,
            t.end_date,
            t.status,
            t.hours_per_day,
            t.total_hours,
            e.id AS employee_id,
            e.employee_id AS employee_code,
            e.name AS employee_name,
            d.name AS department_name
        FROM dbo.tasks t
        LEFT JOIN dbo.employees e ON t.assigned_employee_id = e.id
        LEFT JOIN dbo.departments d ON e.department_id = d.id
        WHERE 1=1
    """
    
    params = []
    if employee_id:
        query += " AND e.id = ?"
        params.append(str(employee_id))
    if start_date:
        query += " AND t.start_date >= ?"
        params.append(start_date)
    if end_date:
        query += " AND t.end_date <= ?"
        params.append(end_date)
    
    query += " ORDER BY t.start_date DESC, e.name"
    
    cursor.execute(query, params)
    
    results = []
    for row in cursor.fetchall():
        results.append({
            "task_id": str(row[0]),
            "task_name": row[1],
            "task_type": row[2],
            "task_location": row[3],
            "start_date": row[4],
            "end_date": row[5],
            "status": row[6],
            "hours_per_day": float(row[7]) if row[7] else 0,
            "total_hours": float(row[8]) if row[8] else 0,
            "employee_id": str(row[9]) if row[9] else None,
            "employee_code": row[10],
            "employee_name": row[11],
            "department_name": row[12]
        })
    
    return results
