"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

type SelectableProject = { id: string; name: string };

type TaskStatus = "todo" | "in_progress" | "blocked" | "done";
type TaskPriority = "low" | "medium" | "high" | "urgent";
type SortOption = "due_soonest" | "recently_updated";
type ViewMode = "list" | "board";

type TaskComment = {
  id: string;
  author: string;
  body: string;
  createdAt: string;
};

type TaskActivity = {
  id: string;
  message: string;
  createdAt: string;
};

type TaskItem = {
  id: string;
  projectId: string;
  title: string;
  assignee: string;
  dueDate: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  description: string;
  updatedAt: string;
  comments: TaskComment[];
  activity: TaskActivity[];
};

type TaskFilters = {
  assignee: string;
  status: TaskStatus | "all";
  priority: TaskPriority | "all";
  dueStart: string;
  dueEnd: string;
};

type Preferences = {
  viewMode: ViewMode;
  sort: SortOption;
  filters: TaskFilters;
};

const STATUSES: Array<{ value: TaskStatus; label: string }> = [
  { value: "todo", label: "To Do" },
  { value: "in_progress", label: "In Progress" },
  { value: "blocked", label: "Blocked" },
  { value: "done", label: "Done" },
];

const PRIORITIES: TaskPriority[] = ["low", "medium", "high", "urgent"];

const DEFAULT_FILTERS: TaskFilters = {
  assignee: "all",
  status: "all",
  priority: "all",
  dueStart: "",
  dueEnd: "",
};

function nowIso() {
  return new Date().toISOString();
}

function labelForStatus(status: TaskStatus): string {
  return STATUSES.find((item) => item.value === status)?.label ?? status;
}

function isWithinDateRange(task: TaskItem, dueStart: string, dueEnd: string): boolean {
  if (!task.dueDate) return !dueStart && !dueEnd;
  if (dueStart && task.dueDate < dueStart) return false;
  if (dueEnd && task.dueDate > dueEnd) return false;
  return true;
}

function sortTasks(tasks: TaskItem[], sort: SortOption): TaskItem[] {
  return [...tasks].sort((a, b) => {
    if (sort === "due_soonest") {
      const aDue = a.dueDate ? new Date(`${a.dueDate}T00:00:00`).getTime() : Number.POSITIVE_INFINITY;
      const bDue = b.dueDate ? new Date(`${b.dueDate}T00:00:00`).getTime() : Number.POSITIVE_INFINITY;
      return aDue - bDue;
    }
    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
  });
}

function taskStorageKey(projectId: string) {
  return `biddingTasks:${projectId}`;
}

function prefsStorageKey(projectId: string) {
  return `biddingTaskPrefs:${projectId}`;
}

function seededTasks(projectId: string): TaskItem[] {
  const base = nowIso();
  return [
    {
      id: crypto.randomUUID(),
      projectId,
      title: "Issue structural steel bid clarification",
      assignee: "Alex Kim",
      dueDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 2).toISOString().slice(0, 10),
      status: "in_progress",
      priority: "high",
      description: "Need to align addendum scope with latest drawing set before final leveling review.",
      updatedAt: base,
      comments: [
        {
          id: crypto.randomUUID(),
          author: "Taylor",
          body: "Waiting on engineer response to RFI-42 before we close this out.",
          createdAt: base,
        },
      ],
      activity: [
        {
          id: crypto.randomUUID(),
          message: "Task created",
          createdAt: base,
        },
      ],
    },
    {
      id: crypto.randomUUID(),
      projectId,
      title: "Confirm roofing alternates",
      assignee: "Jordan Lee",
      dueDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 5).toISOString().slice(0, 10),
      status: "todo",
      priority: "medium",
      description: "Collect revised alternate pricing and lock final recommendation.",
      updatedAt: base,
      comments: [],
      activity: [
        {
          id: crypto.randomUUID(),
          message: "Task created",
          createdAt: base,
        },
      ],
    },
  ];
}

