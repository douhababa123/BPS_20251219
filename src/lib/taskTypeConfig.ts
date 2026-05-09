// 任务类型列表（固定5种）
export const TASK_TYPES = [
  { code: 'Project', label: 'Project (P)' },
  { code: 'Coaching', label: 'Coaching (C)' },
  { code: 'Training', label: 'Training (T)' },
  { code: 'Meeting', label: 'Meeting (M)' },
  { code: 'Leave', label: 'Leave (L)' },
];

// 任务地点列表（固定9个）
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

// 能力维度配置（含十六进制颜色）
export const COMPETENCE_CONFIG: Record<string, { color: string; label: string }> = {
  'TPM':                    { color: '#C00000', label: 'TPM' },
  'PGL':                    { color: '#FF0000', label: 'PGL' },
  'IE':                     { color: '#FFC000', label: 'IE' },
  'LSC':                    { color: '#7030A0', label: 'LSC' },
  'BPS':                    { color: '#92D050', label: 'BPS' },
  'Leadership commitment':  { color: '#00B050', label: 'Leadership commitment' },
  'LEAN':                   { color: '#00B0F0', label: 'LEAN' },
  'Digital Transformation': { color: '#0070C0', label: 'Digital Transformation' },
  "Everybody's CIP":        { color: '#002060', label: "Everybody's CIP" },
  'Others':                 { color: '#808080', label: 'Others' },
};

// 能力选项列表（用于表单下拉）
export const COMPETENCE_LIST = Object.keys(COMPETENCE_CONFIG);

// 获取能力配置（带默认值）
export function getCompetenceConfig(competence: string | null | undefined) {
  if (!competence) {
    return { color: '#808080', label: 'Others' };
  }
  return COMPETENCE_CONFIG[competence] || { color: '#808080', label: competence };
}

// 向后兼容：保留旧函数（用于不需要颜色的地方）
export function getTaskTypeConfig(_taskType: string) {
  return {
    color: 'text-gray-700',
    bgColor: 'bg-gray-100',
    borderColor: 'border-gray-300',
    icon: '📋',
    label: _taskType || 'Unknown',
  };
}




