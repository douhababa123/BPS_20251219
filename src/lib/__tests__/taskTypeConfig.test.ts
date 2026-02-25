import { describe, it, expect } from 'vitest';
import { TASK_TYPE_CONFIG, getTaskTypeConfig } from '../taskTypeConfig';

describe('TASK_TYPE_CONFIG 常量', () => {
  const expectedTypes = [
    'coaching',
    'leave',
    'meeting',
    'project',
    'self-develop',
    'speed_week',
    'training',
    'workshop',
  ];

  it('包含所有预定义任务类型', () => {
    expectedTypes.forEach((type) => {
      expect(TASK_TYPE_CONFIG[type]).toBeDefined();
    });
  });

  it('每个类型都有 color / bgColor / borderColor / icon / label 字段', () => {
    Object.values(TASK_TYPE_CONFIG).forEach((config) => {
      expect(config).toHaveProperty('color');
      expect(config).toHaveProperty('bgColor');
      expect(config).toHaveProperty('borderColor');
      expect(config).toHaveProperty('icon');
      expect(config).toHaveProperty('label');
    });
  });
});

describe('getTaskTypeConfig', () => {
  it('精确匹配已知类型', () => {
    const config = getTaskTypeConfig('coaching');
    expect(config.label).toBe('Coaching');
    expect(config.icon).toBe('👨‍🏫');
  });

  it('大写输入时仍能匹配（转小写）', () => {
    const config = getTaskTypeConfig('TRAINING');
    expect(config.label).toBe('Training');
  });

  it('带空格的输入规范化后能匹配', () => {
    // "speed week" → "speed_week"
    const config = getTaskTypeConfig('speed week');
    expect(config.label).toBe('Speed week');
  });

  it('未知类型返回默认配置', () => {
    const config = getTaskTypeConfig('unknown_type');
    expect(config.color).toBe('text-gray-700');
    expect(config.bgColor).toBe('bg-gray-100');
  });

  it('空字符串返回默认配置且 label 为 Unknown', () => {
    const config = getTaskTypeConfig('');
    expect(config.label).toBe('Unknown');
  });

  it('null/undefined 不抛出异常', () => {
    // getTaskTypeConfig 内部有 ?. 处理
    expect(() => getTaskTypeConfig(null as unknown as string)).not.toThrow();
    expect(() => getTaskTypeConfig(undefined as unknown as string)).not.toThrow();
  });
});
