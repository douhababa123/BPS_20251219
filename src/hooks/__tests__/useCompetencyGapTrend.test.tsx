import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { PropsWithChildren } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { getCompetencyGapTrend } from '../../lib/competencyApi';
import { useCompetencyGapTrend } from '../useCompetencyGapTrend';

vi.mock('../../lib/competencyApi', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../lib/competencyApi')>();
  return { ...actual, getCompetencyGapTrend: vi.fn() };
});

describe('useCompetencyGapTrend', () => {
  it('refetches when the selected skill changes', async () => {
    vi.mocked(getCompetencyGapTrend).mockResolvedValue({
      year: 2026,
      moduleId: 7,
      skillId: null,
      quarters: [],
    });
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const wrapper = ({ children }: PropsWithChildren) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );

    const { rerender } = renderHook(
      ({ skillId }: { skillId?: number }) => useCompetencyGapTrend({
        year: 2026,
        moduleId: 7,
        skillId,
      }),
      { wrapper, initialProps: { skillId: undefined as number | undefined } },
    );

    await waitFor(() => expect(getCompetencyGapTrend).toHaveBeenCalledTimes(1));
    rerender({ skillId: 21 });
    await waitFor(() => expect(getCompetencyGapTrend).toHaveBeenLastCalledWith({
      year: 2026,
      moduleId: 7,
      skillId: 21,
    }));
  });
});
