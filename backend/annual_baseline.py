"""Excel parsing and summaries for immutable annual competency baselines."""

from __future__ import annotations

from dataclasses import dataclass
from hashlib import sha256
from io import BytesIO
from typing import Any, Dict, Iterable, List, Mapping, Tuple

from openpyxl import Workbook, load_workbook


MAX_BASELINE_FILE_BYTES = 5 * 1024 * 1024

HEADER_ALIASES = {
    "employee_id": {"employee id", "employee_id", "员工id", "员工编号", "员工工号"},
    "skill_id": {"skill id", "skill_id", "技能id", "能力id"},
    "initial_current": {"initial current", "initial_current", "年初现状", "年初level", "年初 level"},
    "annual_target": {"annual target", "annual_target", "年度目标", "目标level", "目标 level"},
}


@dataclass(frozen=True)
class BaselineCell:
    row_number: int
    employee_id: str
    employee_code: str
    employee_name: str
    skill_id: int
    module_id: int
    module_name: str
    skill_name: str
    initial_current: int
    annual_target: int

    @property
    def gap(self) -> int:
        return self.annual_target - self.initial_current


def file_sha256(contents: bytes) -> str:
    return sha256(contents).hexdigest()


def _normalized_header(value: Any) -> str:
    return " ".join(str(value or "").strip().lower().replace("_", " ").split())


def _header_indexes(header_values: Iterable[Any]) -> Tuple[Dict[str, int], List[Dict[str, Any]]]:
    normalized = [_normalized_header(value) for value in header_values]
    indexes: Dict[str, int] = {}
    errors: List[Dict[str, Any]] = []
    for field, aliases in HEADER_ALIASES.items():
        alias_norms = {_normalized_header(alias) for alias in aliases}
        matches = [index for index, value in enumerate(normalized) if value in alias_norms]
        if len(matches) == 1:
            indexes[field] = matches[0]
        elif not matches:
            errors.append({"row": 1, "field": field, "message": "缺少必需列"})
        else:
            errors.append({"row": 1, "field": field, "message": "列名重复"})
    return indexes, errors


def _identifier(value: Any) -> str:
    if value is None:
        return ""
    if isinstance(value, float) and value.is_integer():
        return str(int(value))
    return str(value).strip()


def _level(value: Any) -> int | None:
    if isinstance(value, bool) or value is None or value == "":
        return None
    try:
        numeric = float(value)
    except (TypeError, ValueError):
        return None
    if not numeric.is_integer():
        return None
    integer = int(numeric)
    return integer if 0 <= integer <= 4 else None


