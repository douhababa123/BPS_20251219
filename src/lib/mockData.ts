import type { User, CompetencyModule, CompetencyItem, Assessment, CalendarSlot, CompetencyDefinition, CompetencyAssessmentRecord } from './types';

export const mockUsers: User[] = [
  { id: 101, name: 'Zhang Wei', dept: 'Quality Team', role: 'Lead', homeLocation: 'FDCCh' },
  { id: 102, name: 'Li Na', dept: 'Process Engineering', role: 'Expert', homeLocation: 'FLCCh' },
  { id: 103, name: 'Chen Ming', dept: 'TPM Center', role: 'Member', homeLocation: 'FDCCh' },
  { id: 104, name: 'Wang Pei', dept: 'Validation Lab', role: 'Lead', homeLocation: 'FDCCh' },
  { id: 105, name: 'Liu Yang', dept: 'Lean Office', role: 'Expert', homeLocation: 'FLCNa' },
  { id: 106, name: 'Zhao Lin', dept: 'Quality Team', role: 'Member', homeLocation: 'FDCCh' },
  { id: 107, name: 'Sun Hui', dept: 'Process Engineering', role: 'Coach', homeLocation: 'FLCCh' },
  { id: 108, name: 'Zhou Fang', dept: 'TPM Center', role: 'Lead', homeLocation: 'FCLCh' },
  { id: 109, name: 'Wu Jing', dept: 'Validation Lab', role: 'Expert', homeLocation: 'FDCCh' },
  { id: 110, name: 'Xu Han', dept: 'Lean Office', role: 'Member', homeLocation: 'FLCNa' },
];

export const mockModules: CompetencyModule[] = [
  { id: 1, name: 'TPM基础' },
  { id: 2, name: '精益流程' },
  { id: 3, name: 'S-CIP改善' },
  { id: 4, name: 'PGL标准化' },
  { id: 5, name: '数据分析' },
  { id: 6, name: '项目管理' },
  { id: 7, name: '团队协作' },
  { id: 8, name: '问题解决' },
  { id: 9, name: '持续改进' },
];

