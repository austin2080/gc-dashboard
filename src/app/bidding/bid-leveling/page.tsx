"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import BiddingTabPageHeader from "@/components/bidding-tab-page-header";
import LevelingPage from "@/components/bid-leveling/LevelingPage";
import LevelingPageV2 from "@/components/bid-leveling/LevelingPageV2";

type LevelingLayoutMode = "classic" | "v2";

export default function BidLevelingPage() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const layoutParam = searchParams.get("layout");
  const activeLayout: LevelingLayoutMode = layoutParam === "classic" ? "classic" : "v2";

  const setLayout = (nextLayout: LevelingLayoutMode) => {
    const params = new URLSearchParams(searchParams.toString());
    if (nextLayout === "v2") {
      params.delete("layout");
    } else {
      params.set("layout", nextLayout);
    }
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  };

  return (
    <main className="space-y-6 bg-slate-50 px-4 pb-4 pt-[2px] sm:px-6 sm:pb-6 sm:pt-[2px]">
      <BiddingTabPageHeader label="Leveling" />
      <section className="flex justify-end px-0 py-0">
        <div className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-transparent p-1">
          <button
            type="button"
            onClick={() => setLayout("classic")}
            className={`rounded-md px-3 py-1.5 text-sm font-semibold ${
              activeLayout === "classic" ? "bg-slate-900 text-white" : "text-slate-700 hover:bg-white"
            }`}
          >
            Classic
          </button>
          <button
            type="button"
            onClick={() => setLayout("v2")}
            className={`rounded-md px-3 py-1.5 text-sm font-semibold ${
              activeLayout === "v2" ? "bg-slate-900 text-white" : "text-slate-700 hover:bg-white"
            }`}
          >
            V2
          </button>
        </div>
      </section>
      {activeLayout === "v2" ? <LevelingPageV2 /> : <LevelingPage />}
    </main>
  );
}
