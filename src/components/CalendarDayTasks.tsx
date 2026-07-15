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
  continuousHeights: Record<string, number>;
  onContinuousHeightChange: (groupId: string, height: number) => void;
  onTaskClick?: (task: CalendarDayTask) => void;
}

export function CalendarDayTasks({
  tasks,
  date,
  segments,
  continuousHeights,
  onContinuousHeightChange,
  onTaskClick,
}: CalendarDayTasksProps) {
  const layout = buildCalendarTaskLayout(tasks, date, segments);

  return (
    <div
      data-testid="calendar-day-tasks"
      className="flex flex-col"
    >
      {layout.map(({ task, section }) => {
        const segment = segments.get(`${task.id}|${date}`);
        return (
          <div
            key={task.id}
            className="task-card-compact w-full"
            data-testid={`calendar-task-${task.id}`}
            data-calendar-section={section}
          >
            <TaskCardCompact
              task={task}
              onClick={() => onTaskClick?.(task)}
              segmentMeta={segment}
              continuousHeight={segment ? continuousHeights[segment.groupId] : undefined}
              onContinuousHeightChange={onContinuousHeightChange}
            />
          </div>
        );
      })}
    </div>
  );
}
