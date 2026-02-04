"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo, useState, useEffect, useRef } from "react";
import type { ProjectRow } from "@/lib/db/projects";

const GLOBAL_TOOLS = [
  { label: "Home", href: "/dashboard" },
  { label: "All Projects", href: "/projects" },
  { label: "Main Directory", href: "/directory" },
  { label: "Permissions", href: "/permissions" },
  { label: "Workflows", href: "/workflows" },
  { label: "Documents", href: "/documents" },
  { label: "Financials", href: "/financials" },
  { label: "ERP Integrations", href: "/integrations" },
  { label: "Admin", href: "/admin" },
];

const PROJECT_TOOL_GROUPS = [
  {
    title: "Directory",
    description: "People and companies tied to the project",
    items: [
      { label: "Project Contacts", path: "directory" },
      { label: "Subcontractors", path: "subcontractors" },
      { label: "Consultants", path: "consultants" },
    ],
  },
  {
    title: "Project Management",
    description: "Day-to-day execution and coordination tools",
    items: [
      { label: "RFIs", path: "rfis" },
      { label: "Submittals", path: "submittals" },
      { label: "Commitments", path: "commitments" },
      { label: "Schedule", path: "schedule" },
      { label: "Daily Log", path: "daily-log" },
      { label: "Meeting Minutes", path: "meeting-minutes" },
    ],
  },
  {
    title: "Plans & Specs",
    description: "Issued documents and design references",
    items: [
      { label: "Drawings", path: "drawings" },
      { label: "Specifications", path: "specifications" },
    ],
  },
  {
    title: "Documents",
    description: "Non-plan files and project records",
    items: [
      { label: "Project Files", path: "documents" },
      { label: "Uploads", path: "uploads" },
      { label: "Revisions", path: "revisions" },
    ],
  },
  {
    title: "Financials",
    description: "Anything that affects money, contracts, and cost tracking",
    items: [
      { label: "Budget", path: "budget" },
      { label: "Direct Costs", path: "direct-costs" },
      { label: "Buyout", path: "buyout" },
      { label: "Change Events", path: "change-events" },
      { label: "Change Orders", path: "change-orders" },
      { label: "Pay Apps / Invoicing", path: "pay-apps" },
      { label: "Prime Contract", path: "contract" },
    ],
  },
  {
    title: "Field",
    description: "Visual and on-site documentation",
    items: [
      { label: "Photos", path: "photos" },
      { label: "Safety", path: "safety" },
      { label: "Inspections", path: "inspections" },
      { label: "Punch List", path: "punch-list" },
    ],
  },
];

