import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { PersonalModuleStats, PersonalSkillStats } from '../../../lib/competencyAggregation';
import { PersonalGapAnalysis } from '../PersonalGapAnalysis';

vi.mock('recharts', () => {
  const Box = ({ children }: { children?: React.ReactNode }) => <div>{children}</div>;
  return {
    ResponsiveContainer: Box,
    RadarChart: Box,
    Radar: Box,
    PolarGrid: Box,
    PolarAngleAxis: Box,
    PolarRadiusAxis: Box,
    Legend: Box,
    CartesianGrid: Box,
    XAxis: Box,
    YAxis: Box,
    Tooltip: Box,
    BarChart: ({ data, children }: { data: unknown; children?: React.ReactNode }) => <div data-testid="personal-bar-data" data-value={JSON.stringify(data)}>{children}</div>,
    Bar: Box,
    LabelList: Box,
  };
});

const modules: PersonalModuleStats[] = [
  { moduleId: 1, moduleName: 'Module 1', icon: '1', color: '#000', current: 2.5, target: 4, gap: 1.5, totalGap: 3, skillCount: 2 },
  { moduleId: 2, moduleName: 'Module 2', icon: '2', color: '#111', current: 4, target: 4, gap: 0, totalGap: 0, skillCount: 1 },
];
const skills: PersonalSkillStats[] = [
  { skillId: 1, skillName: 'Skill 1', moduleName: 'Module 1', current: 2, target: 4, gap: 2 },
];

describe('PersonalGapAnalysis', () => {
  it('uses module total GAP and removes average GAP from the table', () => {
    render(<PersonalGapAnalysis employeeName="Amy" chartType="module" setChartType={vi.fn()} moduleStats={modules} skillStats={skills} />);

    expect(screen.getByRole('columnheader', { name: '总 GAP' })).toBeInTheDocument();
    expect(screen.queryByRole('columnheader', { name: '平均 GAP' })).not.toBeInTheDocument();
    expect(screen.getByTestId('personal-module-gap-1')).toHaveTextContent('3');
    expect(screen.getByTestId('personal-bar-data')).toHaveAttribute('data-value', expect.stringContaining('"Gap":3'));
  });
});
