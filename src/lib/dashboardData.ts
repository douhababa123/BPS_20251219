export interface AssessmentLike {
  employee_id?: string;
  employee_name?: string;
  module_id?: number;
  module_name?: string;
  skill_id?: number;
  skill_name?: string;
  current_level?: number | null;
  target_level?: number | null;
  gap?: number | null;
  assessment_year?: number | null;
}

export interface TaskLike {
  id?: string;
  task_name?: string;
  task_type?: string;
  task_location?: string;
  assigned_employee_id?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  hours_per_day?: number | null;
  total_hours?: number | null;
  status?: string;
  created_at?: string;
  updated_at?: string;
}

export interface EmployeeLike {
  id?: string;
  name?: string;
}

export interface CalendarSlotLike {
  id: string;
  userId: string;
  date: string;
  half: 'AM' | 'PM';
  type: string;
  location: string;
  topic: string;
  hours: number;
  source: 'import' | 'system';
}

export function getAssessmentYears(assessments: AssessmentLike[]): number[] {
  return Array.from(new Set(
    assessments
      .map(item => Number(item.assessment_year))
      .filter(year => Number.isFinite(year) && year > 0)
  )).sort((a, b) => b - a);
}

export function buildCompetencyDistribution(assessments: AssessmentLike[]) {
  const buckets = [0, 1, 2, 3, 4].map(level => ({
    level,
    count: 0,
    name: `LV${level}`,
  }));

  assessments.forEach(assessment => {
    const level = normalizeCompetencyLevel(assessment.current_level);
    const bucket = buckets.find(item => item.level === level);
    if (bucket) {
      bucket.count += 1;
    }
  });

  return buckets;
}

export function buildRadarData(assessments: AssessmentLike[]) {
  const modules = new Map<string, { module: string; currentSum: number; targetSum: number; count: number }>();

  assessments.forEach(assessment => {
    const moduleName = assessment.module_name || 'Unknown';
    const existing = modules.get(moduleName) || { module: moduleName, currentSum: 0, targetSum: 0, count: 0 };
    existing.currentSum += Number(assessment.current_level || 0);
    existing.targetSum += Number(assessment.target_level || 0);
    existing.count += 1;
    modules.set(moduleName, existing);
  });

  return Array.from(modules.values()).map(item => ({
    module: item.module,
    current: item.count ? Number((item.currentSum / item.count).toFixed(1)) : 0,
    target: item.count ? Number((item.targetSum / item.count).toFixed(1)) : 0,
  }));
}

export function buildTopGapCounts(assessments: AssessmentLike[], limit = 5) {
  const gaps = new Map<string, { userId: string; name: string; gaps: number }>();

  assessments.forEach(assessment => {
    const gap = getGap(assessment);
    if (gap < 2) return;
    const userId = assessment.employee_id || assessment.employee_name || 'unknown';
    const existing = gaps.get(userId) || {
      userId,
      name: assessment.employee_name || userId,
      gaps: 0,
    };
    existing.gaps += 1;
    gaps.set(userId, existing);
  });

  return Array.from(gaps.values()).sort((a, b) => b.gaps - a.gaps).slice(0, limit);
}

export function buildModuleGapRanking(assessments: AssessmentLike[]) {
  const modules = new Map<string, { module: string; totalGap: number; gap2Plus: number; count: number }>();

  assessments.forEach(assessment => {
    const gap = Math.max(getGap(assessment), 0);
    const moduleName = assessment.module_name || 'Unknown';
    const existing = modules.get(moduleName) || { module: moduleName, totalGap: 0, gap2Plus: 0, count: 0 };
    existing.totalGap += gap;
    existing.gap2Plus += gap >= 2 ? 1 : 0;
    existing.count += 1;
    modules.set(moduleName, existing);
  });

  return Array.from(modules.values())
    .map(item => ({
      module: item.module,
      avgGap: item.count ? Number((item.totalGap / item.count).toFixed(2)) : 0,
      gap2Plus: item.gap2Plus,
      totalGap: Number(item.totalGap.toFixed(2)),
    }))
    .sort((a, b) => b.avgGap - a.avgGap);
}

