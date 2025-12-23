export type TaskType = 'WS' | 'SW' | 'P' | 'T' | 'C' | 'M' | 'L' | 'SD';
export type Location = 'FLCNa' | 'FLCCh' | 'FCGNa' | 'FCLCh' | 'FDCCh' | 'GPU-SU' | 'EA' | 'HA';
export type Topic = 'TPM' | 'Lean flow' | 'S-CIP & PGL' | 'Lean admin' | 'Failure prev.' | 'Other';
export type Role = 'Lead' | 'Expert' | 'Member' | 'Coach';
export type Half = 'AM' | 'PM';
export type Persona = 'Admin' | 'Site PS' | 'BPS Engineer';
export type RoleGate = 'OK' | 'LEAD_LOW' | 'EXPERT_LOW';
export type ImportType = 'competency_definition' | 'competency_assessment';
export type CompetencyLevel = 1 | 2 | 3 | 4 | 5;

export interface User {
  id: number;
  name: string;
  dept: string;
  role: Role;
  homeLocation: Location;
}

export interface CompetencyModule {
  id: number;
  name: string;
}

export interface CompetencyItem {
  id: number;
  moduleId: number;
  name: string;
  owner: string;
  isKeyDefault: boolean;
}

export interface Assessment {
  userId: number;
  itemId: number;
  year: number;
  currentLevel: number;
  targetLevel: number;
  isKey: boolean;
}

export interface CalendarSlot {
  id: string;
  userId: number;
  date: string;
  half: Half;
  type: TaskType;
  location: Location;
  topic: Topic;
  hours: number;
  source: 'import' | 'system';
}

export interface MatchingRequest {
  name: string;
  role: Role;
  startDate: string;
  endDate: string;
  moduleId: number;
  required: Array<{
    itemId: number;
    requiredLevel: number;
    isKey: boolean;
  }>;
  type: TaskType;
  location: Location;
  topic: Topic;
  suggestedUserId?: number;
}

export interface MatchingCandidate {
  userId: number;
  name: string;
  dept: string;
  homeLocation: Location;
  skillScore: number;
  timeScore: number;
  finalScore: number;
  qualified: boolean;
  roleGate: RoleGate;
  badges: string[];
  explain: {
    items: Array<{
      itemId: number;
      Ci: number;
      Ri: number;
      Ti: number;
      isKey: boolean;
      base: number;
      bonus: number;
      w: number;
      si: number;
    }>;
    sumW: number;
    skillScore: number;
    time: {
      workSlots: number;
      freeSlots: number;
      timeScore: number;
    };
  };
}

// 能力定义表（第一张表）
export interface CompetencyDefinition {
  id: number;
  moduleId: number;
  moduleName: string;  // 9大能力模块
  competencyType: string;  // 39种能力类型
  engineer: string;  // 对应工程师名称
}

// 能力评估表（第二张表）
export interface CompetencyAssessmentRecord {
  id?: number;
  department: string;
  name: string;
  module: string;
  competencyType: string;
  currentScore: CompetencyLevel;  // C - 现状得分 (1-5)
  targetScore: CompetencyLevel;   // T - 目标得分 (1-5)
  gap?: number;  // 差距值 = 目标 - 现状
  year: number;  // 评估年度
}

// 能力级别说明
export interface LevelDescription {
  level: CompetencyLevel;
  name: string;
  description: string;
}

// 汇总统计数据
export interface CompetencySummary {
  name: string;
  department: string;
  totalModules: number;
  averageCurrentScore: number;
  averageTargetScore: number;
  averageGap: number;
  moduleDetails: Array<{
    module: string;
    itemCount: number;
    avgCurrent: number;
    avgTarget: number;
    avgGap: number;
  }>;
}
