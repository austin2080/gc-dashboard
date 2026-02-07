"use client";

import { useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";

type TabKey = "overview" | "waivers";

export default function WaiverDeskProjectsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const activeTab = useMemo<TabKey>(() => {
    const tab = searchParams.get("tab");
    return tab === "waivers" ? "waivers" : "overview";
  }, [searchParams]);

  const setTab = (tab: TabKey) => {
    const next = new URLSearchParams(searchParams.toString());
    if (tab === "overview") next.delete("tab");
    else next.set("tab", tab);
    const query = next.toString();
    router.push(`/waiverdesk/projects${query ? `?${query}` : ""}`);
  };

  return (
    <main className="p-6 space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Projects</h1>
        <p className="text-sm text-[color:var(--muted,#65758b)]">
          Track waiver compliance and exposure at the project level.
        </p>
      </header>

      <div className="flex flex-wrap items-center gap-2">
        {([
          { key: "overview", label: "Overview" },
          { key: "waivers", label: "Lien Waivers" },
        ] as const).map((tab) => {
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setTab(tab.key)}
              className={`rounded-full border px-4 py-1.5 text-sm transition-colors ${
                isActive
                  ? "border-black bg-black text-white"
                  : "border-black/20 text-black/70 hover:bg-black/[0.03]"
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {activeTab === "overview" ? (
        <section className="rounded-lg border border-black/10 bg-white p-4 text-sm text-black/70">
          Project-level waiver overview will appear here.
        </section>
      ) : (
        <section className="rounded-lg border border-black/10 bg-white p-4 text-sm text-black/70">
          Lien waiver records by project will appear here.
        </section>
      )}
    </main>
  );
}
