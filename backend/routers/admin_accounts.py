"""Admin account management routes."""

from fastapi import APIRouter, Depends, HTTPException

from account_management import (
    list_employee_accounts,
    reset_user_password,
    sync_employee_accounts,
)
from auth import verify_admin
from database import get_db


router = APIRouter()


@router.get("/admin/accounts")
def get_accounts(cursor=Depends(get_db), current_user: dict = Depends(verify_admin)):
    accounts = list_employee_accounts(cursor)
    return {"accounts": accounts, "count": len(accounts)}


@router.post("/admin/accounts/sync")
def sync_accounts(cursor=Depends(get_db), current_user: dict = Depends(verify_admin)):
    result = sync_employee_accounts(cursor)
    cursor.commit()
    return result


@router.post("/admin/accounts/{user_id}/reset-password")
def reset_password(user_id: str, cursor=Depends(get_db), current_user: dict = Depends(verify_admin)):
    try:
        result = reset_user_password(cursor, user_id)
        cursor.commit()
        return result
    except ValueError:
        raise HTTPException(status_code=404, detail="用户不存在")
