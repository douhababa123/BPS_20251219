import { describe, it, expect } from 'vitest';
import { TASK_TYPES, TASK_LOCATIONS, COMPETENCE_CONFIG, COMPETENCE_LIST, getCompetenceConfig, getTaskTypeConfig } from '../taskTypeConfig';

describe('TASK_TYPES', () => {
  it('contains expected task type codes', () => {
    const codes = TASK_TYPES.map((t) => t.code);
    expect(codes).toContain('Project');
    expect(codes).toContain('Coaching');
    expect(codes).toContain('Training');
    expect(codes).toContain('Meeting');
    expect(codes).toContain('Leave');
  });
});

describe('TASK_LOCATIONS', () => {
  it('contains expected locations', () => {
    expect(TASK_LOCATIONS).toContain('FLCNa');
    expect(TASK_LOCATIONS).toContain('Nan Jing');
  });
});

describe('COMPETENCE_CONFIG', () => {
  it('contains all expected competences', () => {
    expect(COMPETENCE_CONFIG['TPM']).toBeDefined();
    expect(COMPETENCE_CONFIG['BPS']).toBeDefined();
    expect(COMPETENCE_CONFIG['Others']).toBeDefined();
  });

  it('each entry has color and label', () => {
    Object.values(COMPETENCE_CONFIG).forEach((c) => {
      expect(c).toHaveProperty('color');
      expect(c).toHaveProperty('label');
    });
  });
});

describe('COMPETENCE_LIST', () => {
  it('matches keys of COMPETENCE_CONFIG', () => {
    expect(COMPETENCE_LIST).toEqual(Object.keys(COMPETENCE_CONFIG));
  });
});

describe('getCompetenceConfig', () => {
  it('returns correct color for known competence', () => {
    const cfg = getCompetenceConfig('TPM');
    expect(cfg.color).toBe('#C00000');
    expect(cfg.label).toBe('TPM');
  });

  it('returns gray for null/undefined', () => {
    expect(getCompetenceConfig(null).color).toBe('#808080');
    expect(getCompetenceConfig(undefined).color).toBe('#808080');
  });

  it('returns gray for unknown competence', () => {
    const cfg = getCompetenceConfig('UnknownXYZ');
    expect(cfg.color).toBe('#808080');
  });
});

describe('getTaskTypeConfig', () => {
  it('returns a config object for any string', () => {
    const config = getTaskTypeConfig('Project');
    expect(config).toHaveProperty('label');
    expect(config).toHaveProperty('color');
  });

  it('does not throw for empty or unknown types', () => {
    expect(() => getTaskTypeConfig('')).not.toThrow();
    expect(() => getTaskTypeConfig('unknown_type')).not.toThrow();
  });
});
