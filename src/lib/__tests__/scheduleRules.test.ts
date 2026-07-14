import { describe, expect, it } from 'vitest';
import {
  applyTaskTypeChange,
  buildCalendarTaskLayout,
  buildCompetenceHourStats,
  buildContinuousTaskSegments,
  getTaskLocationOptions,
  normalizeOptionalStatus,
  sortCalendarTasks,
  sortHourStats,
  type ContinuousTaskSegmentMeta,
  type ScheduleTaskForContinuity,
} from '../scheduleRules';

describe('schedule chart and form rules', () => {
  it('aggregates competence hours and returns the largest area first', () => {
    expect(buildCompetenceHourStats([
      { competence: 'TPM', total_hours: 3 },
      { competence: 'BPS', total_hours: 8 },
      { competence: 'TPM', total_hours: 7 },
    ]).map(({ name, value }) => ({ name, value }))).toEqual([
      { name: 'TPM', value: 10 },
      { name: 'BPS', value: 8 },
    ]);
  });

  it('sorts hour statistics descending with a stable name tie-break', () => {
    expect(sortHourStats([
      { name: 'Beta', value: 4, color: '#222222' },
      { name: 'Gamma', value: 9, color: '#333333' },
      { name: 'Alpha', value: 4, color: '#111111' },
    ])).toEqual([
      { name: 'Gamma', value: 9, color: '#333333' },
      { name: 'Alpha', value: 4, color: '#111111' },
      { name: 'Beta', value: 4, color: '#222222' },
    ]);
  });

  it('offers Supplier instead of GPU-SU for a new task', () => {
    const options = getTaskLocationOptions();
    expect(options).toContain('Supplier');
    expect(options).not.toContain('GPU-SU');
  });

  it('preserves GPU-SU while editing a legacy task', () => {
    expect(getTaskLocationOptions('GPU-SU')).toContain('GPU-SU');
  });

  it('normalizes Leave fields and clears irrelevant input', () => {
    expect(applyTaskTypeChange({
      task_name: 'Old',
      task_type: 'WS',
      task_location: 'Supplier',
      competence: 'Module | Item',
      competence_module: 'Module',
      competence_type: 'Item',
      assigned_employee_id: 'e1',
      status: 'completed',
      notes: 'note',
    }, 'Leave')).toEqual({
      task_name: 'Leave',
      task_type: 'Leave',
      task_location: 'out of office',
      competence: '',
      competence_module: '',
      competence_type: '',
      assigned_employee_id: '',
      status: '',
      notes: '',
    });
  });

  it('recognizes the backend Leave code L', () => {
    expect(applyTaskTypeChange({
      task_name: 'Old',
      task_type: 'WS',
      task_location: 'Supplier',
      competence: 'Module | Item',
      competence_module: 'Module',
      competence_type: 'Item',
      assigned_employee_id: 'e1',
      status: 'completed',
      notes: 'note',
    }, 'L')).toMatchObject({
      task_name: 'Leave',
      task_type: 'L',
      task_location: 'out of office',
      status: '',
    });
  });

  it('recognizes Leave codes without depending on API casing', () => {
    expect(applyTaskTypeChange({
      task_name: 'Old',
      task_type: 'WS',
      task_location: 'Supplier',
      competence: '',
      competence_module: '',
      competence_type: '',
      assigned_employee_id: '',
      status: '',
      notes: '',
    }, 'LEAVE')).toMatchObject({
      task_name: 'Leave',
      task_type: 'LEAVE',
      task_location: 'out of office',
    });
  });

  it('clears generated Leave values when switching to another type', () => {
    expect(applyTaskTypeChange({
      task_name: 'Leave',
      task_type: 'Leave',
      task_location: 'out of office',
      competence: '',
      competence_module: '',
      competence_type: '',
      assigned_employee_id: '',
      status: '',
      notes: '',
    }, 'WS')).toMatchObject({ task_name: '', task_type: 'WS', task_location: '' });
  });

  it('defaults an empty optional status to planned', () => {
    expect(normalizeOptionalStatus('')).toBe('planned');
    expect(normalizeOptionalStatus('completed')).toBe('completed');
  });
});

