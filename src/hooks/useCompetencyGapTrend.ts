import { useQuery } from '@tanstack/react-query';

import {
  getCompetencyGapTrend,
  type GapTrendFilters,
} from '../lib/competencyApi';

export function useCompetencyGapTrend(filters: GapTrendFilters) {
  return useQuery({
    queryKey: [
      'competency-gap-trend',
      filters.year,
      filters.moduleId ?? null,
      filters.skillId ?? null,
    ],
    queryFn: () => getCompetencyGapTrend(filters),
  });
}
