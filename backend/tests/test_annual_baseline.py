from io import BytesIO
from pathlib import Path

from openpyxl import Workbook, load_workbook

from annual_baseline import build_template, parse_baseline_workbook, preview_payload


MIGRATION = Path(__file__).resolve().parents[1] / "migrations" / "008_capability_governance.sql"
DEPLOY_WORKFLOW = Path(__file__).resolve().parents[2] / ".github" / "workflows" / "jetson-deploy.yml"


def workbook_bytes(rows):
    workbook = Workbook()
    sheet = workbook.active
    sheet.append(["Employee ID", "Skill ID", "Initial Current", "Annual Target"])
    for row in rows:
        sheet.append(row)
    output = BytesIO()
    workbook.save(output)
    workbook.close()
    return output.getvalue()


EMPLOYEES = {"E001": {"id": "employee-uuid", "name": "Employee One"}}
SKILLS = {7: {"module_id": 2, "module_name": "Module", "skill_name": "Skill"}}


def test_valid_zero_is_kept_and_missing_cells_are_not_created():
    contents = workbook_bytes([["E001", 7, 0, 3]])
    parsed = parse_baseline_workbook(contents, EMPLOYEES, SKILLS)
    preview = preview_payload(contents, parsed, "baseline.xlsx")

    assert preview["valid"] is True
    assert preview["summary"] == {
        "employeeCount": 1,
        "skillCount": 1,
        "cellCount": 1,
        "initialLevel": 0.0,
        "targetLevel": 3.0,
        "initialGap": 3,
    }
    assert len(parsed["cells"]) == 1


def test_any_invalid_or_duplicate_row_blocks_complete_import():
    contents = workbook_bytes([
        ["E001", 7, 1, 3],
        ["E001", 7, 2, 1],
        ["UNKNOWN", 7, 0, 1],
    ])
    parsed = parse_baseline_workbook(contents, EMPLOYEES, SKILLS)
    preview = preview_payload(contents, parsed, "baseline.xlsx")

    assert preview["valid"] is False
    messages = [error["message"] for error in preview["errors"]]
    assert any("重复" in message for message in messages)
    assert any("不能小于" in message for message in messages)
    assert any("不存在" in message for message in messages)


def test_template_has_blank_scores_instead_of_current_values():
    contents = build_template([("E001", "Employee One", 7, "Module", "Skill")])
    workbook = load_workbook(BytesIO(contents), data_only=True)
    sheet = workbook.active
    assert sheet["A2"].value == "E001"
    assert sheet["F2"].value is None
    assert sheet["G2"].value is None
    workbook.close()


def test_migration_is_additive_and_does_not_promote_july_snapshot():
    sql = MIGRATION.read_text(encoding="utf-8")
    assert "CREATE TABLE dbo.competency_assessment_versions" in sql
    assert "CREATE TABLE dbo.competency_annual_baselines" in sql
    assert "CREATE TABLE dbo.competency_annual_baseline_items" in sql
    assert "MIGRATION_BASELINE" in sql
    assert "EXEC sp_executesql N'\n            ALTER TABLE dbo.competency_assessment_history" in sql
    assert "EXEC sp_executesql N'\n            CREATE INDEX IX_competency_history_version" in sql
    assert "EXEC sp_executesql @drop_history_source_constraint_sql" in sql
    assert "EXEC(N'ALTER TABLE dbo.competency_assessment_history" not in sql
    assert "INSERT INTO dbo.competency_annual_baselines" not in sql
    assert "UPDATE dbo.competency_assessments" not in sql
    assert "DELETE FROM dbo.competency" not in sql


def test_jetson_deploy_applies_capability_governance_schema_before_startup():
    workflow = DEPLOY_WORKFLOW.read_text(encoding="utf-8")

    migration_at = workflow.index("migrations/008_capability_governance.sql")
    startup_at = workflow.index("docker compose up -d", migration_at)

    assert migration_at < startup_at