export const mockItems: CompetencyItem[] = [
  { id: 1, moduleId: 1, name: 'TPM八大支柱', owner: 'TPM Center', isKeyDefault: true },
  { id: 2, moduleId: 1, name: 'OEE计算与分析', owner: 'TPM Center', isKeyDefault: true },
  { id: 3, moduleId: 1, name: '自主保全体系', owner: 'TPM Center', isKeyDefault: false },
  { id: 4, moduleId: 1, name: '计划保全方法', owner: 'TPM Center', isKeyDefault: false },
  { id: 5, moduleId: 1, name: '设备故障分析', owner: 'TPM Center', isKeyDefault: true },

  { id: 6, moduleId: 2, name: '价值流分析', owner: 'Lean Office', isKeyDefault: true },
  { id: 7, moduleId: 2, name: '流程映射技术', owner: 'Lean Office', isKeyDefault: true },
  { id: 8, moduleId: 2, name: '瓶颈识别方法', owner: 'Lean Office', isKeyDefault: false },
  { id: 9, moduleId: 2, name: '拉动系统设计', owner: 'Lean Office', isKeyDefault: false },

  { id: 10, moduleId: 3, name: 'S-CIP方法论', owner: 'Process Engineering', isKeyDefault: true },
  { id: 11, moduleId: 3, name: '改善提案管理', owner: 'Process Engineering', isKeyDefault: false },
  { id: 12, moduleId: 3, name: 'A3思维应用', owner: 'Process Engineering', isKeyDefault: true },
  { id: 13, moduleId: 3, name: 'PDCA循环实践', owner: 'Process Engineering', isKeyDefault: false },

  { id: 14, moduleId: 4, name: 'PGL标准制定', owner: 'Quality Team', isKeyDefault: true },
  { id: 15, moduleId: 4, name: '标准化作业', owner: 'Quality Team', isKeyDefault: false },
  { id: 16, moduleId: 4, name: '审核与评估', owner: 'Quality Team', isKeyDefault: false },

  { id: 17, moduleId: 5, name: '统计过程控制', owner: 'Quality Team', isKeyDefault: true },
  { id: 18, moduleId: 5, name: 'Excel数据分析', owner: 'Quality Team', isKeyDefault: false },
  { id: 19, moduleId: 5, name: 'Power BI可视化', owner: 'Quality Team', isKeyDefault: false },
  { id: 20, moduleId: 5, name: 'Python数据处理', owner: 'Quality Team', isKeyDefault: false },

  { id: 21, moduleId: 6, name: '项目计划编制', owner: 'Process Engineering', isKeyDefault: true },
  { id: 22, moduleId: 6, name: '资源协调管理', owner: 'Process Engineering', isKeyDefault: false },
  { id: 23, moduleId: 6, name: '风险识别与应对', owner: 'Process Engineering', isKeyDefault: true },
  { id: 24, moduleId: 6, name: '干系人沟通', owner: 'Process Engineering', isKeyDefault: false },

  { id: 25, moduleId: 7, name: '跨部门协作', owner: 'Lean Office', isKeyDefault: false },
  { id: 26, moduleId: 7, name: '会议引导技术', owner: 'Lean Office', isKeyDefault: false },
  { id: 27, moduleId: 7, name: '冲突管理', owner: 'Lean Office', isKeyDefault: false },
  { id: 28, moduleId: 7, name: '团队建设活动', owner: 'Lean Office', isKeyDefault: false },
  { id: 29, moduleId: 7, name: '激励与反馈', owner: 'Lean Office', isKeyDefault: false },

  { id: 30, moduleId: 8, name: '8D问题解决', owner: 'Quality Team', isKeyDefault: true },
  { id: 31, moduleId: 8, name: '5Why根因分析', owner: 'Quality Team', isKeyDefault: true },
  { id: 32, moduleId: 8, name: '鱼骨图分析法', owner: 'Quality Team', isKeyDefault: false },
  { id: 33, moduleId: 8, name: 'FMEA应用', owner: 'Quality Team', isKeyDefault: true },
  { id: 34, moduleId: 8, name: '头脑风暴技术', owner: 'Quality Team', isKeyDefault: false },

  { id: 35, moduleId: 9, name: 'Kaizen理念', owner: 'Lean Office', isKeyDefault: false },
  { id: 36, moduleId: 9, name: '改善成果验证', owner: 'Lean Office', isKeyDefault: false },
  { id: 37, moduleId: 9, name: '知识管理', owner: 'Lean Office', isKeyDefault: false },
  { id: 38, moduleId: 9, name: '最佳实践复制', owner: 'Lean Office', isKeyDefault: true },
  { id: 39, moduleId: 9, name: '持续学习体系', owner: 'Lean Office', isKeyDefault: false },
];

export const mockAssessments: Assessment[] = [
  { userId: 104, itemId: 7, year: 2025, currentLevel: 4, targetLevel: 5, isKey: true },
  { userId: 104, itemId: 12, year: 2025, currentLevel: 3, targetLevel: 4, isKey: false },
  { userId: 104, itemId: 21, year: 2025, currentLevel: 4, targetLevel: 5, isKey: true },
  { userId: 104, itemId: 30, year: 2025, currentLevel: 5, targetLevel: 5, isKey: true },
  { userId: 104, itemId: 31, year: 2025, currentLevel: 4, targetLevel: 5, isKey: true },

  { userId: 102, itemId: 7, year: 2025, currentLevel: 5, targetLevel: 5, isKey: true },
  { userId: 102, itemId: 12, year: 2025, currentLevel: 4, targetLevel: 5, isKey: true },
  { userId: 102, itemId: 21, year: 2025, currentLevel: 3, targetLevel: 4, isKey: false },
  { userId: 102, itemId: 30, year: 2025, currentLevel: 4, targetLevel: 5, isKey: true },

  { userId: 101, itemId: 1, year: 2025, currentLevel: 2, targetLevel: 4, isKey: true },
  { userId: 101, itemId: 7, year: 2025, currentLevel: 3, targetLevel: 4, isKey: false },
  { userId: 101, itemId: 30, year: 2025, currentLevel: 5, targetLevel: 5, isKey: true },
];