def parse_baseline_workbook(
    contents: bytes,
    employees_by_code: Mapping[str, Mapping[str, Any]],
    skills_by_id: Mapping[int, Mapping[str, Any]],
) -> Dict[str, Any]:
    """Parse one standard workbook without writing to a database."""

    if not contents:
        return {"cells": [], "errors": [{"row": 0, "field": "file", "message": "文件为空"}]}
    if len(contents) > MAX_BASELINE_FILE_BYTES:
        return {"cells": [], "errors": [{"row": 0, "field": "file", "message": "文件超过 5 MB"}]}

    try:
        workbook = load_workbook(BytesIO(contents), read_only=True, data_only=True)
    except Exception:
        return {"cells": [], "errors": [{"row": 0, "field": "file", "message": "无法解析 .xlsx 文件"}]}

    worksheet = workbook.active
    rows = worksheet.iter_rows(values_only=True)
    header = next(rows, None)
    if not header:
        workbook.close()
        return {"cells": [], "errors": [{"row": 1, "field": "file", "message": "工作表为空"}]}

    indexes, errors = _header_indexes(header)
    if errors:
        workbook.close()
        return {"cells": [], "errors": errors}

    cells: List[BaselineCell] = []
    seen: Dict[Tuple[str, int], int] = {}
    normalized_employees = {str(key).strip().lower(): value for key, value in employees_by_code.items()}

    for row_number, values in enumerate(rows, start=2):
        if not any(value not in (None, "") for value in values):
            continue
        employee_code = _identifier(values[indexes["employee_id"]] if indexes["employee_id"] < len(values) else None)
        skill_text = _identifier(values[indexes["skill_id"]] if indexes["skill_id"] < len(values) else None)
        current_raw = values[indexes["initial_current"]] if indexes["initial_current"] < len(values) else None
        target_raw = values[indexes["annual_target"]] if indexes["annual_target"] < len(values) else None

        employee = normalized_employees.get(employee_code.lower())
        if not employee_code:
            errors.append({"row": row_number, "field": "employee_id", "message": "员工 ID 不能为空"})
        elif not employee:
            errors.append({"row": row_number, "field": "employee_id", "message": "员工不存在或未启用"})

        try:
            skill_id = int(skill_text)
        except (TypeError, ValueError):
            skill_id = -1
        skill = skills_by_id.get(skill_id)
        if not skill_text:
            errors.append({"row": row_number, "field": "skill_id", "message": "技能 ID 不能为空"})
        elif not skill:
            errors.append({"row": row_number, "field": "skill_id", "message": "技能不存在或未启用"})

        current = _level(current_raw)
        target = _level(target_raw)
        if current is None:
            errors.append({"row": row_number, "field": "initial_current", "message": "年初现状必须是 0–4 的整数"})
        if target is None:
            errors.append({"row": row_number, "field": "annual_target", "message": "年度目标必须是 0–4 的整数"})
        if current is not None and target is not None and target < current:
            errors.append({"row": row_number, "field": "annual_target", "message": "年度目标不能小于年初现状"})

        if employee and skill:
            key = (str(employee["id"]).lower(), skill_id)
            if key in seen:
                errors.append({
                    "row": row_number,
                    "field": "employee_id,skill_id",
                    "message": f"与第 {seen[key]} 行重复",
                })
            else:
                seen[key] = row_number

        if employee and skill and current is not None and target is not None and target >= current and seen.get((str(employee["id"]).lower(), skill_id)) == row_number:
            cells.append(BaselineCell(
                row_number=row_number,
                employee_id=str(employee["id"]),
                employee_code=employee_code,
                employee_name=str(employee.get("name") or ""),
                skill_id=skill_id,
                module_id=int(skill["module_id"]),
                module_name=str(skill.get("module_name") or ""),
                skill_name=str(skill.get("skill_name") or ""),
                initial_current=current,
                annual_target=target,
            ))

    workbook.close()
    if not cells and not errors:
        errors.append({"row": 0, "field": "file", "message": "没有可导入的基线明细"})
    return {"cells": cells, "errors": errors}


def preview_payload(contents: bytes, parsed: Dict[str, Any], filename: str) -> Dict[str, Any]:
    cells: List[BaselineCell] = parsed["cells"]
    count = len(cells)
    total_current = sum(cell.initial_current for cell in cells)
    total_target = sum(cell.annual_target for cell in cells)
    return {
        "filename": filename,
        "sha256": file_sha256(contents),
        "valid": not parsed["errors"] and count > 0,
        "errors": parsed["errors"],
        "summary": {
            "employeeCount": len({cell.employee_id for cell in cells}),
            "skillCount": len({cell.skill_id for cell in cells}),
            "cellCount": count,
            "initialLevel": round(total_current / count, 1) if count else None,
            "targetLevel": round(total_target / count, 1) if count else None,
            "initialGap": total_target - total_current,
        },
        "rows": [
            {
                "row": cell.row_number,
                "employeeId": cell.employee_code,
                "employeeName": cell.employee_name,
                "skillId": cell.skill_id,
                "moduleId": cell.module_id,
                "moduleName": cell.module_name,
                "skillName": cell.skill_name,
                "initialCurrent": cell.initial_current,
                "annualTarget": cell.annual_target,
                "gap": cell.gap,
            }
            for cell in cells[:200]
        ],
        "rowsTruncated": count > 200,
    }


def build_template(rows: Iterable[Tuple[str, str, int, str, str]]) -> bytes:
    workbook = Workbook()
    worksheet = workbook.active
    worksheet.title = "Year-start baseline"
    worksheet.append([
        "Employee ID",
        "Employee Name",
        "Skill ID",
        "Module",
        "Skill",
        "Initial Current",
        "Annual Target",
    ])
    for employee_code, employee_name, skill_id, module_name, skill_name in rows:
        worksheet.append([employee_code, employee_name, skill_id, module_name, skill_name, None, None])
    worksheet.freeze_panes = "A2"
    worksheet.auto_filter.ref = worksheet.dimensions
    for column, width in {"A": 18, "B": 24, "C": 12, "D": 34, "E": 50, "F": 18, "G": 18}.items():
        worksheet.column_dimensions[column].width = width
    output = BytesIO()
    workbook.save(output)
    workbook.close()
    return output.getvalue()
