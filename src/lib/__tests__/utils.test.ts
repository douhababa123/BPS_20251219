import { describe, it, expect } from 'vitest';
import { cn } from '../utils';

describe('cn (className合并工具)', () => {
  it('合并多个 class 字符串', () => {
    expect(cn('foo', 'bar')).toBe('foo bar');
  });

  it('过滤 falsy 值', () => {
    expect(cn('foo', false, undefined, null, 'bar')).toBe('foo bar');
  });

  it('处理条件 class', () => {
    expect(cn('base', { active: true, disabled: false })).toBe('base active');
  });

  it('Tailwind 冲突时保留后者', () => {
    // twMerge 应保留后面的 p-4，而不是 p-2
    expect(cn('p-2', 'p-4')).toBe('p-4');
  });

  it('无参数时返回空字符串', () => {
    expect(cn()).toBe('');
  });

  it('处理数组参数', () => {
    expect(cn(['foo', 'bar'], 'baz')).toBe('foo bar baz');
  });
});
