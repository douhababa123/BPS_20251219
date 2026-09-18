"""Administrator-only annual competency baseline management."""

import hmac
from hashlib import sha256
from io import BytesIO
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from annual_baseline import build_template, file_sha256, parse_baseline_workbook, preview_payload
from config import settings
from database import get_db

from .auth import verify_admin


router = APIRouter()


def _preview_token(year: int, file_digest: str) -> str:
    payload = f"annual-baseline:{year}:{file_digest.lower()}".encode("utf-8")
    return hmac.new(settings.jwt_secret_key.encode("utf-8"), payload, sha256).hexdigest()


class SavedVersionActivation(BaseModel):
    year: int = Field(..., ge=2027, le=2100)
    source_version_id: UUID
    replace: bool = False
    expected_active_baseline_id: Optional[UUID] = None


def _lock_active_baseline(cursor, year: int, replace: bool, expected_active_baseline_id) -> Optional[str]:
    cursor.execute(
        """
        SELECT id FROM dbo.competency_annual_baselines WITH (UPDLOCK, HOLDLOCK)
        WHERE baseline_year = ? AND is_active = 1
        """,
        year,
    )
    active = cursor.fetchone()
    active_id = str(active[0]) if active else None
    expected = str(expected_active_baseline_id) if expected_active_baseline_id else None
    if active_id and not replace:
        raise HTTPException(status_code=409, detail="该年度已有生效基线，必须明确确认替换")
    if active_id and (not expected or expected.lower() != active_id.lower()):
        raise HTTPException(status_code=409, detail="生效基线已变化，请重新核对后确认")
    if not active_id and expected:
        raise HTTPException(status_code=409, detail="生效基线状态已变化，请重新核对后确认")
    if active_id:
        cursor.execute(
            "UPDATE dbo.competency_annual_baselines SET is_active = 0 WHERE id = ? AND is_active = 1",
            active_id,
        )
    return active_id


def _insert_baseline_header(
    cursor,
    *,
    year: int,
    source: str,
    current_user: dict,
    filename: Optional[str] = None,
    source_version_id: Optional[str] = None,
    sha256: Optional[str] = None,
) -> str:
    cursor.execute(
        """
        INSERT INTO dbo.competency_annual_baselines (
            baseline_year, source, source_filename, source_version_id,
            file_sha256, is_active, selected_by_user_id, selected_at
        )
        OUTPUT INSERTED.id
        VALUES (?, ?, ?, ?, ?, 1, ?, GETDATE())
        """,
        year,
        source,
        filename,
        source_version_id,
        sha256,
        current_user.get("user_id"),
    )
    return str(cursor.fetchone()[0])


def _insert_baseline_cells(cursor, baseline_id: str, cells) -> None:
    for cell in cells:
        cursor.execute(
            """
            INSERT INTO dbo.competency_annual_baseline_items (
                baseline_id, employee_id, skill_id,
                initial_current_level, annual_target_level
            ) VALUES (?, ?, ?, ?, ?)
            """,
            baseline_id,
            cell["employee_id"],
            cell["skill_id"],
            cell["initial_current"],
            cell["annual_target"],
        )


def _master_data(cursor):
    cursor.execute(
        """
        SELECT id, employee_id, name
        FROM dbo.employees
        WHERE ISNULL(is_active, 1) = 1
        """
    )
    employees = {
        str(row[1]).strip(): {"id": str(row[0]), "code": str(row[1]).strip(), "name": row[2] or ""}
        for row in cursor.fetchall()
    }
    cursor.execute(
        """
        SELECT id, module_id, module_name, skill_name
        FROM dbo.skills
        WHERE ISNULL(is_active, 1) = 1
        """
    )
    skills = {
        int(row[0]): {
            "id": int(row[0]),
            "module_id": int(row[1]),
            "module_name": row[2] or "",
            "skill_name": row[3] or "",
        }
        for row in cursor.fetchall()
    }
    return employees, skills


async def _read_xlsx(file: UploadFile) -> bytes:
    filename = file.filename or ""
    if not filename.lower().endswith(".xlsx"):
        raise HTTPException(status_code=422, detail="只支持 .xlsx 年初基线文件")
    contents = await file.read()
    return contents


