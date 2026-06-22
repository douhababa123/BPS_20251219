import { describe, it, expect } from 'vitest';
import { TASK_TYPES, TASK_LOCATIONS, COMPETENCE_CONFIG, COMPETENCE_LIST, getCompetenceColorKey, getCompetenceConfig, getTaskTypeConfig } from '../taskTypeConfig';

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

  it('maps module names to the standard competence colors', () => {
    expect(getCompetenceColorKey('BPS elements')).toBe('BPS');
    expect(getCompetenceConfig('BPS elements').color).toBe('#92D050');
    expect(getCompetenceColorKey('Investment efficiency_PGL')).toBe('PGL');
    expect(getCompetenceConfig('Investment efficiency_PGL').color).toBe('#FF0000');
    expect(getCompetenceColorKey('Investment efficiency_IE')).toBe('IE');
    expect(getCompetenceConfig('Investment efficiency_IE').color).toBe('#FFC000');
    expect(getCompetenceColorKey('Waste-free&stable flow_TPM')).toBe('TPM');
    expect(getCompetenceConfig('Waste-free&stable flow_TPM').color).toBe('#C00000');
    expect(getCompetenceColorKey('Waste-free&stable flow_LBP')).toBe('LSC');
    expect(getCompetenceConfig('Waste-free&stable flow_LBP').color).toBe('#7030A0');
    expect(getCompetenceColorKey('CIP in indirect area_LEAN')).toBe('LEAN');
    expect(getCompetenceConfig('CIP in indirect area_LEAN').color).toBe('#00B0F0');
  });

  it('maps stored task competence values by their module prefix', () => {
    const cfg = getCompetenceConfig('BPS elements | VSM/VSD');
    expect(cfg.colorKey).toBe('BPS');
    expect(cfg.color).toBe('#92D050');
    expect(cfg.label).toBe('BPS elements | VSM/VSD');
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
