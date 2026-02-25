"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";

import {
  buildTaskAnalytics,
  type ScheduleTask,
  type TaskAnalytics,
} from "@/lib/tasks/analytics";
import { INITIAL_SCHEDULE_TASKS } from "@/lib/tasks/mock";

type TaskStatus = ScheduleTask["status"] | "done";
type Task = Omit<ScheduleTask, "status"> & { status: TaskStatus };
type ViewMode = "list" | "board";
type UrgencyLevel = "overdue" | "due-soon" | "upcoming" | "none";

type ScaleOption = {
  label: string;
  dayWidth: number;
};

const SCALE_OPTIONS: ScaleOption[] = [
  { label: "Compact", dayWidth: 14 },
  { label: "Comfort", dayWidth: 20 },
  { label: "Focus", dayWidth: 28 },
];

const STATUS_LABELS: Record<TaskStatus, string> = {
  "on-track": "On track",
  "at-risk": "At risk",
  "off-track": "Off track",
  done: "Done",
};

const STATUS_BADGE: Record<TaskStatus, string> = {
  "on-track": "bg-emerald-100 text-emerald-700 border-emerald-200",
  "at-risk": "bg-amber-100 text-amber-700 border-amber-200",
  "off-track": "bg-rose-100 text-rose-700 border-rose-200",
  done: "bg-slate-100 text-slate-700 border-slate-200",
};

const STATUS_BAR: Record<TaskStatus, string> = {
  "on-track": "bg-emerald-500",
  "at-risk": "bg-amber-500",
  "off-track": "bg-rose-500",
  done: "bg-slate-500",
};

const DEFAULT_TASK: Omit<Task, "id"> = {
  name: "",
  owner: "",
  phase: "Structure",
  start: "",
  end: "",
  progress: 0,
  status: "on-track",
};

const REMINDER_OPTIONS = [72, 48, 24, 12, 6] as const;

type NotificationItem = {
  id: string;
  taskId: string;
  taskName: string;
  message: string;
  channel: "in-app" | "in-app + email";
  createdAt: string;
};

const DAY_MS = 1000 * 60 * 60 * 24;

const startOfDay = (value: Date) => new Date(value.getFullYear(), value.getMonth(), value.getDate());

const parseDate = (value: string) => {
  if (!value) return new Date("");
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
};

const toInputDate = (value: Date) =>
  `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(
    value.getDate()
  ).padStart(2, "0")}`;

const addDays = (value: Date, days: number) => new Date(value.getTime() + days * DAY_MS);

const diffDays = (start: Date, end: Date) =>
  Math.max(0, Math.round((startOfDay(end).getTime() - startOfDay(start).getTime()) / DAY_MS));

const formatLabel = (value: Date) =>
  value.toLocaleDateString(undefined, { month: "short", day: "numeric" });

const clampProgress = (value: number) => Math.max(0, Math.min(100, value));

const buildId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `task-${Date.now()}-${Math.random().toString(16).slice(2)}`;

const getUrgencyLevel = (task: Task, now = new Date()): UrgencyLevel => {
  if (task.status === "done") return "none";
  const due = parseDate(task.end);
  if (Number.isNaN(due.getTime())) return "none";
  const dueAt = startOfDay(due);
  if (dueAt.getTime() < startOfDay(now).getTime()) return "overdue";
  const hoursUntil = (dueAt.getTime() - now.getTime()) / (1000 * 60 * 60);
  if (hoursUntil <= 48) return "due-soon";
  return "upcoming";
};

const URGENCY_STYLES: Record<UrgencyLevel, { row: string; label: string; dot: string }> = {
  overdue: {
    row: "border-l-4 border-l-rose-500 bg-rose-50/60",
    label: "Overdue",
    dot: "bg-rose-500",
  },
  "due-soon": {
    row: "border-l-4 border-l-amber-500 bg-amber-50/60",
    label: "Due soon",
    dot: "bg-amber-500",
  },
  upcoming: {
    row: "border-l-4 border-l-sky-500 bg-sky-50/40",
    label: "Upcoming",
    dot: "bg-sky-500",
  },
  none: {
    row: "border-l-4 border-l-slate-300",
    label: "Done",
    dot: "bg-slate-400",
  },
};

