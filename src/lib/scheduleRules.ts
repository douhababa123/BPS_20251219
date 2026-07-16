import { TASK_LOCATIONS, getCompetenceConfig } from './taskTypeConfig';

export interface HourStat {
  name: string;
  value: number;
  color?: string;
}

export function sortHourStats<T extends HourStat>(stats: T[]): T[] {
  return [...stats].sort((left, right) =>
    right.value - left.value || left.name.localeCompare(right.name, 'en')
  );
}

export function buildCompetenceHourStats(
  tasks: Array<{ competence?: string | null; total_hours?: number | null }>
): Array<Required<HourStat>> {
  const stats = new Map<string, Required<HourStat>>();
  tasks.forEach((task) => {
    const key = task.competence || 'Others';
    const config = getCompetenceConfig(key);
    const current = stats.get(key) || { name: config.label, value: 0, color: config.color };
    current.value += Number(task.total_hours) || 0;
    stats.set(key, current);
  });
  return sortHourStats(Array.from(stats.values()));
}

export function getTaskLocationOptions(currentLocation = ''): string[] {
  const options = [...TASK_LOCATIONS];
  if (currentLocation && !options.includes(currentLocation)) {
    return [currentLocation, ...options];
  }
  return options;
}

export interface TaskFormRuleFields {
  task_name: string;
  task_type: string;
  task_location: string;
  competence: string;
  competence_module: string;
  competence_type: string;
  assigned_employee_id: string;
  status: string;
  notes: string;
}

export function isLeaveTaskType(taskType: string | null | undefined): boolean {
  const normalizedTaskType = taskType?.trim().toLowerCase();
  return normalizedTaskType === 'leave' || normalizedTaskType === 'l';
}

export function applyTaskTypeChange<T extends TaskFormRuleFields>(form: T, taskType: string): T {
  if (isLeaveTaskType(taskType)) {
    return {
      ...form,
      task_name: 'Leave',
      task_type: taskType,
      task_location: 'out of office',
      competence: '',
      competence_module: '',
      competence_type: '',
      status: '',
      notes: '',
    };
  }

  const leavingLeaveMode = isLeaveTaskType(form.task_type);
  return {
    ...form,
    task_type: taskType,
    task_name: leavingLeaveMode && form.task_name === 'Leave' ? '' : form.task_name,
    task_location: leavingLeaveMode && form.task_location === 'out of office' ? '' : form.task_location,
  };
}

export function normalizeOptionalStatus(status: string | null | undefined): string {
  return status || 'planned';
}

export function isTaskAwaitingCurrentUserConfirmation(
  task: {
    status?: string | null;
    requester_id?: string | null;
    assigned_employee_email?: string | null;
  },
  user: { id?: string | null; email?: string | null } | null | undefined
): boolean {
  const requesterId = task.requester_id?.toLowerCase();
  const userId = user?.id?.toLowerCase();
  return task.status === 'planned'
    && !!requesterId
    && requesterId !== userId
    && task.assigned_employee_email?.toLowerCase() === user?.email?.toLowerCase();
}

export type ScheduleTimeSlot = 'AM' | 'PM' | 'FULL_DAY';

export interface ScheduleTaskForContinuity {
  id: string;
  assigned_employee_id?: string | null;
  task_name: string;
  task_type: string;
  start_date: string;
  end_date: string;
  time_slot?: ScheduleTimeSlot | null;
}

export interface ContinuousTaskSegmentMeta {
  position: 'single' | 'start' | 'middle' | 'end';
  continuousHours: number;
  showLabel: boolean;
  groupId: string;
  hidden?: boolean;
}

export function sortCalendarTasks<T extends { id: string; start_date?: string; task_name?: string }>(
  tasks: T[],
  date: string,
  segments: Map<string, ContinuousTaskSegmentMeta>
): T[] {
  return [...tasks].sort((left, right) => {
    const leftSegment = segments.get(`${left.id}|${date}`);
    const rightSegment = segments.get(`${right.id}|${date}`);
    const leftContinuous = leftSegment && leftSegment.position !== 'single' ? 0 : 1;
    const rightContinuous = rightSegment && rightSegment.position !== 'single' ? 0 : 1;

    return leftContinuous - rightContinuous
      || (leftSegment?.groupId || left.id).localeCompare(rightSegment?.groupId || right.id)
      || (left.start_date || '').localeCompare(right.start_date || '')
      || (left.task_name || '').localeCompare(right.task_name || '')
      || left.id.localeCompare(right.id);
  });
}

export type CalendarTaskSection = 'connected' | 'full' | 'am' | 'pm';

export interface CalendarTaskLayout<T> {
  task: T;
  row: number;
  section: CalendarTaskSection;
}