export function buildPersonalGapRanking(assessments: AssessmentLike[], limit = 6) {
  const users = new Map<string, { userId: string; name: string; totalGap: number }>();

  assessments.forEach(assessment => {
    const gap = Math.max(getGap(assessment), 0);
    if (gap <= 0) return;
    const userId = assessment.employee_id || assessment.employee_name || 'unknown';
    const existing = users.get(userId) || {
      userId,
      name: assessment.employee_name || userId,
      totalGap: 0,
    };
    existing.totalGap += gap;
    users.set(userId, existing);
  });

  return Array.from(users.values())
    .map(item => ({ ...item, totalGap: Number(item.totalGap.toFixed(2)) }))
    .sort((a, b) => b.totalGap - a.totalGap)
    .slice(0, limit);
}

export function buildAbilityGapDistribution(assessments: AssessmentLike[], limit = 8) {
  const skills = new Map<string, { name: string; module: string; totalGap: number; gap2Plus: number }>();

  assessments.forEach(assessment => {
    const gap = Math.max(getGap(assessment), 0);
    if (gap <= 0) return;
    const key = String(assessment.skill_id || assessment.skill_name || 'unknown');
    const existing = skills.get(key) || {
      name: assessment.skill_name || key,
      module: assessment.module_name || '',
      totalGap: 0,
      gap2Plus: 0,
    };
    existing.totalGap += gap;
    existing.gap2Plus += gap >= 2 ? 1 : 0;
    skills.set(key, existing);
  });

  return Array.from(skills.values())
    .map(item => ({ ...item, totalGap: Number(item.totalGap.toFixed(2)) }))
    .sort((a, b) => b.totalGap - a.totalGap)
    .slice(0, limit);
}

export function buildTaskDistributions(tasks: TaskLike[]) {
  return {
    typeDistribution: sumBy(tasks, task => task.task_type || 'Unknown'),
    locationDistribution: sumBy(tasks, task => task.task_location || 'Unknown'),
  };
}

export function buildWorkflowSummary(tasks: TaskLike[]) {
  return {
    pendingApproval: tasks.filter(task => task.status === 'pending_approval').length,
    assigned: tasks.filter(task => ['planned', 'confirmed', 'in_progress', 'active'].includes(task.status || '')).length,
    rejected: tasks.filter(task => ['rejected', 'employee_rejected'].includes(task.status || '')).length,
  };
}

