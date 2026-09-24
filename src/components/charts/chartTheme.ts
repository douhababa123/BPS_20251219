export const CHART_COLORS = {
  current: '#2563EB',
  target: '#EA580C',
  gap: '#DC2626',
  gapPrimary: '#166985',
  gapSecondary: '#0EA5E9',
  closeRate: '#C2410C',
  muted: '#94A3B8',
  grid: '#E2E8F0',
  axis: '#64748B',
} as const;

export const CHART_AXIS_TICK = {
  fill: CHART_COLORS.axis,
  fontSize: 12,
} as const;

export const CHART_TOOLTIP_STYLE = {
  backgroundColor: '#FFFFFF',
  border: '1px solid #E2E8F0',
  borderRadius: 12,
  boxShadow: '0 10px 25px -8px rgb(15 23 42 / 0.22)',
  color: '#0F172A',
  fontSize: 13,
} as const;

export const CHART_TOOLTIP_LABEL_STYLE = {
  color: '#0F172A',
  fontWeight: 600,
  marginBottom: 6,
} as const;

export function horizontalChartHeight(itemCount: number, rowHeight = 38, minimum = 320) {
  return Math.max(minimum, itemCount * rowHeight + 56);
}
