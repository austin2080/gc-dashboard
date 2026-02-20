"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useContext, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { ModeContext } from "@/components/mode-provider";
import type { ProjectRow } from "@/lib/db/projects";
import { listBidProjects } from "@/lib/bidding/store";

const ACTIVE_PROJECT_STORAGE_KEY = "activeProjectId";
const RECENT_PROJECTS_STORAGE_KEY = "recentProjectIds";

const PROJECT_TOOL_ITEMS = [
  { label: "Bid Management", href: "/bidding", description: "Track bids, proposals, and award pipeline." },
  { label: "WaiverDesk", href: "/waiverdesk/waivers", description: "Manage waivers and compliance status." },
  { label: "Project Management", href: "/dashboard", description: "Monitor daily progress across active jobs." },
];

const COMPANY_TOOL_ITEMS = [
  { label: "Subs Directory", href: "/directory", description: "Search subcontractors, trades, and contacts." },
  { label: "Settings", href: "/settings", description: "Configure account, team, and company options." },
];

function projectLabel(project: ProjectRow) {
  return project.project_number ? `${project.project_number} - ${project.name}` : project.name;
}

function statusMeta(project: ProjectRow): { label: "Active" | "Estimating" | "Closed"; className: string } {
  if (project.health === "complete") {
    return { label: "Closed", className: "bg-slate-100 text-slate-700 border-slate-200" };
  }
  if (project.health === "on_hold") {
    return { label: "Estimating", className: "bg-amber-100 text-amber-800 border-amber-200" };
  }
  return { label: "Active", className: "bg-emerald-100 text-emerald-800 border-emerald-200" };
}

function appendProjectQuery(href: string, projectId: string | null) {
  if (!projectId) return href;
  const [path, rawQuery = ""] = href.split("?");
  const params = new URLSearchParams(rawQuery);
  if (!params.get("project")) params.set("project", projectId);
  const query = params.toString();
  return query ? `${path}?${query}` : path;
}

function getPathProjectId(pathname: string) {
  const match = pathname.match(/^(?:\/waiverdesk)?\/projects\/([^/]+)/);
  return match ? match[1] : null;
}

function subscribeStorage(onStoreChange: () => void) {
  if (typeof window === "undefined") return () => {};
  const handleStorage = () => onStoreChange();
  window.addEventListener("storage", handleStorage);
  return () => window.removeEventListener("storage", handleStorage);
}

function getStoredProjectIdSnapshot() {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(ACTIVE_PROJECT_STORAGE_KEY);
}

function formatDateLabel(value: string | null) {
  if (!value) return "No due date";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "No due date";
  return date.toLocaleDateString();
}

function buildContextUrl(pathname: string, searchParams: URLSearchParams, projectId: string | null) {
  const nextParams = new URLSearchParams(searchParams.toString());
  if (projectId) nextParams.set("project", projectId);
  else nextParams.delete("project");
  return `${pathname}${nextParams.toString() ? `?${nextParams.toString()}` : ""}`;
}

