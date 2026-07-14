import { TaskCardCompact, type TaskCardTask } from './TaskCard';
import {
  buildCalendarTaskLayout,
  type ContinuousTaskSegmentMeta,
  type ScheduleTaskForContinuity,
} from '../lib/scheduleRules';

export type CalendarDayTask = TaskCardTask & ScheduleTaskForContinuity;

interface CalendarDayTasksProps {
  tasks: CalendarDayTask[];
  date: string;
  segments: Map<string, ContinuousTaskSegmentMeta>;
  onTaskClick?: (task: CalendarDayTask) => void;
}

const gridColumnBySlot = {
  am: '1 / 2',
  pm: '2 / 3',
  full: '1 / 3',
} as const;

export function CalendarDayTasks({
  tasks,
  date,
  segments,
  onTaskClick,
}: CalendarDayTasksProps) {
  const layout = buildCalendarTaskLayout(tasks, date, segments);

  return (
    <div
      data-testid="calendar-day-tasks"
      className="grid grid-cols-2 auto-rows-[30px]"
    >
      {layout.map(({ task, row, column }) => (
        <div
          key={task.id}
          className="task-card-compact"
          data-testid={`calendar-task-${task.id}`}
          data-calendar-column={column}
          style={{
            gridRow: row + 1,
            gridColumn: gridColumnBySlot[column],
          }}
        >
          <TaskCardCompact
            task={task}
            onClick={() => onTaskClick?.(task)}
            segmentMeta={segments.get(`${task.id}|${date}`)}
          />
        </div>
      ))}
    </div>
  );
}
