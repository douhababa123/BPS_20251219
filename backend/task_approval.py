"""Site approval routing, independent of global admin and task location."""

from fastapi import HTTPException

# Confirmed engineer membership. Emails identify existing accounts, not display names.
SITE_MEMBERS = {
    "SNa": {
        "qingyue.xu@bshg.com", "huixiang.li@bshg.com", "youjun.ye@bshg.com",
        "rongbing.qian@bshg.com", "ting.xue@bshg.com", "ning.wang@bshg.com",
        "lanping.huang@bshg.com",
    },
    "SCh": {
        "pei.wang@bshg.com", "xuan.gu@bshg.com", "yuan.zhangyua@bshg.com",
        "deliang.song@bshg.com", "jianjun.chen@bshg.com", "hui.wanghui4@bshg.com",
        "fanmin.zhang@bshg.com", "xiaoning.zhu@bshg.com",
    },
}
SITE_APPROVERS = {"SNa": "ning.wang@bshg.com", "SCh": "tyler.tan@bshg.com"}


def load_approval_directory(cursor):
    cursor.execute("""
        SELECT e.id, LOWER(LTRIM(RTRIM(e.email))), e.name,
               u.id, LOWER(LTRIM(RTRIM(u.email)))
        FROM dbo.employees e
        LEFT JOIN dbo.users u ON ISNULL(u.is_active, 1) = 1
          AND (u.id = e.auth_user_id OR
               (e.auth_user_id IS NULL AND LOWER(u.email) = LOWER(e.email)))
        WHERE ISNULL(e.is_active, 1) = 1
    """)
    rows = cursor.fetchall()
    approvers = {}
    for site, email in SITE_APPROVERS.items():
        matches = {str(row[3]).lower(): row for row in rows if row[3] and row[1] == email and row[4] == email}
        if len(matches) == 1:
            row = next(iter(matches.values()))
            approvers[site] = {"approver_user_id": str(row[3]), "approver_name": row[2]}
    directory = {}
    for row in rows:
        site = next((site for site, members in SITE_MEMBERS.items() if row[1] in members), None)
        if site and site in approvers:
            directory[str(row[0]).lower()] = {"approval_site": site, **approvers[site]}
    return directory


def require_approval_route(directory, employee_id):
    route = directory.get(str(employee_id).lower()) if employee_id else None
    if not route:
        raise HTTPException(422, "工程师所属 Site 或审批人未配置/未启用，请先联系管理员配置")
    return route


def approval_metadata(directory, employee_id, current_user, status):
    route = directory.get(str(employee_id).lower(), {})
    user_id = str(current_user.get("user_id") or current_user.get("id") or "").lower()
    return {**route, "can_approve": status == "pending_approval" and bool(user_id)
            and str(route.get("approver_user_id", "")).lower() == user_id}


def authorize_approval(directory, task, current_user, expected_version):
    if expected_version != task["approval_version"]:
        raise HTTPException(409, "任务已变更，请刷新后重新审批")
    if task["status"] != "pending_approval":
        raise HTTPException(409, "任务已不处于待审批状态，请刷新")
    route = require_approval_route(directory, task["assigned_employee_id"])
    if not approval_metadata(directory, task["assigned_employee_id"], current_user, task["status"])["can_approve"]:
        raise HTTPException(403, "仅当前工程师所属 Site 的指定审批人可以审批此任务")
    return route


def notify_approver(cursor, route, task_id, task_name):
    from routers.notifications import create_notification
    create_notification(cursor, route["approver_user_id"], "task_submitted",
                        f"新任务申请待审批：{task_name}",
                        f"任务《{task_name}》等待 {route['approval_site']} 审批，请打开最新任务后处理。",
                        str(task_id))