export const mockSlots: CalendarSlot[] = [
  { id: '1', userId: 104, date: '2025-01-06', half: 'AM', type: 'P', location: 'FDCCh', topic: 'TPM', hours: 3.5, source: 'import' },
  { id: '2', userId: 104, date: '2025-01-06', half: 'PM', type: 'P', location: 'FDCCh', topic: 'TPM', hours: 4.5, source: 'import' },
  { id: '3', userId: 104, date: '2025-01-07', half: 'AM', type: 'WS', location: 'FLCCh', topic: 'Lean flow', hours: 3.5, source: 'system' },
  { id: '4', userId: 104, date: '2025-01-08', half: 'PM', type: 'T', location: 'FDCCh', topic: 'S-CIP & PGL', hours: 4.5, source: 'import' },

  { id: '5', userId: 102, date: '2025-01-06', half: 'AM', type: 'C', location: 'FLCCh', topic: 'Lean admin', hours: 3.5, source: 'system' },
  { id: '6', userId: 102, date: '2025-01-07', half: 'PM', type: 'M', location: 'FLCCh', topic: 'Other', hours: 4.5, source: 'import' },
  { id: '7', userId: 102, date: '2025-01-08', half: 'AM', type: 'P', location: 'FLCCh', topic: 'TPM', hours: 3.5, source: 'import' },
  { id: '8', userId: 102, date: '2025-01-08', half: 'PM', type: 'P', location: 'FLCCh', topic: 'TPM', hours: 4.5, source: 'import' },

  { id: '9', userId: 101, date: '2025-01-09', half: 'AM', type: 'L', location: 'FDCCh', topic: 'Other', hours: 3.5, source: 'system' },
  { id: '10', userId: 101, date: '2025-01-09', half: 'PM', type: 'L', location: 'FDCCh', topic: 'Other', hours: 4.5, source: 'system' },
];

// 新增：能力定义数据（第一张表）
export const mockCompetencyDefinitions: CompetencyDefinition[] = [
  // TPM基础模块
  { id: 1, moduleId: 1, moduleName: 'TPM基础', competencyType: 'TPM八大支柱', engineer: 'Zhang Wei' },
  { id: 2, moduleId: 1, moduleName: 'TPM基础', competencyType: 'OEE计算与分析', engineer: 'Li Na' },
  { id: 3, moduleId: 1, moduleName: 'TPM基础', competencyType: '自主保全体系', engineer: 'Chen Ming' },
  { id: 4, moduleId: 1, moduleName: 'TPM基础', competencyType: '计划保全方法', engineer: 'Chen Ming' },
  { id: 5, moduleId: 1, moduleName: 'TPM基础', competencyType: '设备故障分析', engineer: 'Wang Pei' },
  
  // 精益流程模块
  { id: 6, moduleId: 2, moduleName: '精益流程', competencyType: '价值流分析', engineer: 'Liu Yang' },
  { id: 7, moduleId: 2, moduleName: '精益流程', competencyType: '流程映射技术', engineer: 'Liu Yang' },
  { id: 8, moduleId: 2, moduleName: '精益流程', competencyType: '瓶颈识别方法', engineer: 'Zhao Lin' },
  { id: 9, moduleId: 2, moduleName: '精益流程', competencyType: '拉动系统设计', engineer: 'Sun Hui' },
  
  // S-CIP改善模块
  { id: 10, moduleId: 3, moduleName: 'S-CIP改善', competencyType: 'S-CIP方法论', engineer: 'Zhou Fang' },
  { id: 11, moduleId: 3, moduleName: 'S-CIP改善', competencyType: '改善提案管理', engineer: 'Wu Jing' },
  { id: 12, moduleId: 3, moduleName: 'S-CIP改善', competencyType: 'A3思维应用', engineer: 'Xu Han' },
  { id: 13, moduleId: 3, moduleName: 'S-CIP改善', competencyType: 'PDCA循环实践', engineer: 'Zhang Wei' },
  
  // PGL标准化模块
  { id: 14, moduleId: 4, moduleName: 'PGL标准化', competencyType: 'PGL标准制定', engineer: 'Li Na' },
  { id: 15, moduleId: 4, moduleName: 'PGL标准化', competencyType: '标准化作业', engineer: 'Chen Ming' },
  { id: 16, moduleId: 4, moduleName: 'PGL标准化', competencyType: '审核与评估', engineer: 'Wang Pei' },
  
  // 数据分析模块
  { id: 17, moduleId: 5, moduleName: '数据分析', competencyType: '统计过程控制', engineer: 'Liu Yang' },
  { id: 18, moduleId: 5, moduleName: '数据分析', competencyType: 'Excel数据分析', engineer: 'Zhao Lin' },
  { id: 19, moduleId: 5, moduleName: '数据分析', competencyType: 'Power BI可视化', engineer: 'Sun Hui' },
  { id: 20, moduleId: 5, moduleName: '数据分析', competencyType: 'Python数据处理', engineer: 'Zhou Fang' },
  
  // 项目管理模块
  { id: 21, moduleId: 6, moduleName: '项目管理', competencyType: '项目计划编制', engineer: 'Wu Jing' },
  { id: 22, moduleId: 6, moduleName: '项目管理', competencyType: '资源协调管理', engineer: 'Xu Han' },
  { id: 23, moduleId: 6, moduleName: '项目管理', competencyType: '风险识别与应对', engineer: 'Zhang Wei' },
  { id: 24, moduleId: 6, moduleName: '项目管理', competencyType: '干系人沟通', engineer: 'Li Na' },
  
  // 团队协作模块
  { id: 25, moduleId: 7, moduleName: '团队协作', competencyType: '跨部门协作', engineer: 'Chen Ming' },
  { id: 26, moduleId: 7, moduleName: '团队协作', competencyType: '会议引导技术', engineer: 'Wang Pei' },
  { id: 27, moduleId: 7, moduleName: '团队协作', competencyType: '冲突管理', engineer: 'Liu Yang' },
  { id: 28, moduleId: 7, moduleName: '团队协作', competencyType: '团队建设活动', engineer: 'Zhao Lin' },
  { id: 29, moduleId: 7, moduleName: '团队协作', competencyType: '激励与反馈', engineer: 'Sun Hui' },
  
  // 问题解决模块
  { id: 30, moduleId: 8, moduleName: '问题解决', competencyType: '8D问题解决', engineer: 'Zhou Fang' },
  { id: 31, moduleId: 8, moduleName: '问题解决', competencyType: '5Why根因分析', engineer: 'Wu Jing' },
  { id: 32, moduleId: 8, moduleName: '问题解决', competencyType: '鱼骨图分析法', engineer: 'Xu Han' },
  { id: 33, moduleId: 8, moduleName: '问题解决', competencyType: 'FMEA应用', engineer: 'Zhang Wei' },
  { id: 34, moduleId: 8, moduleName: '问题解决', competencyType: '头脑风暴技术', engineer: 'Li Na' },
  
  // 持续改进模块
  { id: 35, moduleId: 9, moduleName: '持续改进', competencyType: 'Kaizen理念', engineer: 'Chen Ming' },
  { id: 36, moduleId: 9, moduleName: '持续改进', competencyType: '改善成果验证', engineer: 'Wang Pei' },
  { id: 37, moduleId: 9, moduleName: '持续改进', competencyType: '知识管理', engineer: 'Liu Yang' },
  { id: 38, moduleId: 9, moduleName: '持续改进', competencyType: '最佳实践复制', engineer: 'Zhao Lin' },
  { id: 39, moduleId: 9, moduleName: '持续改进', competencyType: '持续学习体系', engineer: 'Sun Hui' },
];

