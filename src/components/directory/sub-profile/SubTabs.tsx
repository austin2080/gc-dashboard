"use client";

type SubTab = "overview" | "waivers" | "bids" | "documents" | "activity";

const TABS: Array<{ id: SubTab; label: string }> = [
  { id: "overview", label: "Overview" },
  { id: "waivers", label: "Waivers" },
  { id: "bids", label: "Bids" },
  { id: "documents", label: "Documents" },
  { id: "activity", label: "Activity" },
];

type Props = {
  activeTab: SubTab;
  onChange: (tab: SubTab) => void;
};

export type { SubTab };

export default function SubTabs({ activeTab, onChange }: Props) {
  return (
    <nav className="sticky top-0 z-20 rounded-xl border border-black/10 bg-white/95 p-2 backdrop-blur">
      <ul className="flex flex-wrap items-center gap-1">
        {TABS.map((tab) => {
          const active = tab.id === activeTab;
          return (
            <li key={tab.id}>
              <button
                type="button"
                onClick={() => onChange(tab.id)}
                className={`rounded-lg px-3 py-2 text-sm transition-colors ${
                  active
                    ? "bg-black text-white"
                    : "text-black/70 hover:bg-black/[0.05] hover:text-black"
                }`}
              >
                {tab.label}
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
