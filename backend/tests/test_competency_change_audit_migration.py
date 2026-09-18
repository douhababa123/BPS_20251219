from pathlib import Path


MIGRATION = Path(__file__).resolve().parents[1] / "migrations" / "009_competency_change_audit.sql"
WORKFLOW = Path(__file__).resolve().parents[2] / ".github" / "workflows" / "jetson-deploy.yml"


def test_audit_migration_is_additive_and_idempotent():
    sql = MIGRATION.read_text(encoding="utf-8")

    assert "COL_LENGTH('dbo.competency_assessment_history', 'previous_current_level')" in sql
    assert "COL_LENGTH('dbo.competency_assessment_history', 'previous_target_level')" in sql
    assert "previous_current_level INT NULL" in sql
    assert "previous_target_level INT NULL" in sql
    assert sql.count("EXEC sp_executesql") == 2
    assert "UPDATE dbo.competency_assessment_history" not in sql
    assert "DELETE FROM dbo.competency_assessment_history" not in sql


def test_jetson_deploy_runs_audit_migration_after_capability_governance():
    workflow = WORKFLOW.read_text(encoding="utf-8")

    governance = workflow.index("migrations/008_capability_governance.sql")
    audit = workflow.index("migrations/009_competency_change_audit.sql")
    startup = workflow.index("docker compose up -d")
    assert governance < audit < startup
