"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  buildEstimatePdf,
  readEstimateExportSnapshot,
} from "@/lib/bidding/estimate-export";
import { getBidProjectIdForProject } from "@/lib/bidding/project-links";

export default function EstimateExportViewer() {
  const searchParams = useSearchParams();
  const queryProjectId = searchParams.get("project");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const projectId =
      getBidProjectIdForProject(queryProjectId ?? "") ?? queryProjectId ?? "";
    if (!projectId) {
      setError("Missing project id.");
      return;
    }
    const snapshot = readEstimateExportSnapshot(projectId);
    if (!snapshot) {
      setError("No export data found. Return to the estimate page and try Export again.");
      return;
    }

    const bytes = buildEstimatePdf(snapshot);
    const blob = new Blob([bytes], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);
    window.location.replace(url);
    return () => {
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    };
  }, [queryProjectId]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 p-6">
      <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-lg font-semibold text-slate-900">Preparing estimate export</h1>
        <p className="mt-2 text-sm text-slate-600">
          {error ?? "Building PDF and opening it in the browser viewer..."}
        </p>
      </div>
    </main>
  );
}
