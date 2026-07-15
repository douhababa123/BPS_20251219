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
  it('renders full-day, AM, and PM tasks in full-width vertical order', () => {
    render(
      <CalendarDayTasks
        tasks={tasks}
        date="2026-07-14"
        segments={buildContinuousTaskSegments(tasks)}
        continuousHeights={{}}
        onContinuousHeightChange={vi.fn()}
      />
    );

    const root = screen.getByTestId('calendar-day-tasks');
    expect(root).toHaveClass('flex', 'flex-col');
    expect(root).not.toHaveClass('grid-cols-2');
    expect(screen.getAllByTestId(/calendar-task-/).map((element) => element.dataset.calendarSection))
      .toEqual(['full', 'am', 'pm']);
    expect(screen.getAllByTestId(/calendar-task-/).every((element) => element.classList.contains('w-full')))
      .toBe(true);
  });

  it('passes a connected group height to its fragment', () => {
    const connectedTask = { ...tasks[2], id: 'connected', task_name: 'Connected task' };
    const segments = new Map([
      ['connected|2026-07-14', {
        position: 'middle' as const,
        continuousHours: 32,
        showLabel: false,
        groupId: 'group-a',
      }],
    ]);
    render(
      <CalendarDayTasks
        tasks={[connectedTask]}
        date="2026-07-14"
        segments={segments}
        continuousHeights={{ 'group-a': 84 }}
        onContinuousHeightChange={vi.fn()}
      />
    );

    expect(screen.getByTitle(/Connected task/)).toHaveStyle({ height: '84px' });
  });

  it('keeps task click and tooltip behavior', () => {
    const onTaskClick = vi.fn();
    render(
      <CalendarDayTasks
        tasks={tasks.slice(0, 2)}
        date="2026-07-14"
        segments={buildContinuousTaskSegments(tasks.slice(0, 2))}
        continuousHeights={{}}
        onContinuousHeightChange={vi.fn()}
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
