import { describe, expect, it } from 'vitest';
import { formatCloseRate, formatGap, formatLevel, selectedMonthForYear } from '../dashboardProgressApi';


describe('dashboard progress formatting', () => {
  it('uses one decimal for levels, integers for GAP and at most one decimal for rates', () => {
    expect(formatLevel(1.25)).toBe('1.3');
    expect(formatGap(160)).toBe('160');
    expect(formatCloseRate(20)).toBe('20%');
    expect(formatCloseRate(20.54)).toBe('20.5%');
  });

  it('shows unavailable values as an em dash including zero-baseline close rate', () => {
    expect(formatLevel(null)).toBe('—');
    expect(formatGap(undefined)).toBe('—');
    expect(formatCloseRate(null)).toBe('—');
  });

  it('defaults current year to current month and a past year to December', () => {
    const date = new Date(2026, 8, 11);
    expect(selectedMonthForYear(2026, date)).toBe(9);
    expect(selectedMonthForYear(2025, date)).toBe(12);
  });
});
