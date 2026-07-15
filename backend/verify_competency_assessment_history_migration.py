"""Read-only checks for the competency assessment history migration."""

from database import db


CHECKS = {
    "history_table": """
        SELECT COUNT(*)
        FROM sys.tables
        WHERE object_id = OBJECT_ID('dbo.competency_assessment_history')
    """,
    "current_duplicates": """
        SELECT COUNT(*)
        FROM (
            SELECT employee_id, skill_id
            FROM dbo.competency_assessments
            GROUP BY employee_id, skill_id
            HAVING COUNT(*) > 1
        ) duplicate_keys
    """,
    "invalid_current": """
        SELECT COUNT(*)
        FROM dbo.competency_assessments
        WHERE current_level NOT BETWEEN 0 AND 5
           OR target_level NOT BETWEEN 0 AND 5
           OR target_level < current_level
    """,
    "invalid_web_history": """
        SELECT COUNT(*)
        FROM dbo.competency_assessment_history
        WHERE current_level NOT BETWEEN 0 AND 5
           OR target_level NOT BETWEEN 0 AND 5
           OR assessment_quarter NOT BETWEEN 1 AND 4
           OR (change_source = 'WEB_EDIT' AND target_level < current_level)
    """,
}


def collect_checks(cursor):
    results = {}
    for name, sql in CHECKS.items():
        if name == "invalid_web_history" and results.get("history_table") == 0:
            results[name] = 0
            continue
        cursor.execute(sql)
        results[name] = int(cursor.fetchone()[0])
    return results


def main() -> int:
    with db.get_cursor() as cursor:
        results = collect_checks(cursor)

    print(results)
    valid = results["history_table"] == 1 and all(
        results[name] == 0
        for name in (
            "current_duplicates",
            "invalid_current",
            "invalid_web_history",
        )
    )
    return 0 if valid else 1


if __name__ == "__main__":
    raise SystemExit(main())