// 新增：能力评估数据（第二张表）
export const mockCompetencyAssessments: CompetencyAssessmentRecord[] = [
  // Zhang Wei的评估数据
  { id: 1, department: 'Quality Team', name: 'Zhang Wei', module: 'TPM基础', competencyType: 'TPM八大支柱', currentScore: 2, targetScore: 4, gap: 2, year: 2025 },
  { id: 2, department: 'Quality Team', name: 'Zhang Wei', module: 'TPM基础', competencyType: 'OEE计算与分析', currentScore: 3, targetScore: 4, gap: 1, year: 2025 },
  { id: 3, department: 'Quality Team', name: 'Zhang Wei', module: '精益流程', competencyType: '价值流分析', currentScore: 3, targetScore: 4, gap: 1, year: 2025 },
  { id: 4, department: 'Quality Team', name: 'Zhang Wei', module: '问题解决', competencyType: '8D问题解决', currentScore: 4, targetScore: 5, gap: 1, year: 2025 },
  { id: 5, department: 'Quality Team', name: 'Zhang Wei', module: '问题解决', competencyType: 'FMEA应用', currentScore: 3, targetScore: 5, gap: 2, year: 2025 },
  { id: 6, department: 'Quality Team', name: 'Zhang Wei', module: 'S-CIP改善', competencyType: 'PDCA循环实践', currentScore: 3, targetScore: 4, gap: 1, year: 2025 },
  { id: 7, department: 'Quality Team', name: 'Zhang Wei', module: '项目管理', competencyType: '风险识别与应对', currentScore: 2, targetScore: 4, gap: 2, year: 2025 },
  
  // Li Na的评估数据
  { id: 8, department: 'Process Engineering', name: 'Li Na', module: 'TPM基础', competencyType: 'OEE计算与分析', currentScore: 4, targetScore: 5, gap: 1, year: 2025 },
  { id: 9, department: 'Process Engineering', name: 'Li Na', module: '精益流程', competencyType: '价值流分析', currentScore: 4, targetScore: 5, gap: 1, year: 2025 },
  { id: 10, department: 'Process Engineering', name: 'Li Na', module: 'PGL标准化', competencyType: 'PGL标准制定', currentScore: 3, targetScore: 5, gap: 2, year: 2025 },
  { id: 11, department: 'Process Engineering', name: 'Li Na', module: '项目管理', competencyType: '项目计划编制', currentScore: 3, targetScore: 4, gap: 1, year: 2025 },
  { id: 12, department: 'Process Engineering', name: 'Li Na', module: '项目管理', competencyType: '干系人沟通', currentScore: 4, targetScore: 5, gap: 1, year: 2025 },
  { id: 13, department: 'Process Engineering', name: 'Li Na', module: '问题解决', competencyType: '头脑风暴技术', currentScore: 3, targetScore: 4, gap: 1, year: 2025 },
  
  // Chen Ming的评估数据
  { id: 14, department: 'TPM Center', name: 'Chen Ming', module: 'TPM基础', competencyType: '自主保全体系', currentScore: 2, targetScore: 4, gap: 2, year: 2025 },
  { id: 15, department: 'TPM Center', name: 'Chen Ming', module: 'TPM基础', competencyType: '计划保全方法', currentScore: 2, targetScore: 3, gap: 1, year: 2025 },
  { id: 16, department: 'TPM Center', name: 'Chen Ming', module: '数据分析', competencyType: '统计过程控制', currentScore: 3, targetScore: 5, gap: 2, year: 2025 },
  { id: 17, department: 'TPM Center', name: 'Chen Ming', module: 'PGL标准化', competencyType: '标准化作业', currentScore: 3, targetScore: 4, gap: 1, year: 2025 },
  { id: 18, department: 'TPM Center', name: 'Chen Ming', module: '团队协作', competencyType: '跨部门协作', currentScore: 2, targetScore: 4, gap: 2, year: 2025 },
  { id: 19, department: 'TPM Center', name: 'Chen Ming', module: '持续改进', competencyType: 'Kaizen理念', currentScore: 3, targetScore: 4, gap: 1, year: 2025 },
  
  // Wang Pei的评估数据
  { id: 20, department: 'Validation Lab', name: 'Wang Pei', module: 'TPM基础', competencyType: '设备故障分析', currentScore: 4, targetScore: 5, gap: 1, year: 2025 },
  { id: 21, department: 'Validation Lab', name: 'Wang Pei', module: 'PGL标准化', competencyType: '审核与评估', currentScore: 3, targetScore: 5, gap: 2, year: 2025 },
  { id: 22, department: 'Validation Lab', name: 'Wang Pei', module: '团队协作', competencyType: '会议引导技术', currentScore: 3, targetScore: 4, gap: 1, year: 2025 },
  { id: 23, department: 'Validation Lab', name: 'Wang Pei', module: '持续改进', competencyType: '改善成果验证', currentScore: 4, targetScore: 5, gap: 1, year: 2025 },
  
  // Liu Yang的评估数据
  { id: 24, department: 'Lean Office', name: 'Liu Yang', module: '精益流程', competencyType: '价值流分析', currentScore: 5, targetScore: 5, gap: 0, year: 2025 },
  { id: 25, department: 'Lean Office', name: 'Liu Yang', module: '精益流程', competencyType: '流程映射技术', currentScore: 4, targetScore: 5, gap: 1, year: 2025 },
  { id: 26, department: 'Lean Office', name: 'Liu Yang', module: '数据分析', competencyType: '统计过程控制', currentScore: 3, targetScore: 4, gap: 1, year: 2025 },
  { id: 27, department: 'Lean Office', name: 'Liu Yang', module: '团队协作', competencyType: '冲突管理', currentScore: 3, targetScore: 4, gap: 1, year: 2025 },
  { id: 28, department: 'Lean Office', name: 'Liu Yang', module: '持续改进', competencyType: '知识管理', currentScore: 3, targetScore: 5, gap: 2, year: 2025 },
];
