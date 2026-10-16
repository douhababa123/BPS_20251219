import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Matching } from '../Matching';

vi.mock('../../contexts/NewAuthContext', () => ({
  useNewAuth: () => ({ user: { id: 'admin', email: 'admin@bosch.com', role: 'admin' } }),
}));

vi.mock('../../services', () => ({
  employeesService: { getAll: vi.fn().mockResolvedValue([]) },
  taskTypesService: { getAll: vi.fn().mockResolvedValue([]) },
}));

vi.mock('../../lib/matchingApi', () => ({
  matchingApi: {
    getModules: vi.fn().mockResolvedValue([]),
    getSkills: vi.fn().mockResolvedValue([]),
    getMatchingHistory: vi.fn().mockResolvedValue([]),
  },
}));

describe('task matching location selector', () => {
  it('offers FEDNa as a task location', () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(<QueryClientProvider client={client}><Matching /></QueryClientProvider>);

    const label = screen.getByText('地点 Location', { selector: 'label' });
    const location = label.parentElement?.querySelector('select');
    expect(location).toBeTruthy();
    expect(Array.from(location!.options).map(option => option.value)).toContain('FEDNa');
  });
});
