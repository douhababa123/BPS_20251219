"""Account synchronization helpers for employees and users."""

from __future__ import annotations

import csv
import secrets
import string
from dataclasses import dataclass, asdict
from pathlib import Path
from typing import Any, Dict, List, Optional

import auth


ADMIN_EMPLOYEE_ROLES = {"SITE_PS", "ADMIN"}


def normalize_email(email: Optional[str]) -> str:
    return (email or "").strip().lower()


def role_from_employee_role(employee_role: Optional[str]) -> str:
    role = (employee_role or "").strip().upper()
    return "admin" if role in ADMIN_EMPLOYEE_ROLES else "user"


def generate_temp_password(length: int = 12) -> str:
    alphabet = string.ascii_letters + string.digits
    while True:
        password = "".join(secrets.choice(alphabet) for _ in range(length))
        if (
            any(c.islower() for c in password)
            and any(c.isupper() for c in password)
            and any(c.isdigit() for c in password)
        ):
            return password


def ensure_account_columns(cursor) -> None:
    cursor.execute(
        """
        IF COL_LENGTH('dbo.users', 'must_change_password') IS NULL
        BEGIN
            ALTER TABLE dbo.users
            ADD must_change_password BIT NOT NULL
                CONSTRAINT DF_users_must_change_password DEFAULT (0);
        END

        IF COL_LENGTH('dbo.users', 'password_updated_at') IS NULL
        BEGIN
            ALTER TABLE dbo.users ADD password_updated_at DATETIME2 NULL;
        END
        """
    )


@dataclass
class GeneratedPassword:
    employee_id: str
    employee_name: str
    email: str
    user_id: str
    role: str
    temporary_password: str
    reason: str


def _row_to_dict(row) -> Dict[str, Any]:
    columns = [column[0] for column in row.cursor_description]
    return dict(zip(columns, row))


def _fetch_user_for_employee(cursor, employee_auth_user_id: Optional[str], email: str) -> Optional[Dict[str, Any]]:
    if employee_auth_user_id:
        cursor.execute(
            """
            SELECT TOP 1 id, email, name, role, password_hash, is_active, must_change_password
            FROM dbo.users
            WHERE id = ?
            """,
            employee_auth_user_id,
        )
        row = cursor.fetchone()
        if row:
            return _row_to_dict(row)

    cursor.execute(
        """
        SELECT TOP 1 id, email, name, role, password_hash, is_active, must_change_password
        FROM dbo.users
        WHERE LOWER(email) = LOWER(?)
        ORDER BY created_at ASC
        """,
        email,
    )
    row = cursor.fetchone()
    return _row_to_dict(row) if row else None


def sync_employee_accounts(cursor, set_missing_passwords: bool = True) -> Dict[str, Any]:
    """Create/update users from active employees and bind employees.auth_user_id."""
    ensure_account_columns(cursor)

    cursor.execute(
        """
        SELECT id, employee_id, name, email, role, auth_user_id, is_active
        FROM dbo.employees
        WHERE ISNULL(is_active, 1) = 1
        ORDER BY name
        """
    )
    employees = [_row_to_dict(row) for row in cursor.fetchall()]

    result: Dict[str, Any] = {
        "employees_seen": len(employees),
        "created": 0,
        "updated": 0,
        "bound": 0,
        "skipped_without_email": 0,
        "passwords": [],
    }

    generated_passwords: List[GeneratedPassword] = []

    for employee in employees:
        email = normalize_email(employee.get("email"))
        if not email:
            result["skipped_without_email"] += 1
            continue

        employee_id = str(employee["id"])
        display_employee_id = str(employee.get("employee_id") or "")
        employee_name = employee.get("name") or email.split("@")[0]
        mapped_role = role_from_employee_role(employee.get("role"))
        user = _fetch_user_for_employee(cursor, employee.get("auth_user_id"), email)

        if user:
            user_id = str(user["id"])
            update_password = False
            temp_password = None

            if set_missing_passwords and not user.get("password_hash"):
                temp_password = generate_temp_password()
                update_password = True

            if update_password:
                cursor.execute(
                    """
                    UPDATE dbo.users
                    SET email = ?, name = ?, role = ?, is_active = 1,
                        password_hash = ?, must_change_password = 1,
                        password_updated_at = GETDATE(), updated_at = GETDATE()
                    WHERE id = ?
                    """,
                    email,
                    employee_name,
                    mapped_role,
                    auth.hash_password(temp_password),
                    user_id,
                )
                generated_passwords.append(
                    GeneratedPassword(
                        employee_id=display_employee_id,
                        employee_name=employee_name,
                        email=email,
                        user_id=user_id,
                        role=mapped_role,
                        temporary_password=temp_password,
                        reason="missing_password",
                    )
                )
            else:
                cursor.execute(
                    """
                    UPDATE dbo.users
                    SET email = ?, name = ?, role = ?, is_active = 1, updated_at = GETDATE()
                    WHERE id = ?
                    """,
                    email,
                    employee_name,
                    mapped_role,
                    user_id,
                )

            result["updated"] += 1
        else:
            temp_password = generate_temp_password()
            cursor.execute(
                """
                INSERT INTO dbo.users (
                    email, name, password_hash, role, is_active,
                    email_confirmed, email_confirmed_at,
                    must_change_password, password_updated_at,
                    created_at, updated_at
                )
                OUTPUT INSERTED.id
                VALUES (?, ?, ?, ?, 1, 1, GETDATE(), 1, GETDATE(), GETDATE(), GETDATE())
                """,
                email,
                employee_name,
                auth.hash_password(temp_password),
                mapped_role,
            )
            user_id = str(cursor.fetchone()[0])
            generated_passwords.append(
                GeneratedPassword(
                    employee_id=display_employee_id,
                    employee_name=employee_name,
                    email=email,
                    user_id=user_id,
                    role=mapped_role,
                    temporary_password=temp_password,
                    reason="created",
                )
            )
            result["created"] += 1

        if str(employee.get("auth_user_id") or "").lower() != user_id.lower():
            cursor.execute(
                "UPDATE dbo.employees SET auth_user_id = ?, updated_at = GETDATE() WHERE id = ?",
                user_id,
                employee_id,
            )
            result["bound"] += 1

    result["passwords"] = [asdict(item) for item in generated_passwords]
    return result


