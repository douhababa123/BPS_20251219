import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useCompetencyGapTrend } from '../../../hooks/useCompetencyGapTrend';
import { calculateEmployeeModuleGapSummary, calculateTeamModuleStats, calculateTeamSkillStats } from '../../../lib/competencyAggregation';
import type { AssessmentFull, Skill } from '../../../lib/database.types';
import { TeamGapAnalysis } from '../TeamGapAnalysis';

vi.mock('recharts', () => {
  const Box = ({ children }: { children?: React.ReactNode }) => <div>{children}</div>;
  return {
    ResponsiveContainer: Box,
    BarChart: Box,
    Bar: Box,
    LineChart: Box,
    Line: Box,
    XAxis: Box,
    YAxis: Box,
    CartesianGrid: Box,
    Tooltip: Box,
    Legend: Box,
    LabelList: Box,
  };
});

vi.mock('../../../hooks/useCompetencyGapTrend', () => ({
  useCompetencyGapTrend: vi.fn(),
}));

const skills: Skill[] = [
  { id: 11, module_id: 1, module_name: 'BPS elements', skill_name: 'Skill 11', skill_code: null, description: null, display_order: 1, is_active: true, created_at: '', updated_at: '' },
  { id: 21, module_id: 7, module_name: 'Leadership commitment', skill_name: 'Skill 21', skill_code: null, description: null, display_order: 1, is_active: true, created_at: '', updated_at: '' },
];

const assessment: AssessmentFull = {
  id: 'a1', employee_id: 'e1', employee_code: 'E1', employee_name: 'Amy',
  department_name: 'D', department_code: 'D', skill_id: 21, module_id: 7,
  module_name: 'Leadership commitment', skill_name: 'Skill 21', display_order: 1,
  current_level: 0, target_level: 2, gap: 2, assessment_year: 2026,
  assessment_date: '2026-07-15', notes: null, created_at: '', updated_at: '',
};

const employees = [
  { employeeId: 'e1', employeeName: 'Amy', departmentName: 'D' },
  { employeeId: 'e2', employeeName: 'No Data', departmentName: 'D' },
];

function renderComponent() {
  const assessments = [assessment];
  render(
    <TeamGapAnalysis
      year={2026}
      assessments={assessments}
      skills={skills}
      employees={employees}
      moduleStats={calculateTeamModuleStats(assessments, skills)}
      skillStats={calculateTeamSkillStats(assessments, skills)}
      summary={calculateEmployeeModuleGapSummary(assessments, skills, employees)}
    />,
  );
}

describe('TeamGapAnalysis', () => {
  beforeEach(() => {
    vi.mocked(useCompetencyGapTrend).mockReturnValue({
      data: { year: 2026, moduleId: null, skillId: null, quarters: [] },
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as never);
  });

  it('renders the four approved cards without ranking or average GAP', () => {
    renderComponent();

    expect(screen.getByRole('heading', { name: /差距分布 Gap Distribution/ })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /人员 GAP 分配/ })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /季度总 GAP 趋势/ })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /工程师模块 GAP 汇总/ })).toBeInTheDocument();
    expect(screen.queryByText('平均 GAP')).not.toBeInTheDocument();
    expect(screen.queryByText('排名')).not.toBeInTheDocument();
    expect(screen.getByText(/No Data/, { selector: 'p' })).toHaveTextContent('暂无评估：');
  });

  it('resets an incompatible trend skill when the module changes', () => {
    renderComponent();

    fireEvent.change(screen.getByLabelText('趋势能力模块'), { target: { value: '7' } });
    fireEvent.change(screen.getByLabelText('趋势技能'), { target: { value: '21' } });
    expect(screen.getByLabelText('趋势技能')).toHaveValue('21');

    fireEvent.change(screen.getByLabelText('趋势能力模块'), { target: { value: '1' } });
    expect(screen.getByLabelText('趋势技能')).toHaveValue('all');
  });

  it('resets the per-person item to a valid option when dimension changes', () => {
    renderComponent();

    fireEvent.change(screen.getByLabelText('人员分配维度'), { target: { value: 'skill' } });
    expect(screen.getByLabelText('人员分配项目')).toHaveValue('11');
    fireEvent.change(screen.getByLabelText('人员分配项目'), { target: { value: '21' } });
    fireEvent.change(screen.getByLabelText('人员分配维度'), { target: { value: 'module' } });
    expect(screen.getByLabelText('人员分配项目')).toHaveValue('1');
  });
});
