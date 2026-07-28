import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { TaskDetailModal } from '../TaskDetailModal';

const task = {
  id: 'task-1',
  task_name: 'Assigned task',
  task_type: 'coaching',
  task_location: 'FLCNa',
  employee_name: 'Engineer A',
  start_date: '2026-07-28',
  end_date: '2026-07-28',
  total_hours: 8,
  hours_per_day: 8,
  time_slot: 'FULL_DAY',
  status: 'confirmed',
};

describe('TaskDetailModal editing controls', () => {
  it('shows full edit and delete actions for an editable self-entered schedule', () => {
    render(
      <TaskDetailModal
        task={task}
        onClose={() => {}}
        onEdit={() => {}}
        onDelete={() => {}}
      />
    );

    expect(screen.getByText('编辑任务')).toBeInTheDocument();
    expect(screen.getByText('删除任务')).toBeInTheDocument();
    expect(screen.queryByLabelText('修改执行状态')).not.toBeInTheDocument();
  });

  it('shows only the execution status control for a task assigned by another user', async () => {
    const user = userEvent.setup();
    const onExecutionStatusChange = vi.fn();
    render(
      <TaskDetailModal
        task={task}
        onClose={() => {}}
        onExecutionStatusChange={onExecutionStatusChange}
      />
    );

    expect(screen.queryByText('编辑任务')).not.toBeInTheDocument();
    expect(screen.queryByText('删除任务')).not.toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText('修改执行状态'), 'completed');
    expect(onExecutionStatusChange).toHaveBeenCalledWith('completed');
  });
});
