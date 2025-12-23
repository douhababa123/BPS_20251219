export const HOURS = {
  AM: 3.5,
  PM: 4.5,
} as const;

export const TASK_TYPES = [
  { code: 'WS', name: 'Workshop' },
  { code: 'SW', name: 'Software' },
  { code: 'P', name: 'Project' },
  { code: 'T', name: 'Training' },
  { code: 'C', name: 'Coaching' },
  { code: 'M', name: 'Meeting' },
  { code: 'L', name: 'Leave' },
  { code: 'SD', name: 'Special Duty' },
] as const;

export const LOCATIONS = [
  { code: 'FLCNa', name: 'FLCNa' },
  { code: 'FLCCh', name: 'FLCCh' },
  { code: 'FCGNa', name: 'FCGNa' },
  { code: 'FCLCh', name: 'FCLCh' },
  { code: 'FDCCh', name: 'FDCCh' },
  { code: 'GPU-SU', name: 'GPU-SU' },
  { code: 'EA', name: 'EA' },
  { code: 'HA', name: 'HA' },
] as const;

export const TOPICS = [
  { code: 'TPM', name: 'TPM', colorHex: '#FACC15' },
  { code: 'Lean flow', name: 'Lean flow', colorHex: '#EF4444' },
  { code: 'S-CIP & PGL', name: 'S-CIP & PGL', colorHex: '#22C55E' },
  { code: 'Lean admin', name: 'Lean admin', colorHex: '#3B82F6' },
  { code: 'Failure prev.', name: 'Failure prevention', colorHex: '#8B5CF6' },
  { code: 'Other', name: 'Other', colorHex: '#111827' },
] as const;

export const ROLES = ['Lead', 'Expert', 'Member', 'Coach'] as const;

export const ROLE_THRESHOLDS = {
  Lead: { keyItem: 4.0, moduleMean: 3.5 },
  Expert: { keyItem: 4.5, moduleMean: 4.0 },
} as const;

export const PERSONAS = ['Admin', 'Site PS', 'BPS Engineer'] as const;

export const COLORS = {
  primary: '#1E3A8A',
  accent: '#B91C1C',
  success: '#15803D',
  warning: '#B45309',
  info: '#334155',
} as const;
