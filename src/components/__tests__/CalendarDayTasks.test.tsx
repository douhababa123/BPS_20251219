import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CalendarDayTasks } from '../CalendarDayTasks';
import { buildContinuousTaskSegments } from '../../lib/scheduleRules';

const tasks = [
  {
    id: '1-am',
    task_name: 'Morning task',
    task_type: 'coaching',
    start_date: '2026-07-14',
    end_date: '2026-07-14',
    time_slot: 'AM' as const,
  },
  {
    id: '2-pm',
    task_name: 'Afternoon task',
    task_type: 'training',
    start_date: '2026-07-14',
    end_date: '2026-07-14',
    time_slot: 'PM' as const,
  },
  {
    id: '3-full',
    task_name: 'Full-day task',
    task_type: 'project',
    start_date: '2026-07-14',
    end_date: '2026-07-14',
    time_slot: 'FULL_DAY' as const,
  },
];

describe('CalendarDayTasks', () => {
  it('positions AM and PM in invisible halves and lets full-day tasks span both halves', () => {
    render(
      <CalendarDayTasks
        tasks={tasks}
        date="2026-07-14"
        segments={buildContinuousTaskSegments(tasks)}
      />
    );

    const grid = screen.getByTestId('calendar-day-tasks');
    expect(grid).toHaveClass('grid', 'grid-cols-2');
    expect(grid.className).not.toMatch(/border|divide|bg-/);

    expect(screen.getByTestId('calendar-task-1-am')).toHaveStyle({
      gridRow: '1',
      gridColumn: '1 / 2',
    });
    expect(screen.getByTestId('calendar-task-2-pm')).toHaveStyle({
      gridRow: '1',
      gridColumn: '2 / 3',
    });
    expect(screen.getByTestId('calendar-task-3-full')).toHaveStyle({
      gridRow: '2',
      gridColumn: '1 / 3',
    });
  });

  it('keeps task click and tooltip behavior', () => {
    const onTaskClick = vi.fn();
    render(
      <CalendarDayTasks
        tasks={tasks.slice(0, 2)}
        date="2026-07-14"
        segments={buildContinuousTaskSegments(tasks.slice(0, 2))}
        onTaskClick={onTaskClick}
      />
    );

    const morningCard = screen.getByText('Morning task').closest('[title]');
    const afternoonCard = screen.getByText('Afternoon task').closest('[title]');
    expect(morningCard).toHaveAttribute('title', expect.stringContaining('Morning task'));
    expect(afternoonCard).toHaveAttribute('title', expect.stringContaining('Afternoon task'));

    fireEvent.click(morningCard!);
    fireEvent.click(afternoonCard!);
    expect(onTaskClick).toHaveBeenNthCalledWith(1, tasks[0]);
    expect(onTaskClick).toHaveBeenNthCalledWith(2, tasks[1]);
  });
});
