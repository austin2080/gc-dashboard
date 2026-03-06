"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { listBidProjects } from "@/lib/bidding/store";
import { getBidProjectIdForProject } from "@/lib/bidding/project-links";
import type { BidProjectSummary } from "@/lib/bidding/types";

export default function BiddingProjectHeading() {
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

  const title = useMemo(() => {
    if (!projects.length) return "Bid Management";
    if (!queryProjectId) return projects[0]?.project_name ?? "Bid Management";
    const mappedBidProjectId = getBidProjectIdForProject(queryProjectId);
    const selected =
      projects.find((project) => project.id === mappedBidProjectId) ??
      projects.find((project) => project.id === queryProjectId) ??
      null;
    return selected?.project_name ?? "Bid Management";
  }, [projects, queryProjectId]);

  return (
    <h1 className="text-3xl font-semibold text-slate-900">
      {loading ? "Loading..." : title}
    </h1>
  );
}
