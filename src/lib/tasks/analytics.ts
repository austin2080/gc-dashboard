export type TaskStatus = "on-track" | "at-risk" | "off-track";

export type ScheduleTask = {
  id: string;
  name: string;
  owner: string;
  phase: string;
  start: string;
  end: string;
  progress: number;
  status: TaskStatus;
};

export type TaskAnalytics = {
  generatedAt: string;
  totalTasks: number;
  openByStatus: Record<TaskStatus, number>;
  overdueTasks: number;
  completionRate: {
    last7Days: number;
    last30Days: number;
  };
  averageTimeToCompletionDays: number | null;
  workloadByAssignee: Array<{
    assignee: string;
    openTasks: number;
    scheduledDays: number;
  }>;
};

const DAY_MS = 1000 * 60 * 60 * 24;

const parseDate = (value: string) => {
  if (!value) return new Date("");
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
};

const startOfDay = (value: Date) => new Date(value.getFullYear(), value.getMonth(), value.getDate());

const diffDays = (start: Date, end: Date) =>
  Math.max(0, Math.round((startOfDay(end).getTime() - startOfDay(start).getTime()) / DAY_MS));

const inTrailingWindow = (date: Date, days: number, today: Date) => {
  const start = new Date(today);
  start.setDate(start.getDate() - days);
  return date >= start && date <= today;
};

export function buildTaskAnalytics(tasks: ScheduleTask[], now = new Date()): TaskAnalytics {
  const today = startOfDay(now);

  const openByStatus: Record<TaskStatus, number> = {
    "on-track": 0,
    "at-risk": 0,
    "off-track": 0,
  };

  let overdueTasks = 0;

  const completed = tasks.filter((task) => task.progress >= 100);
  const completedDurations = completed
    .map((task) => {
      const start = parseDate(task.start);
      const end = parseDate(task.end);
      if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;
      return diffDays(start, end) + 1;
    })
    .filter((days): days is number => days !== null);

  const averageTimeToCompletionDays =
    completedDurations.length > 0
      ? Number((completedDurations.reduce((sum, days) => sum + days, 0) / completedDurations.length).toFixed(1))
      : null;

  const completionRateForWindow = (windowDays: number) => {
    const tasksInWindow = tasks.filter((task) => {
      const end = parseDate(task.end);
      if (Number.isNaN(end.getTime())) return false;
      return inTrailingWindow(end, windowDays, today);
    });

    if (tasksInWindow.length === 0) return 0;

    const completedInWindow = tasksInWindow.filter((task) => task.progress >= 100).length;
    return Number(((completedInWindow / tasksInWindow.length) * 100).toFixed(1));
  };

  tasks.forEach((task) => {
    const end = parseDate(task.end);
    const isComplete = task.progress >= 100;

    if (!isComplete) {
      openByStatus[task.status] += 1;
    }

    if (!isComplete && !Number.isNaN(end.getTime()) && end < today) {
      overdueTasks += 1;
    }
  });

  const workloadByAssignee = Object.values(
    tasks.reduce<Record<string, { assignee: string; openTasks: number; scheduledDays: number }>>((acc, task) => {
      const assignee = task.owner || "Unassigned";
      const start = parseDate(task.start);
      const end = parseDate(task.end);
      const scheduledDays =
        Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) ? 0 : diffDays(start, end) + 1;

      if (!acc[assignee]) {
        acc[assignee] = { assignee, openTasks: 0, scheduledDays: 0 };
      }

      acc[assignee].scheduledDays += scheduledDays;
      if (task.progress < 100) {
        acc[assignee].openTasks += 1;
      }

      return acc;
    }, {})
  ).sort((a, b) => b.openTasks - a.openTasks || b.scheduledDays - a.scheduledDays);

  return {
    generatedAt: today.toISOString(),
    totalTasks: tasks.length,
    openByStatus,
    overdueTasks,
    completionRate: {
      last7Days: completionRateForWindow(7),
      last30Days: completionRateForWindow(30),
    },
    averageTimeToCompletionDays,
    workloadByAssignee,
  };
}
