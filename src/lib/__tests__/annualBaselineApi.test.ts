import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiClient } from '../api-client';
import { activateBaseline, activateBaselineFromVersion, previewBaseline } from '../annualBaselineApi';


vi.mock('../api-client', () => ({ apiClient: { get: vi.fn(), post: vi.fn() } }));

describe('annual baseline API', () => {
  beforeEach(() => vi.clearAllMocks());

  it('previews the selected year and file without calling an activation endpoint', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({ data: { valid: true } });
    const file = new File(['xlsx'], 'baseline.xlsx');
    await previewBaseline(2026, file);

    const [path, body] = vi.mocked(apiClient.post).mock.calls[0];
    expect(path).toBe('/admin/competency-annual-baselines/import-preview');
    expect(body).toBeInstanceOf(FormData);
    expect((body as FormData).get('year')).toBe('2026');
    expect((body as FormData).get('file')).toBe(file);
    expect(vi.mocked(apiClient.post).mock.calls[0][2]).toEqual({
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  });

  it('binds activation to the preview hash and expected active baseline', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({ data: {} });
    const file = new File(['xlsx'], 'baseline.xlsx');
    await activateBaseline(2026, file, 'a'.repeat(64), 'b'.repeat(64), 'old-baseline');

    const body = vi.mocked(apiClient.post).mock.calls[0][1] as FormData;
    expect(body.get('preview_sha256')).toBe('a'.repeat(64));
    expect(body.get('preview_token')).toBe('b'.repeat(64));
    expect(body.get('replace')).toBe('true');
    expect(body.get('expected_active_baseline_id')).toBe('old-baseline');
    expect(vi.mocked(apiClient.post).mock.calls[0][2]).toEqual({
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  });

  it('uses the independent saved-version activation endpoint for later years', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({ data: {} });
    await activateBaselineFromVersion(2027, 'version-1', null);
    expect(apiClient.post).toHaveBeenCalledWith('/admin/competency-annual-baselines/from-version', {
      year: 2027,
      source_version_id: 'version-1',
      replace: false,
      expected_active_baseline_id: null,
    });
  });
});
