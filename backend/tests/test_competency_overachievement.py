from datetime import datetime
from pathlib import Path
from unittest.mock import MagicMock

from competency_assessment_history import build_matrix_payload, resolve_editable_module_ids
from competency_progress import build_competency_progress
from routers.competency_assessments import get_competency_assessments_full


def test_roster_excludes_resource_only_people_but_keeps_admin_permissions_and_actual_levels():
    employees = [
        ('e1', 'E1', 'Engineer', 'D', 'engineer@example.com'),
        ('e2', 'E2', 'Tyler Tan', 'D', 'Tyler.Tan@bshg.com'),
        ('e3', 'E3', 'SNa-ME_Tong_Zhifeng', 'D', 'Zhifeng.Tong@bshg.com'),
    ]
    skills = [(1, 1, 'Module', 'Skill A', 1), (2, 1, 'Module', 'Skill B', 2)]
    values = [('e1', 1, 4, 2, -2), ('e1', 2, 1, 3, 2), ('e2', 1, 0, 4, 4)]
    result = build_matrix_payload(employees, skills, values, {'editable_module_ids': None})
    assert [r['employeeId'] for r in result['rows']] == ['e1']
    assert result['rows'][0]['skills'][1]['gap'] == 0
    assert result['rows'][0]['skills'][1]['currentLevel'] == 4
    assert result['rows'][0]['skills'][1]['targetLevel'] == 2
    assert result['stats']['totalGapScore'] == 2
    assert result['stats']['totalAssessments'] == 2
    assert resolve_editable_module_ids(MagicMock(), {'role': 'admin', 'email': 'Tyler.Tan@bshg.com'}) is None


def test_full_api_roster_filter_is_opt_in_and_gap_is_nonnegative():
    row = ['a1', 'e1', 'E1', 'Engineer', 'D', 'D', 1, 1, 'Module', 'Skill', 0, 4, 2, -2, 2026, None, None, None, None]
    cursor = MagicMock()
    cursor.fetchall.return_value = [row]
    result = get_competency_assessments_full(cursor=cursor)
    assert result[0]['gap'] == 0
    assert (result[0]['current_level'], result[0]['target_level']) == (4, 2)
    assert 'NOT IN' not in cursor.execute.call_args.args[0]
    get_competency_assessments_full(assessment_roster=True, cursor=cursor)
    assert 'NOT IN (?, ?)' in cursor.execute.call_args.args[0]
    assert cursor.execute.call_args.args[1] == ['zhifeng.tong@bshg.com', 'tyler.tan@bshg.com']


def test_dashboard_overachievement_does_not_offset_other_skill_gap():
    result = build_competency_progress(year=2026, selected_month=10, baseline_id='b', module_id=None,
        cells=[{'employee_id': 'e', 'skill_id': skill, 'initial_current': 0, 'annual_target': 2} for skill in (1, 2)],
        history=[{'employee_id': 'e', 'skill_id': 1, 'current_level': 4, 'changed_at': datetime(2026, 10, 1)}],
        now=datetime(2026, 10, 23))
    assert result['kpis']['currentGap'] == 2
    assert result['kpis']['closeRate'] == 50


def test_migration_only_removes_pair_constraints_without_changing_scores():
    sql = (Path(__file__).resolve().parents[1] / 'migrations/010_allow_competency_overachievement.sql').read_text()
    assert 'BEGIN TRANSACTION' in sql and 'ROLLBACK' in sql
    assert 'DROP CONSTRAINT CK_competency_assessments_target_gte_current' in sql
    assert 'DROP CONSTRAINT CK_competency_history_target_gte_current' in sql
    assert 'UPDATE ' not in sql and 'DELETE ' not in sql
