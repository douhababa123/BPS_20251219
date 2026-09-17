import { apiClient } from './api-client';

export interface BaselineRevision {
  id: string;
  year: number;
  source: 'EXCEL_IMPORT' | 'SAVED_VERSION';
  filename: string | null;
  sourceVersionId: string | null;
  isActive: boolean;
  selectedByUserId: string | null;
  selectedByEmail: string | null;
  selectedAt: string | null;
  cellCount: number;
  employeeCount: number;
  skillCount: number;
}

export interface BaselineStatus {
  year: number;
  active: BaselineRevision | null;
  revisions: BaselineRevision[];
}

export interface AssessmentVersion {
  id: string;
  createdAt: string | null;
  cellCount: number;
  source: string;
  notes: string | null;
  createdByEmail: string | null;
}

export interface BaselinePreview {
  year: number;
  filename: string;
  sha256: string;
  previewToken: string;
  valid: boolean;
  errors: Array<{ row: number; field: string; message: string }>;
  summary: {
    employeeCount: number;
    skillCount: number;
    cellCount: number;
    initialLevel: number | null;
    targetLevel: number | null;
    initialGap: number;
  };
  rows: Array<{
    row: number;
    employeeId: string;
    employeeName: string;
    skillId: number;
    moduleName: string;
    skillName: string;
    initialCurrent: number;
    annualTarget: number;
    gap: number;
  }>;
  rowsTruncated: boolean;
}

export async function getBaselineStatus(year: number): Promise<BaselineStatus> {
  const response = await apiClient.get('/admin/competency-annual-baselines', { params: { year } });
  return response.data as BaselineStatus;
}

export async function downloadBaselineTemplate(): Promise<Blob> {
  const response = await apiClient.get('/admin/competency-annual-baselines/template', { responseType: 'blob' });
  return response.data as Blob;
}

export async function previewBaseline(year: number, file: File): Promise<BaselinePreview> {
  const form = new FormData();
  form.append('year', String(year));
  form.append('file', file);
  const response = await apiClient.post('/admin/competency-annual-baselines/import-preview', form);
  return response.data as BaselinePreview;
}

export async function activateBaseline(
  year: number,
  file: File,
  previewSha256: string,
  previewToken: string,
  activeBaselineId: string | null,
): Promise<void> {
  const form = new FormData();
  form.append('year', String(year));
  form.append('preview_sha256', previewSha256);
  form.append('preview_token', previewToken);
  form.append('replace', activeBaselineId ? 'true' : 'false');
  if (activeBaselineId) form.append('expected_active_baseline_id', activeBaselineId);
  form.append('file', file);
  await apiClient.post('/admin/competency-annual-baselines', form);
}

export async function getAssessmentVersions(): Promise<AssessmentVersion[]> {
  const response = await apiClient.get('/competency-assessment-versions');
  return (response.data as { versions: AssessmentVersion[] }).versions;
}

export async function activateBaselineFromVersion(
  year: number,
  sourceVersionId: string,
  activeBaselineId: string | null,
): Promise<void> {
  await apiClient.post('/admin/competency-annual-baselines/from-version', {
    year,
    source_version_id: sourceVersionId,
    replace: Boolean(activeBaselineId),
    expected_active_baseline_id: activeBaselineId,
  });
}
