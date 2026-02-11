type SubBidStatus = "bidding" | "declined" | "ghosted";

type TradeBid = {
  trade: string;
  subcontractor: string;
  status: SubBidStatus;
};

type BidProject = {
  id: string;
  projectName: string;
  dueDate: string;
  estimator: string;
  region: string;
  trades: TradeBid[];
};

const activeProjects: BidProject[] = [
  {
    id: "bid-421",
    projectName: "Northside Health Center TI",
    dueDate: "2026-02-16",
    estimator: "Monica Reyes",
    region: "Houston, TX",
    trades: [
      { trade: "Electrical", subcontractor: "Axis Electric", status: "bidding" },
      { trade: "Electrical", subcontractor: "Brightline Power", status: "ghosted" },
      { trade: "Plumbing", subcontractor: "FlowCore Mechanical", status: "bidding" },
      { trade: "Plumbing", subcontractor: "Metro Pipe Works", status: "declined" },
      { trade: "Drywall", subcontractor: "FrameRight Interiors", status: "bidding" },
      { trade: "Drywall", subcontractor: "Summit Wall Systems", status: "ghosted" },
    ],
  },
  {
    id: "bid-422",
    projectName: "Riverwalk Hotel Renovation",
    dueDate: "2026-02-21",
    estimator: "Aaron Patel",
    region: "San Antonio, TX",
    trades: [
      { trade: "Electrical", subcontractor: "Cobalt Electric", status: "bidding" },
      { trade: "Electrical", subcontractor: "Delta Voltage", status: "declined" },
      { trade: "HVAC", subcontractor: "AirGrid Solutions", status: "bidding" },
      { trade: "HVAC", subcontractor: "Lone Star Climate", status: "bidding" },
      { trade: "Flooring", subcontractor: "Stonebridge Flooring", status: "ghosted" },
      { trade: "Flooring", subcontractor: "Oakline Surfaces", status: "bidding" },
    ],
  },
  {
    id: "bid-423",
    projectName: "Westbrook Elementary Addition",
    dueDate: "2026-02-28",
    estimator: "Gabriela Kim",
    region: "Plano, TX",
    trades: [
      { trade: "Sitework", subcontractor: "Pioneer Civil", status: "bidding" },
      { trade: "Sitework", subcontractor: "TerraMark Excavation", status: "ghosted" },
      { trade: "Concrete", subcontractor: "Anchor Concrete", status: "bidding" },
      { trade: "Concrete", subcontractor: "RedRock Ready Mix", status: "declined" },
      { trade: "Roofing", subcontractor: "Pinnacle Roofing", status: "bidding" },
      { trade: "Roofing", subcontractor: "Skyline Roofing", status: "ghosted" },
    ],
  },
];

const statusStyles: Record<SubBidStatus, string> = {
  bidding: "bg-emerald-100 text-emerald-800 border-emerald-200",
  declined: "bg-rose-100 text-rose-800 border-rose-200",
  ghosted: "bg-amber-100 text-amber-900 border-amber-200",
};

const statusLabels: Record<SubBidStatus, string> = {
  bidding: "Bidding",
  declined: "Declined",
  ghosted: "Ghosted",
};

function toDisplayDate(isoDate: string): string {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(
    new Date(isoDate + "T00:00:00")
  );
}

function daysUntil(isoDate: string): number {
  const today = new Date();
  const due = new Date(isoDate + "T00:00:00");
  const msPerDay = 1000 * 60 * 60 * 24;
  const todayMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  return Math.ceil((due.getTime() - todayMidnight) / msPerDay);
}

export default function BiddingPage() {
  const tradeRows = Array.from(
    activeProjects
      .flatMap((project) =>
        project.trades.map((tradeBid) => ({
          projectName: project.projectName,
          dueDate: project.dueDate,
          ...tradeBid,
        }))
      )
      .reduce((map, item) => {
        const current = map.get(item.trade) ?? [];
        current.push(item);
        map.set(item.trade, current);
        return map;
      }, new Map<string, Array<{ projectName: string; dueDate: string; subcontractor: string; status: SubBidStatus }>>())
  ).sort(([tradeA], [tradeB]) => tradeA.localeCompare(tradeB));

  return (
    <main className="p-6 space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold">Active Bidding Board</h1>
        <p className="text-sm text-gray-600 max-w-4xl">
          Track your active bids, due dates, and subcontractor responses. The trade lanes below group matching
          trades in one horizontal line so you can quickly compare bidder participation across projects.
        </p>
      </header>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {activeProjects.map((project) => {
          const bidding = project.trades.filter((t) => t.status === "bidding");
          const declined = project.trades.filter((t) => t.status === "declined");
          const ghosted = project.trades.filter((t) => t.status === "ghosted");
          const remainingDays = daysUntil(project.dueDate);

          return (
            <article key={project.id} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm space-y-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="font-semibold text-gray-900">{project.projectName}</h2>
                  <p className="text-xs text-gray-500 mt-1">
                    {project.region} · Estimator: {project.estimator}
                  </p>
                </div>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700 whitespace-nowrap">
                  Due {toDisplayDate(project.dueDate)}
                </span>
              </div>

              <div className="flex gap-2 text-xs">
                <span className="rounded-md bg-emerald-50 px-2 py-1 text-emerald-700">Bidding: {bidding.length}</span>
                <span className="rounded-md bg-rose-50 px-2 py-1 text-rose-700">Declined: {declined.length}</span>
                <span className="rounded-md bg-amber-50 px-2 py-1 text-amber-800">Ghosted: {ghosted.length}</span>
                <span className="rounded-md bg-slate-100 px-2 py-1 text-slate-700">{remainingDays} days left</span>
              </div>

              <div className="space-y-2 text-sm">
                <p>
                  <span className="font-medium text-gray-700">Bidding:</span>{" "}
                  <span className="text-gray-600">{bidding.map((t) => t.subcontractor).join(", ") || "None"}</span>
                </p>
                <p>
                  <span className="font-medium text-gray-700">Turned down:</span>{" "}
                  <span className="text-gray-600">{declined.map((t) => t.subcontractor).join(", ") || "None"}</span>
                </p>
                <p>
                  <span className="font-medium text-gray-700">Ghosted:</span>{" "}
                  <span className="text-gray-600">{ghosted.map((t) => t.subcontractor).join(", ") || "None"}</span>
                </p>
              </div>
            </article>
          );
        })}
      </section>

      <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm space-y-4">
        <div>
          <h2 className="text-lg font-semibold">Trade Comparison Lanes</h2>
          <p className="text-sm text-gray-600">Same trades are grouped horizontally so your team can compare coverage at a glance.</p>
        </div>

        <div className="overflow-x-auto">
          <div className="min-w-[900px] space-y-3">
            {tradeRows.map(([trade, bids]) => (
              <div key={trade} className="grid grid-cols-[180px,1fr] gap-3 items-start border-b border-gray-100 pb-3">
                <p className="font-medium text-sm text-gray-700 pt-1">{trade}</p>
                <div className="flex flex-wrap gap-2">
                  {bids.map((bid, index) => (
                    <div
                      key={`${trade}-${bid.subcontractor}-${index}`}
                      className={`rounded-lg border px-3 py-2 text-xs ${statusStyles[bid.status]}`}
                    >
                      <p className="font-semibold">{bid.subcontractor}</p>
                      <p className="opacity-80">{bid.projectName}</p>
                      <p className="opacity-80">
                        {statusLabels[bid.status]} · Due {toDisplayDate(bid.dueDate)}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