@router.get("")
def get_baselines(
    year: int = Query(..., ge=2000, le=2100),
    cursor=Depends(get_db),
    current_user: dict = Depends(verify_admin),
):
    del current_user
    cursor.execute(
        """
        SELECT b.id, b.baseline_year, b.source, b.source_filename,
               b.source_version_id, b.file_sha256, b.is_active,
               b.selected_by_user_id, u.email, b.selected_at,
               COUNT(i.id) AS cell_count,
               COUNT(DISTINCT i.employee_id) AS employee_count,
               COUNT(DISTINCT i.skill_id) AS skill_count
        FROM dbo.competency_annual_baselines b
        LEFT JOIN dbo.competency_annual_baseline_items i ON i.baseline_id = b.id
        LEFT JOIN dbo.users u ON u.id = b.selected_by_user_id
        WHERE b.baseline_year = ?
        GROUP BY b.id, b.baseline_year, b.source, b.source_filename,
                 b.source_version_id, b.file_sha256, b.is_active,
                 b.selected_by_user_id, u.email, b.selected_at
        ORDER BY b.is_active DESC, b.selected_at DESC
        """,
        year,
    )
    revisions = [
        {
            "id": str(row[0]),
            "year": int(row[1]),
            "source": row[2],
            "filename": row[3],
            "sourceVersionId": str(row[4]) if row[4] else None,
            "sha256": row[5],
            "isActive": bool(row[6]),
            "selectedByUserId": str(row[7]) if row[7] else None,
            "selectedByEmail": row[8],
            "selectedAt": row[9].isoformat() if row[9] else None,
            "cellCount": int(row[10] or 0),
            "employeeCount": int(row[11] or 0),
            "skillCount": int(row[12] or 0),
        }
        for row in cursor.fetchall()
    ]
    return {"year": year, "active": next((row for row in revisions if row["isActive"]), None), "revisions": revisions}


@router.get("/template")
def download_template(
    cursor=Depends(get_db),
    current_user: dict = Depends(verify_admin),
):
    del current_user
    cursor.execute(
        """
        SELECT e.employee_id, e.name, s.id, s.module_name, s.skill_name
        FROM dbo.employees e
        CROSS JOIN dbo.skills s
        WHERE ISNULL(e.is_active, 1) = 1
          AND ISNULL(s.is_active, 1) = 1
          AND LOWER(LTRIM(RTRIM(e.name))) NOT IN ('tyler tan', 'tong zhifeng')
        ORDER BY e.name, s.module_id, ISNULL(s.display_order, 0), s.id
        """
    )
    contents = build_template(cursor.fetchall())
    return StreamingResponse(
        BytesIO(contents),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": 'attachment; filename="bps-year-start-baseline-template.xlsx"'},
    )


@router.post("/import-preview")
async def preview_import(
    year: int = Form(..., ge=2000, le=2100),
    file: UploadFile = File(...),
    cursor=Depends(get_db),
    current_user: dict = Depends(verify_admin),
):
    del current_user
    contents = await _read_xlsx(file)
    employees, skills = _master_data(cursor)
    parsed = parse_baseline_workbook(contents, employees, skills, year=year)
    preview = preview_payload(contents, parsed, file.filename or "baseline.xlsx")
    return {
        "year": year,
        **preview,
        "previewToken": _preview_token(year, preview["sha256"]),
    }