export function buildCalendarTaskLayout<T extends ScheduleTaskForContinuity>(
  tasks: T[],
  date: string,
  segments: Map<string, ContinuousTaskSegmentMeta>
): CalendarTaskLayout<T>[] {
  const sectionRank: Record<CalendarTaskSection, number> = {
    connected: 0,
    full: 1,
    am: 2,
    pm: 3,
  };

  return sortCalendarTasks(tasks, date, segments)
    .filter((task) => !segments.get(`${task.id}|${date}`)?.hidden)
    .map((task) => {
      const segment = segments.get(`${task.id}|${date}`);
      const timeSlot = task.time_slot || 'FULL_DAY';
      const section: CalendarTaskSection = segment && segment.position !== 'single'
        ? 'connected'
        : timeSlot === 'FULL_DAY'
          ? 'full'
          : timeSlot === 'AM'
            ? 'am'
            : 'pm';
      return { task, section };
    })
    .sort((left, right) =>
      sectionRank[left.section] - sectionRank[right.section]
      || left.task.id.localeCompare(right.task.id)
    )
    .map((item, row) => ({ ...item, row }));
}

interface ExpandedSlot {
  task: ScheduleTaskForContinuity;
  date: string;
  half: 'AM' | 'PM';
  sequence: number;
  hours: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;

function parseDateOnly(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value || '');
  if (!match) return null;
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function datesBetween(startValue: string, endValue: string): string[] {
  const start = parseDateOnly(startValue);
  const end = parseDateOnly(endValue);
  if (!start || !end || end < start) return [];
  const dates: string[] = [];
  for (let time = start.getTime(); time <= end.getTime(); time += DAY_MS) {
    dates.push(formatDateOnly(new Date(time)));
  }
  return dates;
}

function expandTask(task: ScheduleTaskForContinuity): ExpandedSlot[] {
  const slot = task.time_slot || 'FULL_DAY';
  const halves = slot === 'FULL_DAY' ? ['AM', 'PM'] as const : [slot] as Array<'AM' | 'PM'>;
  return datesBetween(task.start_date, task.end_date).flatMap((date) => {
    const day = Math.floor((parseDateOnly(date)?.getTime() || 0) / DAY_MS);
    return halves.map((half) => ({
      task,
      date,
      half,
      sequence: day * 2 + (half === 'PM' ? 1 : 0),
      hours: half === 'AM' ? 3.5 : 4.5,
    }));
  });
}

function identityKey(task: ScheduleTaskForContinuity): string {
  return [task.assigned_employee_id || '', task.task_name.trim(), task.task_type].join('\u0000');
}

function ordinaryHours(task: ScheduleTaskForContinuity): number {
  if (task.time_slot === 'AM') return 3.5;
  if (task.time_slot === 'PM') return 4.5;
  return 8;
}

export function buildContinuousTaskSegments(
  tasks: ScheduleTaskForContinuity[]
): Map<string, ContinuousTaskSegmentMeta> {
  const result = new Map<string, ContinuousTaskSegmentMeta>();
  const groups = new Map<string, ExpandedSlot[]>();

  tasks.forEach((task) => {
    const expanded = expandTask(task);
    const group = groups.get(identityKey(task)) || [];
    group.push(...expanded);
    groups.set(identityKey(task), group);
    datesBetween(task.start_date, task.end_date).forEach((date) => {
      result.set(`${task.id}|${date}`, {
        position: 'single',
        continuousHours: ordinaryHours(task),
        showLabel: true,
        groupId: task.id,
      });
    });
  });

  groups.forEach((rawSlots, identity) => {
    const slots = [...rawSlots].sort((left, right) => left.sequence - right.sequence || left.task.id.localeCompare(right.task.id));
    const runs: ExpandedSlot[][] = [];
    let run: ExpandedSlot[] = [];
    let previousSequence: number | null = null;

    slots.forEach((slot) => {
      if (previousSequence === null || slot.sequence <= previousSequence + 1) {
        run.push(slot);
      } else {
        if (run.length) runs.push(run);
        run = [slot];
      }
      previousSequence = Math.max(previousSequence ?? slot.sequence, slot.sequence);
    });
    if (run.length) runs.push(run);

    runs.forEach((continuousRun, runIndex) => {
      const uniqueSlots = Array.from(new Map(
        continuousRun.map((slot) => [`${slot.sequence}`, slot])
      ).values());
      const continuousHours = uniqueSlots.reduce((sum, slot) => sum + slot.hours, 0);
      if (continuousHours <= 8) return;

      const dates = Array.from(new Set(uniqueSlots.map((slot) => slot.date))).sort();
      const groupId = `${identity}|${runIndex}|${dates[0]}`;
      dates.forEach((date, dateIndex) => {
        const dateSlots = continuousRun.filter((slot) => slot.date === date);
        const taskIds = Array.from(new Set(dateSlots.map((slot) => slot.task.id))).sort();
        const position = dates.length === 1
          ? 'single'
          : dateIndex === 0
            ? 'start'
            : dateIndex === dates.length - 1
              ? 'end'
              : 'middle';

        taskIds.forEach((taskId, taskIndex) => {
          result.set(`${taskId}|${date}`, {
            position,
            continuousHours,
            showLabel: dateIndex === 0 && taskIndex === 0,
            groupId,
            hidden: taskIndex > 0,
          });
        });
      });
    });
  });

  return result;
}