export default function TopNavClient({ projects }: { projects: ProjectRow[] }) {
  const { mode } = useContext(ModeContext);
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const [projectsOpen, setProjectsOpen] = useState(false);
  const [toolsOpen, setToolsOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [projectSearch, setProjectSearch] = useState("");
  const [bidProjectsForNav, setBidProjectsForNav] = useState<ProjectRow[]>([]);
  const [recentProjectIds, setRecentProjectIds] = useState<string[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const rawRecent = localStorage.getItem(RECENT_PROJECTS_STORAGE_KEY);
      const parsed = rawRecent ? (JSON.parse(rawRecent) as unknown) : [];
      if (!Array.isArray(parsed)) return [];
      return parsed.filter((item): item is string => typeof item === "string").slice(0, 5);
    } catch {
      return [];
    }
  });
  const [switchToast, setSwitchToast] = useState<{
    message: string;
    previousProjectId: string | null;
    nextProjectId: string;
  } | null>(null);
  const hasUnreadNotifications = true;

  const projectsRef = useRef<HTMLDivElement | null>(null);
  const toolsRef = useRef<HTMLDivElement | null>(null);
  const profileRef = useRef<HTMLDivElement | null>(null);
  const storedProjectId = useSyncExternalStore(
    subscribeStorage,
    getStoredProjectIdSnapshot,
    () => null
  );

  const queryProjectId = searchParams.get("project");
  const pathProjectId = getPathProjectId(pathname);
  const activeProjectId = queryProjectId ?? pathProjectId ?? storedProjectId;
  const projectsForNav = useMemo(() => {
    const ids = new Set(projects.map((project) => project.id));
    const bidOnly = bidProjectsForNav.filter((project) => !ids.has(project.id));
    return [...projects, ...bidOnly];
  }, [projects, bidProjectsForNav]);
  const activeProject = activeProjectId ? projectsForNav.find((p) => p.id === activeProjectId) ?? null : null;
  const activeProjectIsRegular = activeProject ? projects.some((project) => project.id === activeProject.id) : false;

  const withMode = (href: string) => {
    if (mode !== "waiverdesk") return href;
    if (href.startsWith("/waiverdesk")) return href;
    return `/waiverdesk${href}`;
  };

  const withContext = (href: string) => appendProjectQuery(withMode(href), activeProjectId);
  const clearProjectContext = () => {
    localStorage.removeItem(ACTIVE_PROJECT_STORAGE_KEY);
  };

  const toolSections = useMemo(
    () => [
      {
        kind: "project" as const,
        title: "Project Tools",
        items: PROJECT_TOOL_ITEMS.map((item) => ({
          ...item,
          href: appendProjectQuery(withMode(item.href), activeProjectId),
        })),
      },
      {
        kind: "company" as const,
        title: "Company Tools",
        items: COMPANY_TOOL_ITEMS.map((item) => ({
          ...item,
          href: withMode(item.href),
        })),
      },
    ],
    [activeProjectId, mode]
  );

  const currentToolLabel = (() => {
    const allTools = toolSections.flatMap((section) => section.items);
    const exact = allTools.find((tool) => pathname === tool.href.split("?")[0]);
    if (exact) return exact.label;
    const partial = allTools.find((tool) => {
      const path = tool.href.split("?")[0];
      return pathname === path || pathname.startsWith(`${path}/`);
    });
    return partial?.label ?? "Select tool";
  })();

  const closeMenus = () => {
    setProjectsOpen(false);
    setToolsOpen(false);
    setProfileOpen(false);
  };

  useEffect(() => {
    if (!projectsOpen && !toolsOpen && !profileOpen) return;
    const handleClick = (event: MouseEvent) => {
      const target = event.target as Node;
      if (projectsRef.current && !projectsRef.current.contains(target)) setProjectsOpen(false);
      if (toolsRef.current && !toolsRef.current.contains(target)) setToolsOpen(false);
      if (profileRef.current && !profileRef.current.contains(target)) setProfileOpen(false);
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [projectsOpen, toolsOpen, profileOpen]);

  const filteredProjects = useMemo(() => {
    const query = projectSearch.trim().toLowerCase();
    if (!query) return projectsForNav;
    return projectsForNav.filter((project) => {
      const haystack = `${project.project_number ?? ""} ${project.name} ${project.city ?? ""}`.toLowerCase();
      return haystack.includes(query);
    });
  }, [projectSearch, projectsForNav]);

  const recentProjects = recentProjectIds
    .map((id) => projectsForNav.find((project) => project.id === id))
    .filter((project): project is ProjectRow => Boolean(project));

  const allProjects = filteredProjects.filter((project) => !recentProjectIds.includes(project.id));

  const homeHref = withContext(mode === "waiverdesk" ? "/waiverdesk/dashboard" : "/dashboard");
  const activeProjectLabel = activeProject ? projectLabel(activeProject) : "No project selected";

  useEffect(() => {
    if (!switchToast) return;
    const timer = window.setTimeout(() => setSwitchToast(null), 3500);
    return () => window.clearTimeout(timer);
  }, [switchToast]);

  useEffect(() => {
    let active = true;
    async function loadBidProjectsForNav() {
      const rows = await listBidProjects();
      if (!active) return;
      setBidProjectsForNav(
        rows.map((project) => ({
          id: project.id,
          project_number: "BID",
          name: project.project_name,
          city: project.location ?? null,
          health: "on_track",
          start_date: null,
          end_date: project.due_date ?? null,
          contracted_value: project.budget ?? 0,
          estimated_profit: 0,
          estimated_buyout: 0,
          updated_at: new Date().toISOString(),
        }))
      );
    }
    loadBidProjectsForNav();
    return () => {
      active = false;
    };
  }, []);

  const selectProjectContext = (projectId: string) => {
    const previousProjectId = activeProjectId ?? null;
    if (previousProjectId === projectId) {
      closeMenus();
      return;
    }
    const nextRecent = [projectId, ...recentProjectIds.filter((id) => id !== projectId)].slice(0, 5);
    setRecentProjectIds(nextRecent);
    localStorage.setItem(ACTIVE_PROJECT_STORAGE_KEY, projectId);
    localStorage.setItem(RECENT_PROJECTS_STORAGE_KEY, JSON.stringify(nextRecent));
    const selectedProject = projectsForNav.find((project) => project.id === projectId);
    const selectedLabel = selectedProject ? selectedProject.name : "project";
    setSwitchToast({
      message: `Switched to ${selectedLabel}`,
      previousProjectId,
      nextProjectId: projectId,
    });
    router.replace(buildContextUrl(pathname, new URLSearchParams(searchParams.toString()), projectId));
    closeMenus();
  };

  return (
    <header className="sticky top-0 z-20 w-full border-b border-white/10 bg-[color:var(--brand)] text-white">
      <div className="px-4 py-3 md:px-6">
        <div className="flex flex-wrap items-center gap-2 md:flex-nowrap">
          <Link href={homeHref} className="min-w-fit rounded-lg px-2 py-1.5 hover:bg-white/10">
            <span className="text-xs uppercase tracking-widest text-white/70">{mode === "waiverdesk" ? "WD" : "GC"}</span>
            <div className="text-base font-semibold">{mode === "waiverdesk" ? "WaiverDesk" : "Dashboard"}</div>
          </Link>

          <div className="relative min-w-[220px] flex-1 md:max-w-[360px]" ref={projectsRef}>
            <button
              type="button"
              onClick={() => setProjectsOpen((open) => !open)}
              className="flex w-full items-center justify-between rounded-lg border border-white/20 bg-white/5 px-3 py-2 text-left text-sm"
            >
              <span className="truncate">{activeProjectLabel}</span>
              <span className="text-xs opacity-70">▾</span>
            </button>
            {projectsOpen ? (
              <div className="absolute left-0 top-full z-30 mt-1 max-h-[28rem] w-full overflow-auto rounded-lg border border-[#E5E7EB] bg-white p-2 text-black shadow-[0_10px_25px_rgba(0,0,0,0.12)]">
                <input
                  value={projectSearch}
                  onChange={(event) => setProjectSearch(event.target.value)}
                  className="mb-2 w-full rounded-md border border-black/15 px-3 py-2 text-sm"
                  placeholder="Search projects..."
                  aria-label="Search projects"
                />

                <div className="mb-1 px-1 text-xs font-semibold uppercase tracking-wide text-black/45">Recent projects</div>
                {recentProjects.length ? (
                  <div className="space-y-1">
                    {recentProjects.map((project) => {
                      const status = statusMeta(project);
                      return (
                        <button
                          key={`recent-${project.id}`}
                          type="button"
                          onClick={() => selectProjectContext(project.id)}
                          className={`w-full rounded-md border px-2 py-2 text-left hover:bg-black/[0.04] ${
                            activeProjectId === project.id ? "border-black/25 bg-black/[0.03]" : "border-transparent"
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="truncate text-sm font-medium">{projectLabel(project)}</div>
                            <span className={`rounded-full border px-2 py-0.5 text-xs ${status.className}`}>{status.label}</span>
                          </div>
                          <div className="mt-0.5 truncate text-xs text-black/55">
                            {project.city ?? "City TBD"} • Client TBD
                          </div>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div className="mb-2 rounded-md px-2 py-2 text-sm text-black/55">No recent projects</div>
                )}

                <div className="my-2 border-t border-black/10" />
                <div className="mb-1 px-1 text-xs font-semibold uppercase tracking-wide text-black/45">All projects</div>
                <button
                  type="button"
                  onClick={() => {
                    closeMenus();
                    router.push("/bidding/all");
                  }}
                  className="mb-1 w-full rounded-md px-2 py-2 text-left text-sm hover:bg-black/[0.04]"
                >
                  View All Bids
                </button>
                <div className="space-y-1">
                  {allProjects.length ? (
                    allProjects.map((project) => {
                      const status = statusMeta(project);
                      return (
                        <button
                          key={project.id}
                          type="button"
                          onClick={() => selectProjectContext(project.id)}
                          className={`w-full rounded-md border px-2 py-2 text-left hover:bg-black/[0.04] ${
                            activeProjectId === project.id ? "border-black/25 bg-black/[0.03]" : "border-transparent"
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="truncate text-sm font-medium">{projectLabel(project)}</div>
                            <span className={`rounded-full border px-2 py-0.5 text-xs ${status.className}`}>{status.label}</span>
                          </div>
                          <div className="mt-0.5 truncate text-xs text-black/55">
                            {project.city ?? "City TBD"} • Client TBD
                          </div>
                        </button>
                      );
                    })
                  ) : (
                    <div className="rounded-md px-2 py-2 text-sm text-black/55">No projects match your search</div>
                  )}
                </div>
              </div>
            ) : null}
          </div>

          <div className="relative min-w-[180px] flex-1 md:max-w-[260px]" ref={toolsRef}>
            <button
              type="button"
              onClick={() => setToolsOpen((open) => !open)}
              className="flex w-full items-center justify-between rounded-lg border border-white/20 bg-white/5 px-3 py-2 text-left text-sm"
            >
              <span className="truncate">{currentToolLabel}</span>
              <span className="text-xs opacity-70">▾</span>
            </button>
            {toolsOpen ? (
              <div className="absolute left-0 top-full z-30 mt-1 w-[min(42rem,calc(100vw-2rem))] max-w-[calc(100vw-2rem)] rounded-lg border border-[#E5E7EB] bg-white p-4 text-black shadow-[0_10px_25px_rgba(0,0,0,0.12)]">
                <div className="mb-3 flex items-center justify-between border-b border-black/10 pb-3">
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-wider text-black/45">Tools</div>
                    <div className="text-sm font-semibold text-black/85">Choose a workspace</div>
                  </div>
                  {activeProject ? (
                    <div className="max-w-[14rem] truncate text-xs text-black/60">Project: {projectLabel(activeProject)}</div>
                  ) : null}
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  {toolSections.map((section) => (
                    <div key={section.title} className="rounded-md border border-black/10 bg-black/[0.015] p-2">
                      <div className="px-2 py-1 text-xs font-semibold uppercase tracking-wide text-black/45">
                        {section.title}
                      </div>
                      <div className="space-y-1">
                        {section.items.map((tool) => (
                          <Link
                            key={`${section.title}-${tool.label}`}
                            href={tool.href}
                            onClick={() => {
                              if (section.kind === "company") clearProjectContext();
                              closeMenus();
                            }}
                            className="block rounded-md px-2 py-2 hover:bg-black/[0.04]"
                          >
                            <div className="text-sm font-medium text-black/90">{tool.label}</div>
                            <div className="mt-0.5 text-xs text-black/55">{tool.description}</div>
                          </Link>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>

          <form
            className="min-w-[220px] flex-1"
            onSubmit={(event) => {
              event.preventDefault();
              const query = searchQuery.trim();
              if (!query) return;
              closeMenus();
              router.push(withContext(`/search?q=${encodeURIComponent(query)}`));
            }}
          >
            <input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              className="w-full rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-sm text-white placeholder:text-white/65"
              placeholder="Search projects, subs, bids, docs..."
              aria-label="Global Search"
            />
          </form>

          <div className="relative ml-auto flex min-w-fit items-center gap-2" ref={profileRef}>
            <button
              type="button"
              className="relative rounded-lg border border-white/20 px-3 py-2 text-sm"
              aria-label="Notifications"
            >
              🔔
              {hasUnreadNotifications ? (
                <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-primary ring-2 ring-[color:var(--brand)]" />
              ) : null}
            </button>
            <button
              type="button"
              onClick={() => setProfileOpen((open) => !open)}
              className="flex items-center gap-2 rounded-lg border border-white/20 px-3 py-2 text-sm"
            >
              Profile
              <span className="text-xs opacity-70">▾</span>
            </button>
            {profileOpen ? (
              <div className="absolute right-0 top-full z-30 mt-1 min-w-[180px] rounded-lg border border-[#E5E7EB] bg-white p-2 text-black shadow-[0_10px_25px_rgba(0,0,0,0.12)]">
                <Link href={withContext("/profile")} onClick={closeMenus} className="block rounded px-2 py-2 text-sm hover:bg-black/[0.04]">
                  Profile
                </Link>
                <Link
                  href={withContext("/settings")}
                  onClick={closeMenus}
                  className="block rounded px-2 py-2 text-sm hover:bg-black/[0.04]"
                >
                  Settings
                </Link>
                <Link
                  href={withContext("/logout")}
                  onClick={closeMenus}
                  className="block rounded px-2 py-2 text-sm hover:bg-black/[0.04]"
                >
                  Log out
                </Link>
              </div>
            ) : null}
          </div>
        </div>
      </div>
      {activeProject && activeProjectIsRegular ? (
        <div className="border-t border-white/10 bg-white/95 text-slate-800 backdrop-blur">
          <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2 md:px-6">
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold text-slate-900">{activeProject.name}</div>
              <div className="truncate text-xs text-slate-600">
                Client TBD • Due {formatDateLabel(activeProject.end_date)} •{" "}
                <span className="font-medium">{statusMeta(activeProject).label}</span>
              </div>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <Link
                href={withContext(`/projects/${activeProject.id}/drawings`)}
                className="rounded-md border border-slate-200 bg-white px-2.5 py-1.5 font-medium text-slate-700 hover:bg-slate-50"
              >
                Docs
              </Link>
              <Link
                href={withContext(`/projects/${activeProject.id}/directory`)}
                className="rounded-md border border-slate-200 bg-white px-2.5 py-1.5 font-medium text-slate-700 hover:bg-slate-50"
              >
                Contacts
              </Link>
              <Link
                href={withContext(`/projects/${activeProject.id}`)}
                className="rounded-md border border-slate-200 bg-white px-2.5 py-1.5 font-medium text-slate-700 hover:bg-slate-50"
              >
                Activity
              </Link>
            </div>
          </div>
        </div>
      ) : null}
      {switchToast ? (
        <div className="pointer-events-none fixed bottom-5 right-5 z-40">
          <div className="pointer-events-auto flex items-center gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 shadow-lg">
            <span>{switchToast.message}</span>
            {switchToast.previousProjectId ? (
              <button
                type="button"
                onClick={() => {
                  const previousProjectId = switchToast.previousProjectId;
                  if (!previousProjectId) return;
                  const nextRecent = [previousProjectId, ...recentProjectIds.filter((id) => id !== previousProjectId)].slice(
                    0,
                    5
                  );
                  setRecentProjectIds(nextRecent);
                  localStorage.setItem(ACTIVE_PROJECT_STORAGE_KEY, previousProjectId);
                  localStorage.setItem(RECENT_PROJECTS_STORAGE_KEY, JSON.stringify(nextRecent));
                  router.replace(buildContextUrl(pathname, new URLSearchParams(searchParams.toString()), previousProjectId));
                  setSwitchToast(null);
                }}
                className="rounded-md px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100"
              >
                Undo
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => setSwitchToast(null)}
              className="rounded-md px-2 py-1 text-xs text-slate-500 hover:bg-slate-100"
              aria-label="Dismiss project switch notification"
            >
              Dismiss
            </button>
          </div>
        </div>
      ) : null}
    </header>
  );
}
