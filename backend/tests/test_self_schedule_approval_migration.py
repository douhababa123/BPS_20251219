from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
MIGRATION = ROOT / "backend" / "migrations" / "007_self_schedule_approval.sql"
WORKFLOW = ROOT / ".github" / "workflows" / "jetson-deploy.yml"


def test_self_schedule_migration_is_deployed_and_scoped():
    assert MIGRATION.exists(), "self-schedule approval migration is missing"

    sql = MIGRATION.read_text(encoding="utf-8").lower()
    workflow = WORKFLOW.read_text(encoding="utf-8")

    assert "status = 'planned'" in sql
    assert "t.status = 'pending_approval'" in sql
    assert "t.assigned_employee_id" in sql
    assert "t.requester_id" in sql
    assert "auth_user_id" in sql
    assert "007_self_schedule_approval.sql" in workflow
