import { apiClient } from './api-client';

export interface CompetencyProgressPoint {
  month: number;
  label: string;
  gap: number;
  closeRate: number | null;
  isPartial: boolean;
  cutoff: string;
}

export interface CompetencyProgressResponse {
  year: number;
  month: number;
  moduleId: number | null;
  employeeId: string | null;
  baselineId: string | null;
  cutoff: string | null;
  isPartial: boolean;
  cellCount: number;
  status: 'ready' | 'missing_baseline' | 'empty_scope' | 'data_quality_error' | 'not_started';
  dataQualityWarnings?: string[];
  baseline?: { source: string; filename: string | null; selectedAt: string | null };
  kpis: null | {
    initialLevel: number;
    targetLevel: number;
    currentLevel: number;
    initialGap: number;
    currentGap: number;
    closeRate: number | null;
  };
  monthly: CompetencyProgressPoint[];
}

export interface CompetencyModuleOption {
  module_id: number;
  module_name: string;
}

export interface CompetencyProgressEmployeeOption {
  id: string;
  name: string;
}

export async function getCompetencyProgress(year: number, month: number, moduleId: number | null, employeeId: string | null): Promise<CompetencyProgressResponse> {
  const response = await apiClient.get('/dashboard/competency-progress', {
    params: { year, month, module_id: moduleId ?? undefined, employee_id: employeeId ?? undefined },
  });
  return response.data as CompetencyProgressResponse;
}

export async function getCompetencyProgressEmployees(year: number): Promise<CompetencyProgressEmployeeOption[]> {
  const response = await apiClient.get('/dashboard/competency-progress/employees', { params: { year } });
  return response.data as CompetencyProgressEmployeeOption[];
}

export async function getCompetencyProgressYears(): Promise<number[]> {
  const response = await apiClient.get('/dashboard/competency-progress/years');
  return response.data.years as number[];
}

export async function getCompetencyModules(): Promise<CompetencyModuleOption[]> {
  const response = await apiClient.get('/skills/modules');
  return response.data as CompetencyModuleOption[];
}

export function formatLevel(value: number | null | undefined): string {
  return value == null ? '—' : value.toFixed(1);
}

export function formatGap(value: number | null | undefined): string {
  return value == null ? '—' : String(Math.round(value));
}

export function formatCloseRate(value: number | null | undefined): string {
  if (value == null) return '—';
  const rounded = Math.round(value * 10) / 10;
  return `${Number.isInteger(rounded) ? rounded.toFixed(0) : rounded.toFixed(1)}%`;
}

export function shanghaiYearMonth(date = new Date()): { year: number; month: number } {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Shanghai', year: 'numeric', month: 'numeric',
  }).formatToParts(date);
  return {
    year: Number(parts.find(part => part.type === 'year')?.value),
    month: Number(parts.find(part => part.type === 'month')?.value),
  };
}

export function selectedMonthForYear(year: number, date = new Date()): number {
  const shanghai = shanghaiYearMonth(date);
  return year === shanghai.year ? shanghai.month : 12;
}