@router.post("")
async def activate_import(
    year: int = Form(..., ge=2000, le=2100),
    preview_sha256: str = Form(..., min_length=64, max_length=64),
    preview_token: str = Form(..., min_length=64, max_length=64),
    replace: bool = Form(False),
    expected_active_baseline_id: Optional[str] = Form(None),
    file: UploadFile = File(...),
    cursor=Depends(get_db),
    current_user: dict = Depends(verify_admin),
):
    contents = await _read_xlsx(file)
    digest = file_sha256(contents)
    if digest != preview_sha256.lower():
        raise HTTPException(status_code=409, detail="文件内容已变化，请重新预览")
    if not hmac.compare_digest(preview_token.lower(), _preview_token(year, digest)):
        raise HTTPException(status_code=409, detail="预览年度或文件已变化，请重新预览")

    employees, skills = _master_data(cursor)
    parsed = parse_baseline_workbook(contents, employees, skills, year=year)
    preview = preview_payload(contents, parsed, file.filename or "baseline.xlsx")
    if not preview["valid"]:
        raise HTTPException(status_code=422, detail={"message": "年初基线校验失败", "errors": preview["errors"]})

    _lock_active_baseline(cursor, year, replace, expected_active_baseline_id)
    baseline_id = _insert_baseline_header(
        cursor,
        year=year,
        source="EXCEL_IMPORT",
        current_user=current_user,
        filename=file.filename or "baseline.xlsx",
        sha256=preview_sha256.lower(),
    )
    _insert_baseline_cells(
        cursor,
        baseline_id,
        [
            {
                "employee_id": cell.employee_id,
                "skill_id": cell.skill_id,
                "initial_current": cell.initial_current,
                "annual_target": cell.annual_target,
            }
            for cell in parsed["cells"]
        ],
    )
    cursor.commit()
    return {
        "id": baseline_id,
        "year": year,
        "source": "EXCEL_IMPORT",
        "filename": file.filename or "baseline.xlsx",
        "isActive": True,
        "summary": preview["summary"],
    }


@router.post("/from-version")
def activate_saved_version(
    payload: SavedVersionActivation,
    cursor=Depends(get_db),
    current_user: dict = Depends(verify_admin),
):
    """Materialize a post-2026 annual baseline from a saved business version."""

    cursor.execute(
        "SELECT created_at FROM dbo.competency_assessment_versions WHERE id = ?",
        str(payload.source_version_id),
    )
    version = cursor.fetchone()
    if not version:
        raise HTTPException(status_code=404, detail="能力评估版本不存在")

    cursor.execute(
        """
        WITH ranked AS (
            SELECT h.employee_id, h.skill_id, h.current_level, h.target_level,
                   ROW_NUMBER() OVER (
                       PARTITION BY h.employee_id, h.skill_id
                       ORDER BY h.changed_at DESC, h.id DESC
                   ) AS rn
            FROM dbo.competency_assessment_history h
            INNER JOIN dbo.employees e ON e.id = h.employee_id
            INNER JOIN dbo.skills s ON s.id = h.skill_id
            WHERE h.changed_at <= ?
              AND ISNULL(e.is_active, 1) = 1
              AND ISNULL(s.is_active, 1) = 1
        )
        SELECT employee_id, skill_id, current_level, target_level
        FROM ranked
        WHERE rn = 1
        ORDER BY employee_id, skill_id
        """,
        version[0],
    )
    cells = [
        {
            "employee_id": str(row[0]),
            "skill_id": int(row[1]),
            "initial_current": int(row[2]),
            "annual_target": int(row[3]),
        }
        for row in cursor.fetchall()
    ]
    if not cells:
        raise HTTPException(status_code=422, detail="该版本无法重建任何有效能力单元")
    if any(
        cell["initial_current"] < 0
        or cell["initial_current"] > 4
        or cell["annual_target"] < 0
        or cell["annual_target"] > 4
        or cell["annual_target"] < cell["initial_current"]
        for cell in cells
    ):
        raise HTTPException(status_code=422, detail="该版本包含不符合 0 ≤ 现状 ≤ 目标 ≤ 4 的数据")

    _lock_active_baseline(
        cursor,
        payload.year,
        payload.replace,
        payload.expected_active_baseline_id,
    )
    baseline_id = _insert_baseline_header(
        cursor,
        year=payload.year,
        source="SAVED_VERSION",
        current_user=current_user,
        source_version_id=str(payload.source_version_id),
    )
    _insert_baseline_cells(cursor, baseline_id, cells)
    cursor.commit()
    return {
        "id": baseline_id,
        "year": payload.year,
        "source": "SAVED_VERSION",
        "sourceVersionId": str(payload.source_version_id),
        "isActive": True,
        "summary": {
            "employeeCount": len({cell["employee_id"] for cell in cells}),
            "skillCount": len({cell["skill_id"] for cell in cells}),
            "cellCount": len(cells),
        },
    }