const task = (overrides: Partial<ScheduleTaskForContinuity>): ScheduleTaskForContinuity => ({
  id: 'task-1',
  assigned_employee_id: 'employee-1',
  task_name: 'Task A',
  task_type: 'WS',
  start_date: '2026-07-01',
  end_date: '2026-07-01',
  time_slot: 'FULL_DAY',
  ...overrides,
});

describe('continuous task segment rules', () => {
  it('pairs AM and PM in one lane and gives FULL_DAY an exclusive full-width lane', () => {
    const am = task({ id: '1-am', time_slot: 'AM' });
    const pm = task({ id: '2-pm', time_slot: 'PM' });
    const full = task({ id: '3-full', task_name: 'Full', time_slot: 'FULL_DAY' });
    const segments = buildContinuousTaskSegments([am, pm, full]);

    expect(buildCalendarTaskLayout([am, pm, full], '2026-07-01', segments)).toEqual([
      { task: am, row: 0, column: 'am' },
      { task: pm, row: 0, column: 'pm' },
      { task: full, row: 1, column: 'full' },
    ]);
  });

  it('stacks tasks in the same half on separate lanes', () => {
    const first = task({ id: 'am-1', task_name: 'A', time_slot: 'AM' });
    const second = task({ id: 'am-2', task_name: 'B', time_slot: 'AM' });
    const segments = buildContinuousTaskSegments([first, second]);

    expect(buildCalendarTaskLayout([first, second], '2026-07-01', segments)
      .map(({ row, column }) => ({ row, column }))).toEqual([
      { row: 0, column: 'am' },
      { row: 1, column: 'am' },
    ]);
  });

  it('excludes fragments marked hidden by the continuous segment map', () => {
    const visible = task({ id: 'visible', time_slot: 'AM' });
    const hidden = task({ id: 'hidden', time_slot: 'PM' });
    const segments = new Map([
      ['visible|2026-07-01', { position: 'start', continuousHours: 11.5, showLabel: true, groupId: 'group' }],
      ['hidden|2026-07-01', { position: 'start', continuousHours: 11.5, showLabel: false, groupId: 'group', hidden: true }],
    ] satisfies Array<[string, ContinuousTaskSegmentMeta]>);

    expect(buildCalendarTaskLayout([visible, hidden], '2026-07-01', segments)
      .map(({ task: layoutTask }) => layoutTask.id)).toEqual(['visible']);
  });

  it('keeps a connected group on row zero across dates with different daily tasks', () => {
    const connected = task({
      id: 'connected',
      start_date: '2026-07-01',
      end_date: '2026-07-02',
      time_slot: 'FULL_DAY',
    });
    const firstDaily = task({
      id: 'first-daily',
      task_name: 'First daily',
      start_date: '2026-07-01',
      end_date: '2026-07-01',
    });
    const secondDaily = task({
      id: 'second-daily',
      task_name: 'Second daily',
      start_date: '2026-07-02',
      end_date: '2026-07-02',
    });
    const segments = buildContinuousTaskSegments([connected, firstDaily, secondDaily]);

    const firstRow = buildCalendarTaskLayout([firstDaily, connected], '2026-07-01', segments)
      .find(({ task: layoutTask }) => layoutTask.id === 'connected')?.row;
    const secondRow = buildCalendarTaskLayout([secondDaily, connected], '2026-07-02', segments)
      .find(({ task: layoutTask }) => layoutTask.id === 'connected')?.row;

    expect([firstRow, secondRow]).toEqual([0, 0]);
  });

  it('connects a full day to the next morning as 11.5 hours', () => {
    const result = buildContinuousTaskSegments([
      task({ id: 'full', time_slot: 'FULL_DAY' }),
      task({ id: 'morning', start_date: '2026-07-02', end_date: '2026-07-02', time_slot: 'AM' }),
    ]);

    expect(result.get('full|2026-07-01')).toMatchObject({ position: 'start', continuousHours: 11.5, showLabel: true });
    expect(result.get('morning|2026-07-02')).toMatchObject({ position: 'end', continuousHours: 11.5, showLabel: false });
  });

  it('connects afternoon to the next morning', () => {
    const result = buildContinuousTaskSegments([
      task({ id: 'pm', time_slot: 'PM' }),
      task({ id: 'am', start_date: '2026-07-02', end_date: '2026-07-02', time_slot: 'AM' }),
      task({ id: 'pm2', start_date: '2026-07-02', end_date: '2026-07-02', time_slot: 'PM' }),
    ]);
    expect(result.get('pm|2026-07-01')?.continuousHours).toBe(12.5);
    expect(result.get('pm2|2026-07-02')?.position).toBe('end');
  });

  it('connects a multi-day full-day task into start and end date fragments', () => {
    const result = buildContinuousTaskSegments([
      task({ id: 'multi', start_date: '2026-07-01', end_date: '2026-07-03', time_slot: 'FULL_DAY' }),
    ]);
    expect(result.get('multi|2026-07-01')).toMatchObject({ position: 'start', continuousHours: 24 });
    expect(result.get('multi|2026-07-02')).toMatchObject({ position: 'middle', showLabel: false });
    expect(result.get('multi|2026-07-03')).toMatchObject({ position: 'end', showLabel: false });
  });

  it('keeps a continuous task ahead of unrelated daily tasks on every date', () => {
    const multi = task({ id: 'multi', start_date: '2026-07-21', end_date: '2026-07-24' });
    const daily = task({ id: 'daily', task_name: 'Daily task', start_date: '2026-07-22', end_date: '2026-07-22' });
    const segments = buildContinuousTaskSegments([multi, daily]);

    expect(sortCalendarTasks([daily, multi], '2026-07-22', segments).map(({ id }) => id)).toEqual([
      'multi',
      'daily',
    ]);
  });

  it('does not connect a full day to next-day afternoon across the morning gap', () => {
    const result = buildContinuousTaskSegments([
      task({ id: 'full', time_slot: 'FULL_DAY' }),
      task({ id: 'pm', start_date: '2026-07-02', end_date: '2026-07-02', time_slot: 'PM' }),
    ]);
    expect(result.get('full|2026-07-01')?.position).toBe('single');
    expect(result.get('pm|2026-07-02')?.position).toBe('single');
  });

  it('does not connect morning-only work to the next day', () => {
    const result = buildContinuousTaskSegments([
      task({ id: 'am1', time_slot: 'AM' }),
      task({ id: 'am2', start_date: '2026-07-02', end_date: '2026-07-02', time_slot: 'AM' }),
    ]);
    expect(result.get('am1|2026-07-01')?.position).toBe('single');
    expect(result.get('am2|2026-07-02')?.position).toBe('single');
  });

  it.each([
    { assigned_employee_id: 'employee-2' },
    { task_name: 'Task B' },
    { task_type: 'P' },
  ])('does not connect when identity differs: %o', (identityOverride) => {
    const result = buildContinuousTaskSegments([
      task({ id: 'full', time_slot: 'FULL_DAY' }),
      task({ id: 'am', start_date: '2026-07-02', end_date: '2026-07-02', time_slot: 'AM', ...identityOverride }),
    ]);
    expect(result.get('full|2026-07-01')?.position).toBe('single');
    expect(result.get('am|2026-07-02')?.position).toBe('single');
  });

  it('keeps an exactly eight-hour segment ordinary', () => {
    const result = buildContinuousTaskSegments([task({ id: 'full' })]);
    expect(result.get('full|2026-07-01')).toMatchObject({ position: 'single', continuousHours: 8, showLabel: true });
  });
});