export function buildSaturationTrend(tasks: TaskLike[], employeeCount: number) {
  const byMonth = new Map<string, number>();

  tasks.forEach(task => {
    const start = parseDate(task.start_date);
    if (!start) return;
    const month = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}`;
    byMonth.set(month, (byMonth.get(month) || 0) + getTaskHours(task));
  });

  return Array.from(byMonth.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-6)
    .map(([month, hours]) => {
      const capacity = employeeCount * countWeekdaysInMonth(month) * 8;
      return {
        month,
        saturation: capacity > 0 ? Math.round((hours / capacity) * 100) : 0,
      };
    });
}

export function buildRecentActivities(tasks: TaskLike[], limit = 4) {
  return [...tasks]
    .sort((a, b) => getSortTime(b) - getSortTime(a))
    .slice(0, limit)
    .map(task => ({
      id: task.id || `${task.task_name}-${task.updated_at || task.created_at || task.start_date}`,
      type: task.status || 'task',
      desc: task.task_name || 'Unnamed task',
      time: formatDate(task.updated_at || task.created_at || task.start_date),
    }));
}

export function buildUpcomingTasks(tasks: TaskLike[], limit = 4) {
  const today = startOfDay(new Date());
  return tasks
    .filter(task => {
      const date = parseDate(task.end_date || task.start_date);
      return date ? startOfDay(date).getTime() >= today.getTime() : false;
    })
    .sort((a, b) => getSortTime(a) - getSortTime(b))
    .slice(0, limit)
    .map(task => ({
      title: task.task_name || 'Unnamed task',
      status: task.status || 'planned',
      date: formatDate(task.end_date || task.start_date),
      progress: getStatusProgress(task.status),
    }));
}

export function buildCalendarSlotsFromTasks(tasks: TaskLike[]): CalendarSlotLike[] {
  const slots: CalendarSlotLike[] = [];

  tasks.forEach(task => {
    if (!task.assigned_employee_id) return;
    const start = parseDate(task.start_date);
    const end = parseDate(task.end_date || task.start_date);
    if (!start || !end) return;

    const dates = enumerateDates(start, end);
    const totalHours = getTaskHours(task);
    const perDayHours = dates.length > 0 ? totalHours / dates.length : totalHours;
    const halves = getTaskHalves(task);

    dates.forEach(date => {
      const dateText = formatDate(date.toISOString());
      halves.forEach(half => {
        slots.push({
          id: `${task.id || task.task_name}-${dateText}-${half}`,
          userId: task.assigned_employee_id || '',
          date: dateText,
          half,
          type: task.task_type || 'Task',
          location: task.task_location || '-',
          topic: task.task_name || task.task_type || 'Task',
          hours: Number((perDayHours / halves.length).toFixed(2)),
          source: 'system',
        });
      });
    });
  });

  return slots;
}

function getGap(assessment: AssessmentLike): number {
  if (assessment.gap !== null && assessment.gap !== undefined) {
    return Number(assessment.gap) || 0;
  }
  return Number(assessment.target_level || 0) - Number(assessment.current_level || 0);
}

function normalizeCompetencyLevel(value?: number | null): number {
  const level = Math.round(Number(value ?? 0));
  if (!Number.isFinite(level)) return 0;
  return Math.min(Math.max(level, 0), 4);
}

function sumBy(tasks: TaskLike[], getName: (task: TaskLike) => string) {
  const values = new Map<string, number>();
  tasks.forEach(task => {
    const name = getName(task);
    values.set(name, (values.get(name) || 0) + getTaskHours(task));
  });
  return Array.from(values.entries()).map(([name, value]) => ({ name, value }));
}

function getTaskHours(task: TaskLike): number {
  if (task.total_hours !== null && task.total_hours !== undefined) {
    return Number(task.total_hours) || 0;
  }
  return Number(task.hours_per_day) || 0;
}

function parseDate(value?: string | null): Date | null {
  if (!value) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split('-').map(Number);
    return new Date(year, month - 1, day);
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function getSortTime(task: TaskLike): number {
  return parseDate(task.updated_at || task.created_at || task.start_date)?.getTime() || 0;
}

function formatDate(value?: string | null): string {
  const date = parseDate(value);
  if (!date) return '-';
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');
}

function countWeekdaysInMonth(monthValue: string): number {
  const [year, month] = monthValue.split('-').map(Number);
  const days = new Date(year, month, 0).getDate();
  let count = 0;
  for (let day = 1; day <= days; day += 1) {
    const weekday = new Date(year, month - 1, day).getDay();
    if (weekday !== 0 && weekday !== 6) count += 1;
  }
  return count;
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function getStatusProgress(status?: string): number {
  if (status === 'completed') return 100;
  if (status === 'confirmed' || status === 'in_progress') return 70;
  if (status === 'planned' || status === 'active') return 40;
  if (status === 'pending_approval') return 15;
  return 0;
}

function enumerateDates(start: Date, end: Date): Date[] {
  const dates: Date[] = [];
  const cursor = startOfDay(start);
  const last = startOfDay(end);
  while (cursor.getTime() <= last.getTime()) {
    dates.push(new Date(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return dates;
}

function getTaskHalves(task: TaskLike): Array<'AM' | 'PM'> {
  const timeSlot = String((task as TaskLike & { time_slot?: string | null }).time_slot || '').toUpperCase();
  if (timeSlot === 'AM') return ['AM'];
  if (timeSlot === 'PM') return ['PM'];
  return ['AM', 'PM'];
}
