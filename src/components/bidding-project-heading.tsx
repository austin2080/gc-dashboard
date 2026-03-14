"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { listBidProjects } from "@/lib/bidding/store";
import { getBidProjectIdForProject } from "@/lib/bidding/project-links";
import type { BidProjectSummary } from "@/lib/bidding/types";

export default function BiddingProjectHeading() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryProjectId = searchParams.get("project");
  const [projects, setProjects] = useState<BidProjectSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    async function loadProjects() {
      setLoading(true);
      const rows = await listBidProjects();
      if (!active) return;
      setProjects(rows);
      setLoading(false);
    }
    loadProjects();
    return () => {
      active = false;
    };
  }, []);

  const selectedProject = useMemo(() => {
    if (!projects.length) return null;
    if (!queryProjectId) return projects[0] ?? null;
    const mappedBidProjectId = getBidProjectIdForProject(queryProjectId);
    return (
      projects.find((project) => project.id === mappedBidProjectId) ??
      projects.find((project) => project.id === queryProjectId) ??
      null
    );
  }, [projects, queryProjectId]);

  const title = useMemo(() => {
    if (!projects.length) return "Bid Management";
    return selectedProject?.project_name ?? "Bid Management";
  }, [projects, selectedProject]);

  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <h1 className="text-3xl font-semibold text-slate-900">
        {loading ? "Loading..." : title}
      </h1>
      {selectedProject ? (
        <button
          type="button"
          onClick={() => router.push(`/bidding/all/new?project=${selectedProject.id}`)}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-100 px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-200"
        >
          Edit Project
        </button>
      ) : null}
    </div>
  );
}
