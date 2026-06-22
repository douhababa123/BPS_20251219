export const TASK_TYPES = [
  { code: 'Project', label: 'Project (P)' },
  { code: 'Coaching', label: 'Coaching (C)' },
  { code: 'Training', label: 'Training (T)' },
  { code: 'Meeting', label: 'Meeting (M)' },
  { code: 'Leave', label: 'Leave (L)' },
];

export const TASK_LOCATIONS = [
  'FLCNa',
  'FLCCh',
  'FCGNa',
  'FCLCh',
  'FDCCh',
  'FEDNa',
  'GPU-SU',
  'Nan Jing',
  'Chu Zhou',
];

export const COMPETENCE_CONFIG: Record<string, { color: string; label: string }> = {
  TPM: { color: '#C00000', label: 'TPM' },
  PGL: { color: '#FF0000', label: 'PGL' },
  IE: { color: '#FFC000', label: 'IE' },
  LSC: { color: '#7030A0', label: 'LSC' },
  BPS: { color: '#92D050', label: 'BPS' },
  'Leadership commitment': { color: '#00B050', label: 'Leadership commitment' },
  LEAN: { color: '#00B0F0', label: 'LEAN' },
  'Digital Transformation': { color: '#0070C0', label: 'Digital Transformation' },
  "Everybody's CIP": { color: '#002060', label: "Everybody's CIP" },
  Others: { color: '#808080', label: 'Others' },
};

const MODULE_TO_COMPETENCE_KEY: Record<string, keyof typeof COMPETENCE_CONFIG> = {
  'BPS elements': 'BPS',
  'Investment efficiency_PGL': 'PGL',
  'Investment efficiency_IE': 'IE',
  'Waste-free&stable flow_TPM': 'TPM',
  'Waste-free&stable flow_LBP': 'LSC',
  'Leadership commitment': 'Leadership commitment',
  'CIP in indirect area_LEAN': 'LEAN',
  'Digital Transformation': 'Digital Transformation',
  "Everybody's CIP": "Everybody's CIP",
};

export const COMPETENCE_LIST = Object.keys(COMPETENCE_CONFIG);

export function getCompetenceColorKey(competence: string | null | undefined) {
  if (!competence) return 'Others';

  const rawValue = competence.trim();
  const moduleName = rawValue.includes(' | ') ? rawValue.split(' | ')[0].trim() : rawValue;

  if (moduleName in COMPETENCE_CONFIG) {
    return moduleName;
  }

  if (MODULE_TO_COMPETENCE_KEY[moduleName]) {
    return MODULE_TO_COMPETENCE_KEY[moduleName];
  }

  const normalized = moduleName.toLowerCase();
  if (normalized.includes('tpm')) return 'TPM';
  if (normalized.includes('pgl')) return 'PGL';
  if (normalized.includes('_ie') || normalized.endsWith(' ie') || normalized === 'ie') return 'IE';
  if (normalized.includes('lbp') || normalized.includes('lsc')) return 'LSC';
  if (normalized.includes('bps')) return 'BPS';
  if (normalized.includes('leadership commitment')) return 'Leadership commitment';
  if (normalized.includes('lean')) return 'LEAN';
  if (normalized.includes('digital transformation')) return 'Digital Transformation';
  if (normalized.includes("everybody's cip") || normalized.includes('everybodys cip')) return "Everybody's CIP";

  return 'Others';
}

export function getCompetenceConfig(competence: string | null | undefined) {
  const colorKey = getCompetenceColorKey(competence);
  const config = COMPETENCE_CONFIG[colorKey];

  return {
    ...config,
    colorKey,
    label: competence || config.label,
  };
}

export function getTaskTypeConfig(_taskType: string) {
  return {
    color: 'text-gray-700',
    bgColor: 'bg-gray-100',
    borderColor: 'border-gray-300',
    icon: 'P',
    label: _taskType || 'Unknown',
  };
}
