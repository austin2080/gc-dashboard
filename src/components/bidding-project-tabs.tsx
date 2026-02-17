"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
type SelectableProject = {
  id: string;
  name: string;
  end_date: string | null;
};

function daysUntil(isoDate: string): number {
  if (!isoDate) return 0;
  const today = new Date();
  const due = new Date(`${isoDate}T00:00:00`);
  const msPerDay = 1000 * 60 * 60 * 24;
  const todayMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  return Math.max(0, Math.ceil((due.getTime() - todayMidnight) / msPerDay));
}

export default function BiddingProjectTabs() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryProjectId = searchParams.get("project");
  const [projects, setProjects] = useState<SelectableProject[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    async function loadProjects() {
      setLoading(true);
      try {
        const response = await fetch("/api/projects/selectable", { cache: "no-store" });
        const payload = (await response.json().catch(() => null)) as { projects?: SelectableProject[] } | null;
        if (!active) return;
        setProjects(Array.isArray(payload?.projects) ? payload.projects : []);
      } catch {
        if (!active) return;
        setProjects([]);
      }
      setLoading(false);
    }
    loadProjects();
    return () => {
      active = false;
    };
  }, []);

  const selectedProjectId = useMemo(() => {
    if (!projects.length) return "";
    if (queryProjectId && projects.some((project) => project.id === queryProjectId)) {
      return queryProjectId;
    }
    return projects[0].id;
  }, [projects, queryProjectId]);

  if (loading) {
    return (
      <section className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-500 shadow-sm">
        Loading projects...
      </section>
    );
  }

  if (!projects.length) return null;

  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-100/80 p-2">
      <div className="flex flex-wrap gap-2">
        {projects.map((project) => {
          const active = project.id === selectedProjectId;
          const countdown = project.end_date ? `${daysUntil(project.end_date)}d` : "--";
          return (
            <button
              key={project.id}
              type="button"
              onClick={() => {
                const next = new URLSearchParams(searchParams.toString());
                next.set("project", project.id);
                router.replace(`${pathname}?${next.toString()}`, { scroll: false });
              }}
              className={`inline-flex items-center gap-3 rounded-xl border px-4 py-2 text-sm font-semibold transition ${
                active
                  ? "border-slate-300 bg-white text-slate-900 shadow-sm"
                  : "border-transparent bg-transparent text-slate-500 hover:border-slate-200 hover:bg-white/60"
              }`}
            >
              {project.name}
              <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs text-slate-700">
                {countdown}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