export default function ScheduleGantt() {
  const toAnalyticsTasks = (items: Task[]): ScheduleTask[] =>
    items
      .filter((task): task is Task & { status: ScheduleTask["status"] => task.status !== "done")
      .map((task) => ({ ...task, status: task.status }));

  const [tasks, setTasks] = useState<Task[]>(INITIAL_SCHEDULE_TASKS);
  const [analytics, setAnalytics] = useState<TaskAnalytics>(() =>
    buildTaskAnalytics(toAnalyticsTasks(INITIAL_SCHEDULE_TASKS))
  );
  const [form, setForm] = useState(DEFAULT_TASK);
  const [scale, setScale] = useState<ScaleOption>(SCALE_OPTIONS[1]);
  const [statusFilter, setStatusFilter] = useState<TaskStatus | "all">("all");
  const [ownerFilter, setOwnerFilter] = useState("all");
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [reminderHours, setReminderHours] = useState<number[]>([48, 24]);
  const [emailNotificationsEnabled, setEmailNotificationsEnabled] = useState(false);
  const sentNotificationKeys = useRef(new Set<string>());

  useEffect(() => {
    setAnalytics(buildTaskAnalytics(toAnalyticsTasks(tasks)));
  }, [tasks]);

  useEffect(() => {
    let isMounted = true;

    const loadAnalytics = async () => {
      try {
        const response = await fetch("/api/tasks/analytics");
        if (!response.ok) return;
        const payload = (await response.json()) as TaskAnalytics;
        if (isMounted) {
          setAnalytics(payload);
        }
      } catch {
        // Fall back to local calculations when endpoint is unavailable.
      }
    };

    void loadAnalytics();

    return () => {
      isMounted = false;
    };
  }, []);

  const owners = useMemo(() => {
    const unique = new Set(tasks.map((task) => task.owner).filter(Boolean));
    return Array.from(unique).sort();
  }, [tasks]);

  const sortedTasks = useMemo(() => {
    const filtered = tasks.filter((task) => {
      if (statusFilter !== "all" && task.status !== statusFilter) return false;
      if (ownerFilter !== "all" && task.owner !== ownerFilter) return false;
      return true;
    });
    return filtered.sort((a, b) => parseDate(a.start).getTime() - parseDate(b.start).getTime());
  }, [tasks, statusFilter, ownerFilter]);

  const urgencyCounts = useMemo(() => {
    return tasks.reduce(
      (totals, task) => {
        const urgency = getUrgencyLevel(task);
        if (urgency === "overdue") totals.overdue += 1;
        if (urgency === "due-soon") totals.dueSoon += 1;
        return totals;
      },
      { overdue: 0, dueSoon: 0 }
    );
  }, [tasks]);

  const { chartStart, chartEnd, totalDays } = useMemo(() => {
    if (!tasks.length) {
      const today = startOfDay(new Date());
      return {
        chartStart: addDays(today, -7),
        chartEnd: addDays(today, 21),
        totalDays: 28,
      };
    }
    const starts = tasks.map((task) => parseDate(task.start)).filter((d) => !Number.isNaN(d.getTime()));
    const ends = tasks.map((task) => parseDate(task.end)).filter((d) => !Number.isNaN(d.getTime()));
    const minStart = starts.reduce((min, current) => (current < min ? current : min), starts[0]);
    const maxEnd = ends.reduce((max, current) => (current > max ? current : max), ends[0]);
    const paddedStart = addDays(minStart, -5);
    const paddedEnd = addDays(maxEnd, 7);
    return {
      chartStart: paddedStart,
      chartEnd: paddedEnd,
      totalDays: diffDays(paddedStart, paddedEnd) + 1,
    };
  }, [tasks]);

  const weeks = useMemo(() => {
    const items: Date[] = [];
    for (let day = 0; day <= totalDays; day += 7) {
      items.push(addDays(chartStart, day));
    }
    return items;
  }, [chartStart, totalDays]);

  const todayOffset = diffDays(chartStart, startOfDay(new Date()));
  const chartWidth = totalDays * scale.dayWidth;

  const handleProgress = (id: string, value: number) => {
    setTasks((prev) =>
      prev.map((task) => (task.id === id ? { ...task, progress: clampProgress(value) } : task))
    );
  };

  const handleRemove = (id: string) => {
    setTasks((prev) => prev.filter((task) => task.id !== id));
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!form.name || !form.start || !form.end) return;
    const start = parseDate(form.start);
    const end = parseDate(form.end);
    const normalizedStart = start <= end ? start : end;
    const normalizedEnd = start <= end ? end : start;
    setTasks((prev) => [
      ...prev,
      {
        id: buildId(),
        ...form,
        start: toInputDate(normalizedStart),
        end: toInputDate(normalizedEnd),
        progress: clampProgress(form.progress),
      },
    ]);
    setForm(DEFAULT_TASK);
  };

  useEffect(() => {
    const pushNotification = (task: Task, message: string, dedupeKey: string) => {
      if (sentNotificationKeys.current.has(dedupeKey)) return;
      sentNotificationKeys.current.add(dedupeKey);
      setNotifications((prev) => [
        {
          id: buildId(),
          taskId: task.id,
          taskName: task.name,
          message,
          channel: emailNotificationsEnabled ? "in-app + email" : "in-app",
          createdAt: new Date().toISOString(),
        },
        ...prev,
      ]);
    };

    const evaluateDueDates = () => {
      const now = new Date();
      tasks.forEach((task) => {
        if (task.status === "done") return;
        const due = parseDate(task.end);
        if (Number.isNaN(due.getTime())) return;
        const dueAt = startOfDay(due);
        const hoursUntil = (dueAt.getTime() - now.getTime()) / (1000 * 60 * 60);

        if (dueAt.getTime() < startOfDay(now).getTime()) {
          pushNotification(task, `Task is overdue (due ${task.end}).`, `overdue:${task.id}`);
          return;
        }

        reminderHours.forEach((offset) => {
          if (hoursUntil <= offset) {
            pushNotification(
              task,
              `Reminder: ${task.name} is due in less than ${offset}h (${task.end}).`,
              `reminder:${task.id}:${offset}`
            );
          }
        });
      });
    };

    evaluateDueDates();
    const intervalId = window.setInterval(evaluateDueDates, 60_000);
    return () => window.clearInterval(intervalId);
  }, [emailNotificationsEnabled, reminderHours, tasks]);

  return (
    <section className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold">Gantt schedule</h2>
          <p className="text-sm opacity-70">
            {sortedTasks.length} tasks · {formatLabel(chartStart)} → {formatLabel(chartEnd)}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {(["list", "board"] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setViewMode(tab)}
              className={`rounded-full border px-3 py-1 text-xs capitalize ${
                viewMode === tab ? "bg-black text-white" : "bg-white"
              }`}
            >
              {tab}
              {tab === "list" && urgencyCounts.overdue > 0 ? (
                <span className="ml-2 rounded-full bg-rose-500 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                  {urgencyCounts.overdue}
                </span>
              ) : null}
              {tab === "board" && urgencyCounts.dueSoon > 0 ? (
                <span className="ml-2 rounded-full bg-amber-500 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                  {urgencyCounts.dueSoon}
                </span>
              ) : null}
            </button>
          ))}
          <div className="mx-2 h-5 w-px bg-black/10" />
          <div className="text-xs uppercase tracking-wide opacity-60">Zoom</div>
          {SCALE_OPTIONS.map((option) => (
            <button
              key={option.label}
              type="button"
              onClick={() => setScale(option)}
              className={`rounded-full border px-3 py-1 text-xs ${
                option.label === scale.label ? "bg-black text-white" : "bg-white"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </header>

      <section className="rounded-lg border bg-black/[0.02] p-3 md:p-4">
        <div className="mb-3 text-xs font-semibold uppercase tracking-wide opacity-60">Tasks insights</div>
        <div className="grid gap-2 md:grid-cols-5">
          <div className="rounded border bg-white p-2 text-xs">
            <div className="opacity-60">Open by status</div>
            <div className="mt-1 font-semibold">
              {analytics.openByStatus["on-track"]} on track · {analytics.openByStatus["at-risk"]} at risk ·{" "}
              {analytics.openByStatus["off-track"]} off track
            </div>
          </div>
          <div className="rounded border bg-white p-2 text-xs">
            <div className="opacity-60">Overdue tasks</div>
            <div className="mt-1 text-lg font-semibold">{analytics.overdueTasks}</div>
          </div>
          <div className="rounded border bg-white p-2 text-xs">
            <div className="opacity-60">Completion rate</div>
            <div className="mt-1 font-semibold">
              7d: {analytics.completionRate.last7Days}% · 30d: {analytics.completionRate.last30Days}%
            </div>
          </div>
          <div className="rounded border bg-white p-2 text-xs">
            <div className="opacity-60">Avg. time to completion</div>
            <div className="mt-1 font-semibold">
              {analytics.averageTimeToCompletionDays === null
                ? "—"
                : `${analytics.averageTimeToCompletionDays} days`}
            </div>
          </div>
          <div className="rounded border bg-white p-2 text-xs">
            <div className="opacity-60">Workload by assignee</div>
            <div className="mt-1 space-y-0.5">
              {analytics.workloadByAssignee.slice(0, 3).map((entry) => (
                <div key={entry.assignee}>
                  <span className="font-semibold">{entry.assignee}</span>: {entry.openTasks} open ({entry.scheduledDays}d)
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <div className="grid gap-3 md:grid-cols-[1.2fr_0.8fr]">
        <form
          onSubmit={handleSubmit}
          className="rounded-lg border p-4 space-y-3 bg-black/[0.02]"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold">Add task</h3>
            <span className="text-xs opacity-60">Manual demo inputs</span>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <label className="text-xs uppercase tracking-wide opacity-60">
              Task name
              <input
                className="mt-1 w-full rounded border border-black/20 px-3 py-2 text-sm"
                value={form.name}
                onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
                placeholder="Pour level 2 slab"
                required
              />
            </label>
            <label className="text-xs uppercase tracking-wide opacity-60">
              Owner
              <input
                className="mt-1 w-full rounded border border-black/20 px-3 py-2 text-sm"
                value={form.owner}
                onChange={(event) => setForm((prev) => ({ ...prev, owner: event.target.value }))}
                placeholder="Concrete"
              />
            </label>
            <label className="text-xs uppercase tracking-wide opacity-60">
              Phase
              <input
                className="mt-1 w-full rounded border border-black/20 px-3 py-2 text-sm"
                value={form.phase}
                onChange={(event) => setForm((prev) => ({ ...prev, phase: event.target.value }))}
                placeholder="Structure"
              />
            </label>
            <label className="text-xs uppercase tracking-wide opacity-60">
              Status
              <select
                className="mt-1 w-full rounded border border-black/20 px-3 py-2 text-sm"
                value={form.status}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, status: event.target.value as TaskStatus }))
                }
              >
                {Object.entries(STATUS_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs uppercase tracking-wide opacity-60">
              Start
              <input
                type="date"
                className="mt-1 w-full rounded border border-black/20 px-3 py-2 text-sm"
                value={form.start}
                onChange={(event) => setForm((prev) => ({ ...prev, start: event.target.value }))}
                required
              />
            </label>
            <label className="text-xs uppercase tracking-wide opacity-60">
              End
              <input
                type="date"
                className="mt-1 w-full rounded border border-black/20 px-3 py-2 text-sm"
                value={form.end}
                onChange={(event) => setForm((prev) => ({ ...prev, end: event.target.value }))}
                required
              />
            </label>
          </div>
          <label className="text-xs uppercase tracking-wide opacity-60 block">
            Progress
            <div className="mt-2 flex items-center gap-3">
              <input
                type="range"
                min={0}
                max={100}
                value={form.progress}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, progress: Number(event.target.value) }))
                }
                className="w-full"
              />
              <span className="text-xs font-semibold">{form.progress}%</span>
            </div>
          </label>
          <button
            type="submit"
            className="rounded border border-black/20 bg-black px-4 py-2 text-sm text-white"
          >
            Add to schedule
          </button>
        </form>

        <div className="rounded-lg border p-4 space-y-3">
          <div className="text-sm font-semibold">Filters</div>
          <div className="space-y-2 rounded border border-black/10 bg-black/[0.02] p-3">
            <div className="text-xs font-semibold uppercase tracking-wide opacity-70">Reminder job</div>
            <div className="text-xs opacity-70">
              Scheduled evaluator runs every minute and creates in-app reminders; email is optional.
            </div>
            <div className="flex flex-wrap gap-2">
              {REMINDER_OPTIONS.map((hours) => {
                const selected = reminderHours.includes(hours);
                return (
                  <button
                    key={hours}
                    type="button"
                    onClick={() =>
                      setReminderHours((prev) =>
                        prev.includes(hours) ? prev.filter((value) => value !== hours) : [...prev, hours]
                      )
                    }
                    className={`rounded-full border px-2 py-1 text-xs ${selected ? "bg-black text-white" : "bg-white"}`}
                  >
                    {hours}h
                  </button>
                );
              })}
            </div>
            <label className="flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={emailNotificationsEnabled}
                onChange={(event) => setEmailNotificationsEnabled(event.target.checked)}
              />
              Send email when allowed by notification settings
            </label>
          </div>
          <label className="text-xs uppercase tracking-wide opacity-60 block">
            Status
            <select
              className="mt-1 w-full rounded border border-black/20 px-3 py-2 text-sm"
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as TaskStatus | "all")}
            >
              <option value="all">All</option>
              {Object.entries(STATUS_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs uppercase tracking-wide opacity-60 block">
            Owner
            <select
              className="mt-1 w-full rounded border border-black/20 px-3 py-2 text-sm"
              value={ownerFilter}
              onChange={(event) => setOwnerFilter(event.target.value)}
            >
              <option value="all">All</option>
              {owners.map((owner) => (
                <option key={owner} value={owner}>
                  {owner}
                </option>
              ))}
            </select>
          </label>
          <div className="rounded border border-black/10 bg-black/[0.02] p-3">
            <div className="mb-2 text-xs font-semibold uppercase tracking-wide opacity-60">Recent notifications</div>
            {notifications.length === 0 ? (
              <div className="text-xs opacity-60">No reminders sent yet.</div>
            ) : (
              <ul className="space-y-2">
                {notifications.slice(0, 4).map((item) => (
                  <li key={item.id} className="rounded border border-black/10 bg-white p-2 text-xs">
                    <div className="font-semibold">{item.taskName}</div>
                    <div className="opacity-70">{item.message}</div>
                    <div className="mt-1 opacity-60">
                      {new Date(item.createdAt).toLocaleString()} · {item.channel}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

      {viewMode === "list" ? (
        <div className="rounded-lg border overflow-hidden">
        <div className="grid grid-cols-[320px_1fr] bg-black/[0.03]">
          <div className="border-b border-r px-4 py-3 text-xs uppercase tracking-wide opacity-60">
            Task details
          </div>
          <div className="border-b px-4 py-3 text-xs uppercase tracking-wide opacity-60">
            Timeline
          </div>
        </div>

        <div className="grid grid-cols-[320px_1fr]">
          <div className="border-r divide-y">
            {sortedTasks.length === 0 ? (
              <div className="px-4 py-6 text-sm opacity-70">No tasks match the filters.</div>
            ) : (
              sortedTasks.map((task) => (
                <div
                  key={task.id}
                  className={`px-4 py-4 space-y-2 ${URGENCY_STYLES[getUrgencyLevel(task)].row}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="text-sm font-semibold">{task.name}</div>
                      <div className="text-xs opacity-70">
                        {task.owner || "Unassigned"} · {task.phase}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemove(task.id)}
                      className="text-xs rounded border border-black/20 px-2 py-1"
                    >
                      Remove
                    </button>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <span
                      className={`inline-flex items-center rounded-full border px-2 py-0.5 ${STATUS_BADGE[task.status]}`}
                    >
                      {STATUS_LABELS[task.status]}
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-full border border-black/10 px-2 py-0.5">
                      <span className={`inline-block size-2 rounded-full ${URGENCY_STYLES[getUrgencyLevel(task)].dot}`} />
                      {URGENCY_STYLES[getUrgencyLevel(task)].label}
                    </span>
                    <span className="opacity-60">
                      {task.start} → {task.end}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={task.progress}
                      onChange={(event) => handleProgress(task.id, Number(event.target.value))}
                      className="w-full"
                    />
                    <div className="text-xs font-semibold w-10 text-right">{task.progress}%</div>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="overflow-x-auto">
            <div className="relative" style={{ minWidth: `${chartWidth}px` }}>
              <div className="flex border-b text-xs uppercase tracking-wide opacity-60">
                {weeks.map((weekStart) => (
                  <div
                    key={weekStart.toISOString()}
                    className="flex items-center justify-center border-r py-2"
                    style={{ width: `${scale.dayWidth * 7}px` }}
                  >
                    Week of {formatLabel(weekStart)}
                  </div>
                ))}
              </div>

              <div
                className="absolute inset-0 pointer-events-none z-0"
                style={{
                  backgroundImage: `repeating-linear-gradient(to right, rgba(0,0,0,0.07), rgba(0,0,0,0.07) 1px, transparent 1px, transparent ${scale.dayWidth}px),
                  repeating-linear-gradient(to right, rgba(0,0,0,0.12), rgba(0,0,0,0.12) 1px, transparent 1px, transparent ${scale.dayWidth * 7}px)`,
                }}
              />

              {todayOffset >= 0 && todayOffset <= totalDays && (
                <div
                  className="absolute top-0 bottom-0 border-l-2 border-rose-500 z-20"
                  style={{ left: `${todayOffset * scale.dayWidth}px` }}
                >
                  <div className="absolute -top-6 left-2 text-[10px] uppercase text-rose-600">
                    Today
                  </div>
                </div>
              )}

              <div className="relative z-10 divide-y">
                {sortedTasks.map((task) => {
                  const start = parseDate(task.start);
                  const end = parseDate(task.end);
                  const offset = diffDays(chartStart, start);
                  const length = diffDays(start, end) + 1;
                  const left = offset * scale.dayWidth;
                  const width = Math.max(scale.dayWidth, length * scale.dayWidth);
                  return (
                    <div key={task.id} className="relative h-[72px]">
                      <div
                        className="absolute top-1/2 -translate-y-1/2 rounded-full bg-black/10"
                        style={{ left: `${left}px`, width: `${width}px`, height: "22px" }}
                      />
                      <div
                        className={`absolute top-1/2 -translate-y-1/2 rounded-full ${STATUS_BAR[task.status]}`}
                        style={{
                          left: `${left}px`,
                          width: `${(width * task.progress) / 100}px`,
                          height: "22px",
                        }}
                      />
                      <div
                        className="absolute top-1/2 -translate-y-1/2 text-[11px] text-white font-semibold px-2"
                        style={{ left: `${left}px` }}
                      >
                        {task.progress}%
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-3">
          {([
            { key: "overdue", title: "Overdue" },
            { key: "due-soon", title: "Due soon (≤48h)" },
            { key: "upcoming", title: "Upcoming" },
          ] as const).map((lane) => {
            const laneTasks = sortedTasks.filter((task) => getUrgencyLevel(task) === lane.key);
            return (
              <div key={lane.key} className="rounded-lg border bg-black/[0.02] p-3">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-sm font-semibold">{lane.title}</h3>
                  <span className="rounded-full border border-black/10 bg-white px-2 py-0.5 text-xs">
                    {laneTasks.length}
                  </span>
                </div>
                <div className="space-y-2">
                  {laneTasks.length === 0 ? (
                    <div className="rounded border border-dashed border-black/20 px-3 py-6 text-center text-xs opacity-60">
                      No tasks in this lane.
                    </div>
                  ) : (
                    laneTasks.map((task) => (
                      <div key={task.id} className={`rounded border p-3 text-sm ${URGENCY_STYLES[lane.key].row}`}>
                        <div className="font-semibold">{task.name}</div>
                        <div className="text-xs opacity-70">{task.owner || "Unassigned"} · {task.phase}</div>
                        <div className="mt-2 text-xs opacity-70">Due {task.end}</div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
