from pathlib import Path


BACKEND_DIR = Path(__file__).resolve().parents[1]
PROJECT_DIR = BACKEND_DIR.parent
MIGRATION_PATH = BACKEND_DIR / "migrations" / "006_competency_levels_0_4.sql"
RUNNER_PATH = BACKEND_DIR / "run_migration.py"
WORKFLOW_PATH = PROJECT_DIR / ".github" / "workflows" / "jetson-deploy.yml"


def migration_sql() -> str:
    assert MIGRATION_PATH.exists(), "006 competency level migration must exist"
    return MIGRATION_PATH.read_text(encoding="utf-8")


def test_preflight_happens_before_constraint_drop():
    sql = migration_sql()

    preflight = sql.index("current_level > 4 OR target_level > 4")
    first_drop = sql.index("DROP CONSTRAINT")

    assert preflight < first_drop
    assert "THROW 51000" in sql


def test_migration_installs_all_four_level_constraints():
    sql = migration_sql()

    for name in (
        "CK_competency_assessments_current_0_4",
        "CK_competency_assessments_target_0_4",
        "CK_competency_history_current_0_4",
        "CK_competency_history_target_0_4",
    ):
        assert name in sql
    assert sql.count("BETWEEN 0 AND 4") >= 4


def test_runner_requires_an_explicit_migration_path():
    source = RUNNER_PATH.read_text(encoding="utf-8")

    assert "len(sys.argv) != 2" in source
    assert "Path(sys.argv[1])" in source
    assert "001_add_role_to_users.sql" not in source


def test_jetson_runs_migration_after_build_and_before_start():
    workflow = WORKFLOW_PATH.read_text(encoding="utf-8")

    build = workflow.index("docker compose build --pull=false")
    migration = workflow.index("006_competency_levels_0_4.sql")
    start = workflow.index("docker compose up -d")

    assert build < migration < start
    assert "docker compose run --rm --no-deps backend" in workflow


def test_deploy_is_gated_by_offline_tests_and_build():
    workflow = WORKFLOW_PATH.read_text(encoding="utf-8")

    assert "npm test" in workflow
    assert "grep -L" in workflow
    assert "requests([ ,]|$)" in workflow
    assert "needs.test.result == 'success'" in workflow
    assert "needs.test.result == 'failure'" not in workflow
    assert "构建失败不阻止部署" not in workflow
    assert "测试失败不阻止部署" not in workflow
