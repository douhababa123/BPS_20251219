from pathlib import Path
from unittest.mock import MagicMock

from verify_competency_assessment_history_migration import collect_checks


MIGRATION_PATH = Path("backend/migrations/005_competency_assessment_history.sql")


def migration_sql() -> str:
    return MIGRATION_PATH.read_text(encoding="utf-8")


def test_migration_declares_history_and_atomic_validation():
    sql = migration_sql()
    required = [
        "SET XACT_ABORT ON",
        "BEGIN TRANSACTION",
        "competency_assessment_history",
        "MIGRATION_BASELINE",
        "ROW_NUMBER() OVER",
        "UQ_competency_assessments_employee_skill",
        "current_level BETWEEN 0 AND 5",
        "target_level BETWEEN 0 AND 5",
        "target_level >= current_level",
        "THROW",
        "COMMIT TRANSACTION",
    ]

    for fragment in required:
        assert fragment in sql


def test_migration_preserves_every_legacy_row_before_deduplication():
    sql = migration_sql()
    copy_at = sql.index("INSERT INTO dbo.competency_assessment_history")
    delete_at = sql.index("DELETE ca", copy_at)

    assert copy_at < delete_at
    assert "@legacy_count" in sql
    assert "@baseline_count" in sql


def test_migration_is_idempotent_and_indexes_quarterly_history():
    sql = migration_sql()

    assert "source_assessment_id" in sql
    assert "NOT EXISTS" in sql
    assert "IX_competency_history_employee_skill_changed" in sql
    assert "IX_competency_history_year_quarter" in sql


def test_verifier_collects_named_read_only_invariants():
    cursor = MagicMock()
    cursor.fetchone.side_effect = [(1,), (0,), (0,), (0,)]

    results = collect_checks(cursor)

    assert results == {
        "history_table": 1,
        "current_duplicates": 0,
        "invalid_current": 0,
        "invalid_web_history": 0,
    }
    assert cursor.execute.call_count == 4


def test_verifier_handles_pre_migration_database_without_history_table():
    cursor = MagicMock()
    cursor.fetchone.side_effect = [(0,), (0,), (1,)]

    results = collect_checks(cursor)

    assert results == {
        "history_table": 0,
        "current_duplicates": 0,
        "invalid_current": 1,
        "invalid_web_history": 0,
    }
    assert cursor.execute.call_count == 3
