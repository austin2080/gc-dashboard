"use client";

import { useCallback, useEffect, useState } from "react";
import type { DirectoryData } from "@/lib/directory/types";

type DirectoryState = {
  data: DirectoryData | null;
  loading: boolean;
  error: string;
  refresh: () => Promise<void>;
};

export function useDirectoryData(): DirectoryState {
  const [data, setData] = useState<DirectoryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/directory/overview", { cache: "no-store" });
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        const message = payload?.error ?? "Failed to load directory.";
        if (typeof message === "string" && message.toLowerCase().includes("membership")) {
          setData({ companies: [], projects: [], projectCompanies: [] });
          return;
        }
        throw new Error(message);
      }
      const payload = (await res.json()) as DirectoryData;
      setData(payload);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load directory.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { data, loading, error, refresh };
}
