import { mockUsers, mockModules, mockItems, mockAssessments, mockSlots, mockCompetencyDefinitions, mockCompetencyAssessments } from './mockData';
import { TASK_TYPES, LOCATIONS, TOPICS, ROLE_THRESHOLDS } from './constants';
import type { MatchingRequest, MatchingCandidate, CompetencyDefinition, CompetencyAssessmentRecord } from './types';

export const mockApi = {
  getDictTaskTypes: async () => {
    await delay(100);
    return TASK_TYPES;
  },

  getDictLocations: async () => {
    await delay(100);
    return LOCATIONS;
  },

  getDictTopics: async () => {
    await delay(100);
    return TOPICS;
  },

  getUsers: async () => {
    await delay(150);
    return mockUsers;
  },

  getCompetencyModules: async () => {
    await delay(100);
    return mockModules;
  },

  getCompetencyItems: async () => {
    await delay(100);
    return mockItems;
  },

  getAssessments: async (year: number) => {
    await delay(200);
    return mockAssessments.filter(a => a.year === year);
  },

  getCalendarSlots: async (from: string, to: string) => {
    await delay(200);
    return mockSlots.filter(slot => {
      return slot.date >= from && slot.date <= to;
    });
  },

  previewMatching: async (request: MatchingRequest): Promise<MatchingCandidate[]> => {
    await delay(500);

    const candidates = mockUsers.map(user => {
      const userAssessments = mockAssessments.filter(a => a.userId === user.id);

      const skillItems = request.required.map(req => {
        const assessment = userAssessments.find(a => a.itemId === req.itemId);
        const Ci = assessment?.currentLevel || 0;
        const Ri = req.requiredLevel;
        const Ti = assessment?.targetLevel || 0;
        const isKey = req.isKey;

        const base = Math.min(Ci / Ri, 1);
        const bonus = Ti > Ci ? 0.1 : 0;
        const w = isKey ? 2 : 1;
        const si = (base + bonus) * w;

        return { itemId: req.itemId, Ci, Ri, Ti, isKey, base, bonus, w, si };
      });

      const sumW = skillItems.reduce((sum, item) => sum + item.w, 0);
      const skillScore = skillItems.reduce((sum, item) => sum + item.si, 0) / sumW;

      const startDate = new Date(request.startDate);
      const endDate = new Date(request.endDate);
      const totalSlots = countWorkSlots(startDate, endDate);
      const userSlots = mockSlots.filter(s =>
        s.userId === user.id &&
        s.date >= request.startDate &&
        s.date <= request.endDate
      ).length;
      const freeSlots = totalSlots - userSlots;
      const timeScore = totalSlots > 0 ? Math.max(Math.min(freeSlots / totalSlots, 1), 0) : 0;

      const finalScoreRaw = skillScore * 0.5 + timeScore * 0.5;
      const finalScore = Math.round(finalScoreRaw * 100) / 100;
      const qualified = finalScore >= 1;

      const roleGate = checkRoleGate(request.role, skillItems, userAssessments, request.required);

      const badges: string[] = [];
      if (request.suggestedUserId === user.id) {
        badges.push('suggested');
      }

      return {
        userId: user.id,
        name: user.name,
        dept: user.dept,
        homeLocation: user.homeLocation,
        skillScore: Math.round(skillScore * 100) / 100,
        timeScore: Math.round(timeScore * 100) / 100,
        finalScore,
        qualified,
        roleGate,
        badges,
        explain: {
          items: skillItems,
          sumW,
          skillScore: Math.round(skillScore * 100) / 100,
          time: {
            workSlots: userSlots,
            freeSlots,
            timeScore: Math.round(timeScore * 100) / 100,
          },
        },
      };
    });

    candidates.sort((a, b) => {
      if (a.badges.includes('suggested') && !b.badges.includes('suggested')) return -1;
      if (!a.badges.includes('suggested') && b.badges.includes('suggested')) return 1;
      if (a.qualified && !b.qualified) return -1;
      if (!a.qualified && b.qualified) return 1;
      return b.finalScore - a.finalScore;
    });

    return candidates;
  },

  assignTask: async () => {
    await delay(300);
    return { success: true, message: 'Task assigned successfully' };
  },

  createTask: async () => {
    await delay(300);
    return { success: true, id: Date.now() };
  },

  // 新增：能力定义相关API
  getCompetencyDefinitions: async (): Promise<CompetencyDefinition[]> => {
    await delay(150);
    return mockCompetencyDefinitions;
  },

  importCompetencyDefinitions: async (data: CompetencyDefinition[]) => {
    await delay(500);
    // 实际应用中这里会保存到数据库
    console.log('Importing competency definitions:', data);
    return { success: true, count: data.length };
  },

  // 新增：能力评估相关API  
  getCompetencyAssessments: async (year?: number): Promise<CompetencyAssessmentRecord[]> => {
    await delay(200);
    if (year) {
      return mockCompetencyAssessments.filter(a => a.year === year);
    }
    return mockCompetencyAssessments;
  },

  importCompetencyAssessments: async (data: CompetencyAssessmentRecord[]) => {
    await delay(500);
    // 自动计算差距值
    const processed = data.map(record => ({
      ...record,
      gap: record.targetScore - record.currentScore
    }));
    console.log('Importing competency assessments:', processed);
    return { success: true, count: processed.length };
  },

  getCompetencyStatistics: async () => {
    await delay(200);
    // 计算统计数据
    const totalRecords = mockCompetencyAssessments.length;
    const avgGap = mockCompetencyAssessments.reduce((sum, a) => sum + (a.gap || 0), 0) / totalRecords;
    const criticalItems = mockCompetencyAssessments.filter(a => (a.gap || 0) >= 2).length;
    
    return {
      totalRecords,
      averageGap: Math.round(avgGap * 10) / 10,
      criticalItems,
      moduleCount: new Set(mockCompetencyAssessments.map(a => a.module)).size,
      engineerCount: new Set(mockCompetencyAssessments.map(a => a.name)).size,
    };
  },
};

function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function countWorkSlots(start: Date, end: Date): number {
  let count = 0;
  const current = new Date(start);
  while (current <= end) {
    const day = current.getDay();
    if (day !== 0 && day !== 6) {
      count += 2;
    }
    current.setDate(current.getDate() + 1);
  }
  return count;
}

function checkRoleGate(
  role: string,
  skillItems: Array<{ itemId: number; Ci: number; isKey: boolean }>,
  allAssessments: Array<{ itemId: number; currentLevel: number }>,
  requiredItems: Array<{ itemId: number }>
): 'OK' | 'LEAD_LOW' | 'EXPERT_LOW' {
  if (role !== 'Lead' && role !== 'Expert') return 'OK';

  const keyItems = skillItems.filter(item => item.isKey);
  const keyItemMean = keyItems.length > 0
    ? keyItems.reduce((sum, item) => sum + item.Ci, 0) / keyItems.length
    : 0;

  const moduleItems = allAssessments.filter(a =>
    requiredItems.some(r => r.itemId === a.itemId)
  );
  const moduleMean = moduleItems.length > 0
    ? moduleItems.reduce((sum, item) => sum + item.currentLevel, 0) / moduleItems.length
    : 0;

  const threshold = ROLE_THRESHOLDS[role as keyof typeof ROLE_THRESHOLDS];

  if (keyItemMean >= threshold.keyItem && moduleMean >= threshold.moduleMean) {
    return 'OK';
  }

  return role === 'Lead' ? 'LEAD_LOW' : 'EXPERT_LOW';
}