def list_employee_accounts(cursor) -> List[Dict[str, Any]]:
    ensure_account_columns(cursor)
    cursor.execute(
        """
        SELECT
            e.id AS employee_uuid,
            e.employee_id,
            e.name AS employee_name,
            e.email AS employee_email,
            e.role AS employee_role,
            e.is_active AS employee_active,
            e.auth_user_id,
            u.id AS user_id,
            u.email AS user_email,
            u.name AS user_name,
            u.role AS user_role,
            u.is_active AS user_active,
            CASE WHEN u.password_hash IS NULL THEN CAST(0 AS BIT) ELSE CAST(1 AS BIT) END AS has_password,
            ISNULL(u.must_change_password, 0) AS must_change_password,
            u.last_login_at,
            e.login_count,
            e.last_login_at AS employee_last_login_at
        FROM dbo.employees e
        LEFT JOIN dbo.users u
            ON (e.auth_user_id IS NOT NULL AND u.id = e.auth_user_id)
            OR (e.auth_user_id IS NULL AND e.email IS NOT NULL AND LOWER(u.email) = LOWER(e.email))
        ORDER BY e.is_active DESC, e.name
        """
    )
    accounts = []
    for row in cursor.fetchall():
        item = _row_to_dict(row)
        item["mapped_user_role"] = role_from_employee_role(item.get("employee_role"))
        item["is_bound"] = bool(
            item.get("auth_user_id")
            and item.get("user_id")
            and str(item["auth_user_id"]).lower() == str(item["user_id"]).lower()
        )
        accounts.append(item)
    return accounts


def reset_user_password(cursor, user_id: str) -> Dict[str, Any]:
    ensure_account_columns(cursor)
    cursor.execute(
        """
        SELECT TOP 1 id, email, name, role
        FROM dbo.users
        WHERE id = ?
        """,
        user_id,
    )
    row = cursor.fetchone()
    if not row:
        raise ValueError("User not found")

    user = _row_to_dict(row)
    temp_password = generate_temp_password()
    cursor.execute(
        """
        UPDATE dbo.users
        SET password_hash = ?, must_change_password = 1,
            password_updated_at = GETDATE(), updated_at = GETDATE()
        WHERE id = ?
        """,
        auth.hash_password(temp_password),
        user_id,
    )
    return {
        "user_id": str(user["id"]),
        "email": user["email"],
        "name": user["name"],
        "role": user["role"],
        "temporary_password": temp_password,
    }


def write_generated_passwords_csv(path: Path, passwords: List[Dict[str, Any]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    fieldnames = [
        "employee_id",
        "employee_name",
        "email",
        "user_id",
        "role",
        "temporary_password",
        "reason",
    ]
    with path.open("w", newline="", encoding="utf-8-sig") as file:
        writer = csv.DictWriter(file, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(passwords)
