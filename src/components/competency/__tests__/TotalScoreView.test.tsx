import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { ModuleStats } from '../../../lib/competencyAggregation';
import { TotalScoreView } from '../TotalScoreView';

vi.mock('recharts', () => {
  const Box = ({ children }: { children?: React.ReactNode }) => <div>{children}</div>;
  return {
    ResponsiveContainer: Box,
    PolarGrid: Box,
    PolarAngleAxis: Box,
    CartesianGrid: Box,
    XAxis: Box,
    Tooltip: Box,
    Legend: Box,
    RadarChart: ({ data, children }: { data: unknown; children?: React.ReactNode }) => <div data-testid="radar-data" data-value={JSON.stringify(data)}>{children}</div>,
    BarChart: ({ data, children }: { data: unknown; children?: React.ReactNode }) => <div data-testid="bar-data" data-value={JSON.stringify(data)}>{children}</div>,
    PolarRadiusAxis: ({ domain }: { domain: unknown }) => <div data-testid="radar-domain">{JSON.stringify(domain)}</div>,
    YAxis: ({ domain }: { domain: unknown }) => <div data-testid="bar-domain">{JSON.stringify(domain)}</div>,
    Radar: ({ dataKey, label }: { dataKey: string; label?: (props: object) => React.ReactElement }) => {
      // Recharts' Radar label list exposes Cartesian x/y coordinates, but no
      // radar centre (cx/cy). Keep this mock aligned with the real contract.
      const rendered = label?.({ x: 10, y: 10, value: 2 });
      return <div data-testid={`radar-${dataKey}`}>{rendered?.props.children}</div>;
    },
    Bar: ({ dataKey, children }: { dataKey: string; children?: React.ReactNode }) => <div data-testid={`bar-${dataKey}`}>{children}</div>,
    LabelList: ({ formatter }: { formatter?: (value: number) => string }) => <span>{formatter?.(2)}</span>,
  };
});

const moduleStats: ModuleStats[] = [
  { moduleId: 1, moduleName: 'Module 1', icon: '1', color: '#000', avgCurrent: 2, avgTarget: 3, totalCurrent: 4, totalTarget: 6, totalGap: 2, avgGap: 1, employeeCount: 2, skillCount: 1 },
  { moduleId: 2, moduleName: 'Module 2', icon: '2', color: '#111', avgCurrent: 4, avgTarget: 4, totalCurrent: 4, totalTarget: 4, totalGap: 0, avgGap: 0, employeeCount: 1, skillCount: 1 },
];

describe('TotalScoreView', () => {
  it('shows module averages on fixed 0-4 charts with one-decimal labels', () => {
    render(<TotalScoreView moduleStats={moduleStats} />);

    expect(screen.getByTestId('radar-data')).toHaveAttribute('data-value', expect.stringContaining('"currentAverage":2'));
    expect(screen.getByTestId('bar-data')).toHaveAttribute('data-value', expect.stringContaining('"targetAverage":3'));
    expect(screen.getByTestId('radar-domain')).toHaveTextContent('[0,4]');
    expect(screen.getByTestId('bar-domain')).toHaveTextContent('[0,4]');
    expect(screen.getByTestId('bar-currentAverage')).toHaveTextContent('2.0');
    expect(screen.getByTestId('bar-targetAverage')).toHaveTextContent('2.0');
    expect(screen.getByTestId('radar-currentAverage')).toHaveTextContent('2.0');
    expect(screen.getByTestId('radar-targetAverage')).toHaveTextContent('2.0');
  });

  it('keeps the total KPI cards and detail table', () => {
    render(<TotalScoreView moduleStats={moduleStats} />);

    expect(screen.getByText('总目标分数')).toBeInTheDocument();
    expect(screen.getByText('总实际分数')).toBeInTheDocument();
    expect(screen.getByText('总差距')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /模块总分详情/ })).toBeInTheDocument();
  });
});
