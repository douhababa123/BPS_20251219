import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TaskCard, TaskCardCompact } from '../TaskCard';

// 基础任务 fixture
const baseTask = {
  id: 'task-1',
  task_name: '测试任务',
  task_type: 'training',
};

describe('TaskCard 组件', () => {
  it('渲染任务名称', () => {
    render(<TaskCard task={baseTask} />);
    expect(screen.getByText('测试任务')).toBeInTheDocument();
  });

  it('渲染任务类型', () => {
    render(<TaskCard task={baseTask} />);
    expect(screen.getByText('training')).toBeInTheDocument();
  });

  it('默认状态显示"计划中"标签', () => {
    render(<TaskCard task={baseTask} />);
    expect(screen.getByText(/计划中/)).toBeInTheDocument();
  });

  it('status=completed 显示"已完成"标签', () => {
    render(<TaskCard task={{ ...baseTask, status: 'completed' }} />);
    expect(screen.getByText(/已完成/)).toBeInTheDocument();
  });

  it('status=in_progress 显示"进行中"标签', () => {
    render(<TaskCard task={{ ...baseTask, status: 'in_progress' }} />);
    expect(screen.getByText(/进行中/)).toBeInTheDocument();
  });

  it('status=cancelled 显示"已取消"标签', () => {
    render(<TaskCard task={{ ...baseTask, status: 'cancelled' }} />);
    expect(screen.getByText(/已取消/)).toBeInTheDocument();
  });

  it('默认时间槽 FULL_DAY 显示"全天"', () => {
    render(<TaskCard task={baseTask} />);
    expect(screen.getByText('全天')).toBeInTheDocument();
  });

  it('time_slot=AM 显示"上午"', () => {
    render(<TaskCard task={{ ...baseTask, time_slot: 'AM' }} />);
    expect(screen.getByText('上午')).toBeInTheDocument();
  });

  it('time_slot=PM 显示"下午"', () => {
    render(<TaskCard task={{ ...baseTask, time_slot: 'PM' }} />);
    expect(screen.getByText('下午')).toBeInTheDocument();
  });

  it('total_hours 有值时显示工时', () => {
    render(<TaskCard task={{ ...baseTask, total_hours: 8 }} />);
    expect(screen.getByText('8h')).toBeInTheDocument();
  });

  it('total_hours 未设置时不显示工时', () => {
    render(<TaskCard task={baseTask} />);
    expect(screen.queryByText(/h$/)).not.toBeInTheDocument();
  });

  it('showEmployee=true 且 employee_name 存在时显示员工名', () => {
    render(
      <TaskCard
        task={{ ...baseTask, employee_name: '张三' }}
        showEmployee
      />
    );
    expect(screen.getByText(/张三/)).toBeInTheDocument();
  });

  it('showEmployee=false 时不显示员工名', () => {
    render(
      <TaskCard
        task={{ ...baseTask, employee_name: '张三' }}
        showEmployee={false}
      />
    );
    expect(screen.queryByText(/张三/)).not.toBeInTheDocument();
  });

  it('点击触发 onClick 回调', () => {
    const onClick = vi.fn();
    render(<TaskCard task={baseTask} onClick={onClick} />);
    fireEvent.click(screen.getByText('测试任务').closest('div')!);
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});

describe('TaskCardCompact 组件', () => {
  it('渲染任务名称', () => {
    render(<TaskCardCompact task={baseTask} />);
    expect(screen.getByText('测试任务')).toBeInTheDocument();
  });

  it('渲染任务类型首字母', () => {
    render(<TaskCardCompact task={baseTask} />);
    expect(screen.getByText('t')).toBeInTheDocument();
  });

  it('按能力域应用统一颜色', () => {
    const { container } = render(
      <TaskCardCompact task={{ ...baseTask, competence: 'BPS elements | VSM/VSD' }} />
    );
    const card = container.firstElementChild as HTMLElement;
    expect(card).toHaveStyle({ color: '#92D050' });
  });

  it('点击触发 onClick 回调', () => {
    const onClick = vi.fn();
    render(<TaskCardCompact task={baseTask} onClick={onClick} />);
    fireEvent.click(screen.getByText('测试任务').closest('div')!);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('全天任务不显示时间槽图标', () => {
    render(<TaskCardCompact task={{ ...baseTask, time_slot: 'FULL_DAY' }} />);
    expect(screen.queryByText('🌅')).not.toBeInTheDocument();
    expect(screen.queryByText('🌆')).not.toBeInTheDocument();
  });

  it('AM 任务显示 🌅 图标', () => {
    render(<TaskCardCompact task={{ ...baseTask, time_slot: 'AM' }} />);
    expect(screen.getByText('🌅')).toBeInTheDocument();
  });

  it('PM 任务显示 🌆 图标', () => {
    render(<TaskCardCompact task={{ ...baseTask, time_slot: 'PM' }} />);
    expect(screen.getByText('🌆')).toBeInTheDocument();
  });
});