export default function TopNavClient({ projects }: { projects: ProjectRow[] }) {
  const pathname = usePathname();
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const [toolsOpen, setToolsOpen] = useState(false);
  const [projectsOpen, setProjectsOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const hasUnreadNotifications = true;
  const toolsRef = useRef<HTMLDivElement | null>(null);
  const projectsRef = useRef<HTMLDivElement | null>(null);
  const profileRef = useRef<HTMLDivElement | null>(null);

  const activeProject = useMemo(() => {
    const match = pathname.match(/^\/projects\/([^/]+)/);
    if (!match) return null;
    return projects.find((p) => p.id === match[1]) ?? null;
  }, [pathname, projects]);

  const projectLinks = projects.map((p) => ({
    label: p.project_number ? `${p.project_number} - ${p.name}` : p.name,
    href: `/projects/${p.id}`,
  }));

  const hasActiveProject = Boolean(activeProject);
  const projectContextLabel = hasActiveProject
    ? activeProject.project_number
      ? `${activeProject.project_number} - ${activeProject.name}`
      : activeProject.name
    : "No project selected";

  const closeAllMenus = () => {
    setToolsOpen(false);
    setProjectsOpen(false);
    setProfileOpen(false);
  };

  useEffect(() => {
    if (!toolsOpen && !projectsOpen && !profileOpen) return;
    const handleClick = (event: MouseEvent) => {
      const target = event.target as Node;
      if (toolsRef.current && !toolsRef.current.contains(target)) {
        setToolsOpen(false);
      }
      if (projectsRef.current && !projectsRef.current.contains(target)) {
        setProjectsOpen(false);
      }
      if (profileRef.current && !profileRef.current.contains(target)) {
        setProfileOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [toolsOpen, projectsOpen, profileOpen]);

  return (
    <header className="sticky top-0 z-20 w-full border-b border-white/10 bg-[color:var(--brand)] text-white">
      <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-3">
        <div className="flex flex-wrap items-center gap-3">
          <Link href="/dashboard" className="flex items-center gap-2">
            <div className="text-xs uppercase tracking-widest opacity-70">GC</div>
            <div className="text-xl font-semibold">Dashboard</div>
          </Link>

          <div className="flex items-center gap-2">
            <div className="relative" ref={projectsRef}>
              <button
                className={`rounded-full px-3 py-1 text-base cursor-pointer flex items-center gap-2 ${
                  hasActiveProject
                    ? "border border-white/20"
                    : "border border-white/15 bg-white/[0.04] text-white/70"
                }`}
                type="button"
                onClick={() => setProjectsOpen((open) => !open)}
              >
                {projectContextLabel}
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  className="h-3 w-3 opacity-60"
                >
                  <path d="m6 9 6 6 6-6" />
                </svg>
              </button>
              {projectsOpen ? (
                <div className="absolute left-0 top-full z-30 min-w-[260px] rounded-md border border-black/10 bg-white p-2 text-black/80 shadow-sm">
                <div className="px-2 py-1 text-sm uppercase tracking-wide text-black/50">Active Project</div>
                <Link
                  href="/projects"
                  onClick={closeAllMenus}
                  className="block rounded px-2 py-1 text-base font-medium text-black/90 hover:bg-black/[0.03]"
                >
                  View all projects
                </Link>
                <div className="my-1 border-t border-black/10" />
                {projectLinks.length ? (
                  projectLinks.map((child) => (
                    <Link
                      key={child.href}
                      href={child.href}
                      onClick={closeAllMenus}
                      className="block rounded px-2 py-1 text-base text-black/80 hover:bg-black/[0.03]"
                    >
                      {child.label}
                    </Link>
                  ))
                ) : (
                  <div className="px-2 py-1 text-base text-black/60">No active projects yet</div>
                )}
              </div>
              ) : null}
            </div>
            <div className="relative" ref={toolsRef}>
              <button
                className="rounded-full border border-white/20 px-3 py-1 text-base cursor-pointer flex items-center gap-2"
                type="button"
                onClick={() => setToolsOpen((open) => !open)}
              >
                {activeProject ? "Project Tools" : "Company Tools"}
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  className="h-3 w-3 opacity-60"
                >
                  <path d="m6 9 6 6 6-6" />
                </svg>
              </button>
              {toolsOpen ? (
                <div className="fixed left-0 right-0 top-16 z-30">
                  <div className="mx-6 rounded-2xl border border-black/10 bg-white p-5 text-black/80 shadow-xl">
                    <div className="px-2 py-2">
                    <div className="text-sm uppercase tracking-wide text-black/50">
                      {activeProject ? "Project Tools" : "Company Tools"}
                    </div>
                    <div className="text-base font-semibold text-black/90">
                      {activeProject ? projectContextLabel : "Company Overview"}
                    </div>
                  </div>
                  {activeProject ? (
                    <div className="grid grid-cols-3 gap-4">
                      {PROJECT_TOOL_GROUPS.map((group) => (
                        <div key={group.title} className="space-y-2">
                          <div>
                            <div className="text-sm font-semibold uppercase tracking-wide">
                              {group.title}
                            </div>
                            <div className="text-xs text-black/60 mt-1">
                              {group.description}
                            </div>
                          </div>
                          <div className="space-y-1">
                            {group.items.map((item) => (
                              <Link
                                key={item.label}
                                href={`/projects/${activeProject.id}/${item.path}`}
                                onClick={closeAllMenus}
                                className="block rounded px-2 py-1 text-sm text-black/80 hover:bg-black/[0.03]"
                              >
                                {item.label}
                              </Link>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-2">
                      {GLOBAL_TOOLS.map((tool) => (
                      <Link
                        key={tool.label}
                        href={tool.href}
                        onClick={closeAllMenus}
                        className="rounded-lg px-3 py-2 text-xs font-medium text-black/80 hover:bg-black/[0.03]"
                      >
                        {tool.label}
                      </Link>
                      ))}
                    </div>
                  )}
                  </div>
                </div>
              ) : null}
            </div>
          </div>

        </div>

        <div className="flex flex-1 flex-wrap items-center justify-end gap-2">
          <button
            type="button"
            onClick={() => setMobileSearchOpen((v) => !v)}
            className="rounded-xl border border-white/20 px-3 py-2 text-base md:hidden"
            aria-label="Toggle search"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="h-4 w-4"
            >
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.5-3.5" />
            </svg>
          </button>
          <div className="hidden min-w-[220px] max-w-[360px] flex-1 md:block">
            <input
              className="w-full rounded-xl border border-white/20 bg-white/10 px-4 py-2 text-base text-white placeholder:text-white/60"
              placeholder="Quick search projects, contracts, RFIs..."
            />
          </div>

          <button
            className="relative rounded-full border border-white/20 px-3 py-2 text-base cursor-pointer"
            aria-label="Notifications"
          >
            🔔
            {hasUnreadNotifications ? (
              <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-primary ring-2 ring-[color:var(--brand)]" />
            ) : null}
          </button>

          <div className="relative" ref={profileRef}>
            <button
              className="rounded-full border border-white/20 px-3 py-2 text-base cursor-pointer flex items-center gap-2"
              type="button"
              onClick={() => setProfileOpen((open) => !open)}
            >
              Profile
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className="h-3 w-3 opacity-60"
              >
                <path d="m6 9 6 6 6-6" />
              </svg>
            </button>
            {profileOpen ? (
              <div className="absolute right-0 top-full z-30 min-w-[180px] rounded-md border border-black/10 bg-white p-2 text-black/80 shadow-sm">
                <Link
                  href="/profile"
                  onClick={closeAllMenus}
                  className="block rounded px-2 py-1 text-base text-black/80 hover:bg-black/[0.03]"
                >
                  Profile
                </Link>
                <Link
                  href="/settings"
                  onClick={closeAllMenus}
                  className="block rounded px-2 py-1 text-base text-black/80 hover:bg-black/[0.03]"
                >
                  Settings
                </Link>
                <Link
                  href="/logout"
                  onClick={closeAllMenus}
                  className="block rounded px-2 py-1 text-base text-black/80 hover:bg-black/[0.03]"
                >
                  Log out
                </Link>
              </div>
            ) : null}
          </div>
        </div>
        {mobileSearchOpen ? (
          <div className="w-full md:hidden">
            <input
              className="w-full rounded-xl border border-white/20 bg-white/10 px-4 py-2 text-base text-white placeholder:text-white/60"
              placeholder="Quick search projects, contracts, RFIs..."
            />
          </div>
        ) : null}
      </div>
    </header>
  );
}