export default function TasksWorkspace() {
  const searchParams = useSearchParams();
  const queryProjectId = searchParams.get("project");
  const [projects, setProjects] = useState<SelectableProject[]>([]);
  const [projectId, setProjectId] = useState<string>(queryProjectId ?? "");
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [prefs, setPrefs] = useState<Preferences>({
    viewMode: "list",
    sort: "due_soonest",
    filters: DEFAULT_FILTERS,
  });
  const [quickTitle, setQuickTitle] = useState("");
  const [quickAssignee, setQuickAssignee] = useState("");
  const [quickDueDate, setQuickDueDate] = useState("");
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    async function loadProjects() {
      try {
        const response = await fetch("/api/projects/selectable", { cache: "no-store" });
        const payload = (await response.json().catch(() => null)) as { projects?: SelectableProject[] } | null;
        if (!active) return;
        const next = Array.isArray(payload?.projects) ? payload.projects : [];
        setProjects(next);
        if (!projectId && next.length) {
          setProjectId(queryProjectId && next.some((p) => p.id === queryProjectId) ? queryProjectId : next[0].id);
        }
      } catch {
        if (!active) return;
        setProjects([]);
      }
    }
    loadProjects();
    return () => {
      active = false;
    };
  }, [projectId, queryProjectId]);

  useEffect(() => {
    if (!projectId) return;
    const storedPrefs = localStorage.getItem(prefsStorageKey(projectId));
    if (storedPrefs) {
      try {
        const parsed = JSON.parse(storedPrefs) as Preferences;
        queueMicrotask(() => setPrefs(parsed));
      } catch {
        queueMicrotask(() => setPrefs({ viewMode: "list", sort: "due_soonest", filters: DEFAULT_FILTERS }));
      }
    } else {
      queueMicrotask(() => setPrefs({ viewMode: "list", sort: "due_soonest", filters: DEFAULT_FILTERS }));
    }

    const storedTasks = localStorage.getItem(taskStorageKey(projectId));
    if (storedTasks) {
      try {
        queueMicrotask(() => setTasks(JSON.parse(storedTasks) as TaskItem[]));
      } catch {
        queueMicrotask(() => setTasks(seededTasks(projectId)));
      }
    } else {
      const seeded = seededTasks(projectId);
      queueMicrotask(() => setTasks(seeded));
      localStorage.setItem(taskStorageKey(projectId), JSON.stringify(seeded));
    }
    queueMicrotask(() => setSelectedTaskId(null));
  }, [projectId]);

  useEffect(() => {
    if (!projectId) return;
    localStorage.setItem(prefsStorageKey(projectId), JSON.stringify(prefs));
  }, [prefs, projectId]);

  useEffect(() => {
    if (!projectId) return;
    localStorage.setItem(taskStorageKey(projectId), JSON.stringify(tasks));
  }, [tasks, projectId]);

  const assignees = useMemo(() => {
    const known = new Set(tasks.map((task) => task.assignee).filter(Boolean));
    return [...known].sort((a, b) => a.localeCompare(b));
  }, [tasks]);

  const filteredTasks = useMemo(() => {
    const next = tasks.filter((task) => {
      if (prefs.filters.assignee !== "all" && task.assignee !== prefs.filters.assignee) return false;
      if (prefs.filters.status !== "all" && task.status !== prefs.filters.status) return false;
      if (prefs.filters.priority !== "all" && task.priority !== prefs.filters.priority) return false;
      if (!isWithinDateRange(task, prefs.filters.dueStart, prefs.filters.dueEnd)) return false;
      return true;
    });
    return sortTasks(next, prefs.sort);
  }, [tasks, prefs]);

  const groupedByStatus = useMemo(() => {
    const map = new Map<TaskStatus, TaskItem[]>();
    STATUSES.forEach((status) => map.set(status.value, []));
    filteredTasks.forEach((task) => {
      map.get(task.status)?.push(task);
    });
    return map;
  }, [filteredTasks]);

  const selectedTask = tasks.find((task) => task.id === selectedTaskId) ?? null;

  const addQuickTask = () => {
    if (!projectId || !quickTitle.trim() || !quickAssignee.trim()) return;
    const createdAt = nowIso();
    const task: TaskItem = {
      id: crypto.randomUUID(),
      projectId,
      title: quickTitle.trim(),
      assignee: quickAssignee.trim(),
      dueDate: quickDueDate || null,
      status: "todo",
      priority: "medium",
      description: "",
      updatedAt: createdAt,
      comments: [],
      activity: [{ id: crypto.randomUUID(), message: "Task created via quick-add", createdAt }],
    };
    setTasks((prev) => [task, ...prev]);
    setQuickTitle("");
    setQuickAssignee("");
    setQuickDueDate("");
  };

  const moveTask = (taskId: string, status: TaskStatus) => {
    setTasks((prev) =>
      prev.map((task) =>
        task.id === taskId
          ? {
              ...task,
              status,
              updatedAt: nowIso(),
              activity: [
                {
                  id: crypto.randomUUID(),
                  message: `Status changed to ${labelForStatus(status)}`,
                  createdAt: nowIso(),
                },
                ...task.activity,
              ],
            }
          : task
      )
    );
  };

  const updateTaskDescription = (taskId: string, description: string) => {
    setTasks((prev) =>
      prev.map((task) =>
        task.id === taskId
          ? {
              ...task,
              description,
              updatedAt: nowIso(),
              activity: [
                { id: crypto.randomUUID(), message: "Description updated", createdAt: nowIso() },
                ...task.activity,
              ],
            }
          : task
      )
    );
  };

  if (!projectId) {
    return (
      <section className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600 shadow-sm">
        No project selected.
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <header className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">Tasks</h2>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className={`rounded-md px-3 py-1.5 text-sm ${prefs.viewMode === "list" ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-700"}`}
              onClick={() => setPrefs((prev) => ({ ...prev, viewMode: "list" }))}
            >
              List view
            </button>
            <button
              type="button"
              className={`rounded-md px-3 py-1.5 text-sm ${prefs.viewMode === "board" ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-700"}`}
              onClick={() => setPrefs((prev) => ({ ...prev, viewMode: "board" }))}
            >
              Board view
            </button>
          </div>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-5">
          <select
            className="rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm"
            value={prefs.filters.assignee}
            onChange={(event) =>
              setPrefs((prev) => ({ ...prev, filters: { ...prev.filters, assignee: event.target.value } }))
            }
          >
            <option value="all">All assignees</option>
            {assignees.map((assignee) => (
              <option key={assignee} value={assignee}>
                {assignee}
              </option>
            ))}
          </select>
          <select
            className="rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm"
            value={prefs.filters.status}
            onChange={(event) =>
              setPrefs((prev) => ({
                ...prev,
                filters: { ...prev.filters, status: event.target.value as TaskStatus | "all" },
              }))
            }
          >
            <option value="all">All statuses</option>
            {STATUSES.map((status) => (
              <option key={status.value} value={status.value}>
                {status.label}
              </option>
            ))}
          </select>
          <select
            className="rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm"
            value={prefs.filters.priority}
            onChange={(event) =>
              setPrefs((prev) => ({
                ...prev,
                filters: { ...prev.filters, priority: event.target.value as TaskPriority | "all" },
              }))
            }
          >
            <option value="all">All priorities</option>
            {PRIORITIES.map((priority) => (
              <option key={priority} value={priority}>
                {priority}
              </option>
            ))}
          </select>
          <input
            type="date"
            className="rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm"
            value={prefs.filters.dueStart}
            onChange={(event) =>
              setPrefs((prev) => ({ ...prev, filters: { ...prev.filters, dueStart: event.target.value } }))
            }
          />
          <input
            type="date"
            className="rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm"
            value={prefs.filters.dueEnd}
            onChange={(event) =>
              setPrefs((prev) => ({ ...prev, filters: { ...prev.filters, dueEnd: event.target.value } }))
            }
          />
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <select
            className="rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm"
            value={prefs.sort}
            onChange={(event) => setPrefs((prev) => ({ ...prev, sort: event.target.value as SortOption }))}
          >
            <option value="due_soonest">Due soonest</option>
            <option value="recently_updated">Recently updated</option>
          </select>
          <button
            type="button"
            className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700"
            onClick={() => setPrefs((prev) => ({ ...prev, filters: DEFAULT_FILTERS }))}
          >
            Clear filters
          </button>
        </div>
      </header>

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Quick add task</h3>
        <div className="mt-2 grid gap-2 md:grid-cols-[1.5fr_1fr_1fr_auto]">
          <input
            placeholder="Task title"
            className="rounded-md border border-slate-300 px-2 py-1.5 text-sm"
            value={quickTitle}
            onChange={(event) => setQuickTitle(event.target.value)}
          />
          <input
            placeholder="Assignee"
            className="rounded-md border border-slate-300 px-2 py-1.5 text-sm"
            value={quickAssignee}
            onChange={(event) => setQuickAssignee(event.target.value)}
          />
          <input
            type="date"
            className="rounded-md border border-slate-300 px-2 py-1.5 text-sm"
            value={quickDueDate}
            onChange={(event) => setQuickDueDate(event.target.value)}
          />
          <button
            type="button"
            className="rounded-md bg-slate-900 px-3 py-1.5 text-sm text-white"
            onClick={addQuickTask}
          >
            Add task
          </button>
        </div>
      </section>

      {prefs.viewMode === "list" ? (
        <div className="space-y-3">
          {STATUSES.map((status) => (
            <section key={status.value} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <h3 className="font-semibold text-slate-900">{status.label}</h3>
              <div className="mt-2 space-y-2">
                {(groupedByStatus.get(status.value) ?? []).map((task) => (
                  <button
                    key={task.id}
                    type="button"
                    className="w-full rounded-md border border-slate-200 px-3 py-2 text-left hover:bg-slate-50"
                    onClick={() => setSelectedTaskId(task.id)}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-medium text-slate-900">{task.title}</p>
                      <span className="text-xs uppercase text-slate-500">{task.priority}</span>
                    </div>
                    <p className="text-xs text-slate-600">{task.assignee} · Due {task.dueDate ?? "--"}</p>
                  </button>
                ))}
                {(groupedByStatus.get(status.value)?.length ?? 0) === 0 && (
                  <p className="text-sm text-slate-500">No tasks in this group.</p>
                )}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-4">
          {STATUSES.map((status) => (
            <section key={status.value} className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
              <h3 className="mb-2 text-sm font-semibold text-slate-900">{status.label}</h3>
              <div className="space-y-2">
                {(groupedByStatus.get(status.value) ?? []).map((task) => (
                  <article key={task.id} className="rounded-md border border-slate-200 p-2">
                    <button type="button" className="text-left" onClick={() => setSelectedTaskId(task.id)}>
                      <p className="text-sm font-medium text-slate-900">{task.title}</p>
                    </button>
                    <p className="text-xs text-slate-600">{task.assignee}</p>
                    <p className="text-xs text-slate-500">Due {task.dueDate ?? "--"}</p>
                    <select
                      className="mt-2 w-full rounded border border-slate-300 px-1 py-1 text-xs"
                      value={task.status}
                      onChange={(event) => moveTask(task.id, event.target.value as TaskStatus)}
                    >
                      {STATUSES.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </article>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      {selectedTask && (
        <aside className="fixed inset-y-0 right-0 z-20 w-full max-w-lg overflow-y-auto border-l border-slate-200 bg-white p-5 shadow-2xl">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-500">Task details</p>
              <h3 className="text-lg font-semibold text-slate-900">{selectedTask.title}</h3>
              <p className="text-sm text-slate-600">
                {selectedTask.assignee} · Due {selectedTask.dueDate ?? "--"}
              </p>
            </div>
            <button type="button" onClick={() => setSelectedTaskId(null)} className="text-sm text-slate-600">
              Close
            </button>
          </div>

          <div className="mt-4 space-y-4">
            <label className="block text-sm font-medium text-slate-700">
              Description
              <textarea
                className="mt-1 min-h-28 w-full rounded-md border border-slate-300 p-2 text-sm"
                value={selectedTask.description}
                onChange={(event) => updateTaskDescription(selectedTask.id, event.target.value)}
              />
            </label>

            <section>
              <h4 className="text-sm font-semibold text-slate-900">Comments</h4>
              <div className="mt-2 space-y-2">
                {selectedTask.comments.length ? (
                  selectedTask.comments.map((comment) => (
                    <article key={comment.id} className="rounded-md border border-slate-200 p-2">
                      <p className="text-xs text-slate-500">
                        {comment.author} · {new Date(comment.createdAt).toLocaleString()}
                      </p>
                      <p className="text-sm text-slate-700">{comment.body}</p>
                    </article>
                  ))
                ) : (
                  <p className="text-sm text-slate-500">No comments yet.</p>
                )}
              </div>
            </section>

            <section>
              <h4 className="text-sm font-semibold text-slate-900">Activity timeline</h4>
              <ol className="mt-2 space-y-2">
                {selectedTask.activity.map((entry) => (
                  <li key={entry.id} className="rounded-md border border-slate-200 p-2 text-sm text-slate-700">
                    <p>{entry.message}</p>
                    <p className="text-xs text-slate-500">{new Date(entry.createdAt).toLocaleString()}</p>
                  </li>
                ))}
              </ol>
            </section>
          </div>
        </aside>
      )}

      {projects.length > 0 && (
        <p className="text-xs text-slate-500">Preferences are saved per project in local storage.</p>
      )}
    </section>
  );
}
