import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  getTimeSlotLabel,
  getTimeSlotColor,
  TimeSlotSelector,
} from '../TimeSlotSelector';

// ──────────────────────────────────────────────────────────
// 纯函数测试
// ──────────────────────────────────────────────────────────

describe('getTimeSlotLabel', () => {
  it('AM → 上午', () => {
    expect(getTimeSlotLabel('AM')).toBe('上午');
  });

  it('PM → 下午', () => {
    expect(getTimeSlotLabel('PM')).toBe('下午');
  });

  it('FULL_DAY → 全天', () => {
    expect(getTimeSlotLabel('FULL_DAY')).toBe('全天');
  });
});

describe('getTimeSlotColor', () => {
  it('AM 包含 amber 颜色类', () => {
    expect(getTimeSlotColor('AM')).toContain('amber');
  });

  it('PM 包含 orange 颜色类', () => {
    expect(getTimeSlotColor('PM')).toContain('orange');
  });

  it('FULL_DAY 包含 blue 颜色类', () => {
    expect(getTimeSlotColor('FULL_DAY')).toContain('blue');
  });
});

// ──────────────────────────────────────────────────────────
// 组件测试
// ──────────────────────────────────────────────────────────

describe('TimeSlotSelector 组件', () => {
  it('渲染三个选项按钮', () => {
    render(
      <TimeSlotSelector
        value="AM"
        onChange={() => {}}
      />
    );
    expect(screen.getByText('上午')).toBeInTheDocument();
    expect(screen.getByText('下午')).toBeInTheDocument();
    expect(screen.getByText('全天')).toBeInTheDocument();
  });

  it('点击 PM 按钮时触发 onChange', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(<TimeSlotSelector value="AM" onChange={onChange} />);

    await user.click(screen.getByText('下午').closest('button')!);
    expect(onChange).toHaveBeenCalledWith('PM');
  });

  it('disabled 时点击不触发 onChange', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(<TimeSlotSelector value="AM" onChange={onChange} disabled />);

    await user.click(screen.getByText('下午').closest('button')!);
    expect(onChange).not.toHaveBeenCalled();
  });
});
