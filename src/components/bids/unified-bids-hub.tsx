"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, XAxis, YAxis } from "recharts";
import { bidFollowUps } from "@/lib/bids/mock-data";
import { listBidAnalyticsData, listSubBidAnalyticsData } from "@/lib/bids/store";
import type { BidOpportunity, BidStage, Customer, User } from "@/lib/bids/types";

type Mode = "gc_owner" | "sub";

type DateFilter = "this_month" | "last_30" | "ytd" | "custom";

const stageLabel: Record<BidStage, string> = {
  lead: "Lead Identified",
  invited: "Invited",
  estimating: "Estimating",
  submitted: "Submitted",
  negotiation: "Negotiation",
  awarded: "Awarded",
  lost: "Lost",
  no_decision: "No Decision",
};

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);

export default function UnifiedBidsHub() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("gc_owner");
  const [search, setSearch] = useState("");
  const [dateFilter, setDateFilter] = useState<DateFilter>("last_30");
  const [selectedPersons, setSelectedPersons] = useState<string[]>([]);
  const [selectedCustomerIds, setSelectedCustomerIds] = useState<string[]>([]);
  const [selectedProjectTypes, setSelectedProjectTypes] = useState<string[]>([]);
  const [selectedCities, setSelectedCities] = useState<string[]>([]);
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
  const [selectedBid, setSelectedBid] = useState<BidOpportunity | null>(null);
  const [loading, setLoading] = useState(true);
  const [bidOpportunities, setBidOpportunities] = useState<BidOpportunity[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [subAnalytics, setSubAnalytics] = useState<{
    kpis: {
      activePackages: number;
      tradesDueThisWeek: number;
      responseRate: number;
      ghostRate: number;
      avgBidsPerTrade: number;
      coverageComplete: number;
    };
    chartData: Array<{ month: string; responseRate: number; avgBids: number; ghostRate: number }>;
    breakdownRows: Array<{ trade: string; invited: number; submitted: number; declined: number; ghosted: number }>;
    atRiskTrades: Array<{ trade: string; dueDate: string; responseRate: number }>;
    ghostedVendors: Array<{ name: string; ghosts: number }>;
    activePackages: Array<{ id: string; projectName: string; location: string; dueDate: string | null }>;
  }>({
    kpis: {
      activePackages: 0,
      tradesDueThisWeek: 0,
      responseRate: 0,
      ghostRate: 0,
      avgBidsPerTrade: 0,
      coverageComplete: 0,
    },
    chartData: [],
    breakdownRows: [],
    atRiskTrades: [],
    ghostedVendors: [],
    activePackages: [],
  });

  useEffect(() => {
    let active = true;
    async function loadAnalytics() {
      setLoading(true);
      const [ownerData, subData] = await Promise.all([
        listBidAnalyticsData(),
        listSubBidAnalyticsData(),
      ]);
      if (!active) return;
      setBidOpportunities(ownerData.opportunities);
      setUsers(ownerData.users);
      setCustomers(ownerData.customers);
      setSubAnalytics(subData);
      setLoading(false);
    }

    loadAnalytics();
    return () => {
      active = false;
    };
  }, []);

  const filteredBids = useMemo(() => {
    return bidOpportunities.filter((bid) => {
      if (search && !`${bid.projectName} ${bid.city}`.toLowerCase().includes(search.toLowerCase())) return false;
      if (selectedPersons.length > 0 && !selectedPersons.includes(bid.personId)) return false;
      if (selectedCustomerIds.length > 0 && !selectedCustomerIds.includes(bid.customerId)) return false;
      if (selectedProjectTypes.length > 0 && !selectedProjectTypes.includes(bid.projectType)) return false;
      if (selectedCities.length > 0 && !selectedCities.includes(bid.city)) return false;
      if (selectedStatuses.length > 0 && !selectedStatuses.includes(bid.stage)) return false;
      return true;
    });
  }, [bidOpportunities, search, selectedPersons, selectedCustomerIds, selectedProjectTypes, selectedCities, selectedStatuses]);

  const bidsSubmittedData = useMemo(() => {
    const buckets = new Map<string, number>();
    const months: string[] = [];
    const now = new Date();
    for (let i = 7; i >= 0; i -= 1) {
      const monthDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = monthDate.toISOString().slice(0, 7);
      const label = monthDate.toISOString().slice(5, 7);
      buckets.set(key, 0);
      months.push(label);
    }

    filteredBids.forEach((bid) => {
      const source = bid.submittedDate ?? bid.createdAt;
      if (!source) return;
      const monthKey = source.slice(0, 7);
      if (!buckets.has(monthKey)) return;
      buckets.set(monthKey, (buckets.get(monthKey) ?? 0) + 1);
    });

    return Array.from(buckets.values()).map((count, index) => ({
      month: months[index],
      count,
    }));
  }, [filteredBids]);

  const awardedData = useMemo(() => {
    const buckets = new Map<string, number>();
    const months: string[] = [];
    const now = new Date();
    for (let i = 7; i >= 0; i -= 1) {
      const monthDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = monthDate.toISOString().slice(0, 7);
      const label = monthDate.toISOString().slice(5, 7);
      buckets.set(key, 0);
      months.push(label);
    }

    filteredBids
      .filter((bid) => bid.stage === "awarded")
      .forEach((bid) => {
        const source = bid.submittedDate ?? bid.createdAt;
        if (!source) return;
        const monthKey = source.slice(0, 7);
        if (!buckets.has(monthKey)) return;
        buckets.set(monthKey, (buckets.get(monthKey) ?? 0) + (bid.outcome?.awardedValue ?? bid.submittedValue));
      });

    return Array.from(buckets.values()).map((value, index) => ({
      month: months[index],
      value: Math.round(value / 1000),
    }));
  }, [filteredBids]);

  const subChartData = subAnalytics.chartData;

  const pipelineCards = [
    {
      label: "Lead",
      count: 4,
      amount: "$0",
      badge: "bg-slate-100 text-slate-600",
      items: ["Meridian Tower ...", "Cherry Creek Mi..."],
      more: "+2 more",
    },
    {
      label: "Invited",
      count: 4,
      amount: "$0",
      badge: "bg-blue-100 text-blue-700",
      items: ["St. Luke's ER Ex...", "DIA Concourse ..."],
      more: "+2 more",
    },
    {
      label: "Estimating",
      count: 4,
      amount: "$0",
      badge: "bg-amber-100 text-amber-700",
      items: ["Austin Communi...", "Metro Health Cli..."],
      more: "+2 more",
    },
    {
      label: "Submitted",
      count: 4,
      amount: "$21.8M",
      badge: "bg-indigo-100 text-indigo-700",
      items: ["Westfield Office ...", "Highlands Town ..."],
      more: "+2 more",
    },
    {
      label: "Negotiation",
      count: 4,
      amount: "$28.1M",
      badge: "bg-purple-100 text-purple-700",
      items: ["Pacific Ridge Ap...", "Riverside Indust..."],
      more: "+2 more",
    },
    {
      label: "Awarded",
      count: 3,
      amount: "$12.0M",
      badge: "bg-emerald-100 text-emerald-700",
      items: ["Summit K-8 Sch...", "Parkway Senior ..."],
      more: "+1 more",
    },
    {
      label: "Lost",
      count: 3,
      amount: "$15.4M",
      badge: "bg-rose-100 text-rose-700",
      items: ["Ironclad Wareho...", "Tech Hub Office"],
      more: "+1 more",
    },
  ];

  const gcKpis = useMemo(() => {
    const submitted = filteredBids.filter((b) => ["submitted", "negotiation", "awarded", "lost", "no_decision"].includes(b.stage));
    const awarded = filteredBids.filter((b) => b.stage === "awarded");
    const submittedValue = submitted.reduce((sum, b) => sum + b.submittedValue, 0);
    const awardedValue = awarded.reduce((sum, b) => sum + (b.outcome?.awardedValue ?? 0), 0);
    return {
      bidsSubmitted: submitted.length,
      submittedValue,
      awardedValue,
      winRate: submitted.length ? (awarded.length / submitted.length) * 100 : 0,
      weightedWinRate: submittedValue ? (awardedValue / submittedValue) * 100 : 0,
    };
  }, [filteredBids]);

  const subKpis = useMemo(() => {
    return subAnalytics.kpis;
  }, [subAnalytics.kpis]);

  const staleBids = filteredBids.filter((b) => b.stage === "submitted" || b.stage === "negotiation").slice(0, 4);

  return (
    <main className="min-h-screen bg-slate-50 p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-center gap-4">
            <h1 className="text-2xl font-semibold text-slate-900">Bid Analytics</h1>
            <div className="inline-flex rounded-2xl border border-slate-200 bg-white p-1.5 text-sm shadow-sm">
              <button
                onClick={() => setMode("gc_owner")}
                className={`flex items-center gap-2 rounded-xl px-4 py-2.5 font-semibold transition ${
                  mode === "gc_owner" ? "bg-slate-900 text-white" : "text-slate-500"
                }`}
              >
                <svg aria-hidden="true" viewBox="0 0 24 24" className={`h-5 w-5 ${mode === "gc_owner" ? "text-white" : "text-slate-400"}`}>
                  <path
                    d="M4 20h16M6 20V8a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v12M9 10h2m2 0h2M9 14h2m2 0h2"
                    fill="none"
                    stroke="currentColor"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="1.6"
                  />
                </svg>
                <span className="leading-tight">GC/Owner Bids</span>
              </button>
              <button
                onClick={() => setMode("sub")}
                className={`flex items-center gap-2 rounded-xl px-4 py-2.5 font-semibold transition ${
                  mode === "sub" ? "bg-slate-900 text-white" : "text-slate-500"
                }`}
              >
                <svg aria-hidden="true" viewBox="0 0 24 24" className={`h-5 w-5 ${mode === "sub" ? "text-white" : "text-slate-400"}`}>
                  <path
                    d="M16 11a4 4 0 1 0-8 0 4 4 0 0 0 8 0Zm-9 9a5 5 0 0 1 10 0"
                    fill="none"
                    stroke="currentColor"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="1.6"
                  />
                </svg>
                <span className="leading-tight">Sub Bids</span>
              </button>
            </div>
            <div className="ml-auto flex flex-wrap items-center gap-3">
              <div className="relative w-[240px] flex-none">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                  <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5">
                    <path
                      d="M21 21l-4.35-4.35M10.5 18a7.5 7.5 0 1 1 0-15 7.5 7.5 0 0 1 0 15Z"
                      fill="none"
                      stroke="currentColor"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="1.7"
                    />
                  </svg>
                </span>
                <input
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search bids..."
                  className="h-11 w-full rounded-2xl border border-slate-200 bg-white pl-11 pr-3 text-sm text-slate-700 shadow-sm"
                />
              </div>
              <div className="relative">
                <select
                  onChange={(e) => setDateFilter(e.target.value as DateFilter)}
                  className="h-11 min-w-[160px] appearance-none rounded-2xl border border-slate-200 bg-white px-4 pr-10 text-sm font-medium text-slate-900 shadow-sm"
                >
                  <option value="ytd">YTD</option>
                  <option value="last_30">Month</option>
                  <option value="this_month">This Month</option>
                  <option value="custom">Custom</option>
                </select>
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
                  <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5">
                    <path d="m6 9 6 6 6-6" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.7" />
                  </svg>
                </span>
              </div>
              <button
                onClick={() => {
                  if (mode === "gc_owner") {
                    router.push("/bidding/owner-bids");
                    return;
                  }
                  router.push("/bidding");
                }}
                className="inline-flex h-11 items-center gap-2 rounded-2xl bg-slate-900 px-5 text-sm font-semibold text-white shadow-sm"
              >
                <span className="text-lg leading-none">+</span>
                <span>{mode === "gc_owner" ? "Create Bid" : "Create Bid Package"}</span>
              </button>
            </div>
          </div>
          <div className="mt-4 hidden grid gap-3 md:grid-cols-3 lg:grid-cols-6">
            <MultiSelect label="Person" options={users.map((u) => ({ label: u.name, value: u.id }))} onChange={setSelectedPersons} />
            <MultiSelect label="Customer" disabled={mode === "sub"} options={customers.map((c) => ({ label: c.name, value: c.id }))} onChange={setSelectedCustomerIds} />
            <MultiSelect label="Project Type" options={[...new Set(bidOpportunities.map((b) => b.projectType))].map((p) => ({ label: p, value: p }))} onChange={setSelectedProjectTypes} />
            <MultiSelect label="Status" options={["lead","invited","estimating","submitted","negotiation","awarded","lost","no_decision"].map((s) => ({ label: s.replaceAll("_", " "), value: s }))} onChange={setSelectedStatuses} />
            <MultiSelect label="City" options={[...new Set(bidOpportunities.map((b) => b.city))].map((city) => ({ label: city, value: city }))} onChange={setSelectedCities} />
          </div>
        </section>

        {loading ? <SkeletonGrid /> : mode === "gc_owner" ? <GcKpis kpis={gcKpis} /> : <SubKpis kpis={subKpis} />}

        <section className="grid gap-4 lg:grid-cols-3">
          {mode === "gc_owner" ? (
            <>
              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-base font-semibold text-slate-700">Bids Submitted</h3>
                </div>
                <div className="relative h-48 rounded-xl border border-slate-100 bg-white p-3">
                  {bidsSubmittedData.length === 0 ? (
                    <div className="flex h-full items-center justify-center text-sm text-slate-500">No data</div>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={bidsSubmittedData}
                        barSize={24}
                        barCategoryGap="22%"
                        style={{ shapeRendering: "crispEdges" }}
                      >
                        <CartesianGrid strokeDasharray="4 6" stroke="#E2E8F0" />
                        <XAxis
                          dataKey="month"
                          axisLine={false}
                          tickLine={false}
                          tickMargin={8}
                          tick={{ fill: "#64748B", fontSize: 11 }}
                        />
                        <YAxis
                          domain={[0, 12]}
                          ticks={[0, 3, 6, 9, 12]}
                          axisLine={false}
                          tickLine={false}
                          tickMargin={10}
                          tick={{ fill: "#64748B", fontSize: 11 }}
                        />
                        <Bar dataKey="count" fill="#0f172a" radius={[8, 8, 0, 0]} minPointSize={2} />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-base font-semibold text-slate-700">Awarded $ (K)</h3>
                </div>
                <div className="relative h-48 rounded-xl border border-slate-100 bg-white p-3">
                  {awardedData.length === 0 ? (
                    <div className="flex h-full items-center justify-center text-sm text-slate-500">No data</div>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={awardedData}
                        barSize={24}
                        barCategoryGap="22%"
                        style={{ shapeRendering: "crispEdges" }}
                      >
                        <CartesianGrid strokeDasharray="4 6" stroke="#E2E8F0" />
                        <XAxis
                          dataKey="month"
                          axisLine={false}
                          tickLine={false}
                          tickMargin={8}
                          tick={{ fill: "#64748B", fontSize: 11 }}
                        />
                        <YAxis
                          domain={[0, 8000]}
                          ticks={[0, 2000, 4000, 8000]}
                          axisLine={false}
                          tickLine={false}
                          tickMargin={10}
                          tick={{ fill: "#64748B", fontSize: 11 }}
                        />
                        <Bar dataKey="value" fill="#22c55e" radius={[8, 8, 0, 0]} minPointSize={2} />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-base font-semibold text-slate-700">Win Rate %</h3>
                </div>
                <div className="relative h-40 rounded-xl border border-slate-100 bg-white p-3">
                  <div className="absolute inset-3 grid grid-cols-8 grid-rows-4 gap-0.5 text-[10px] text-slate-400">
                    {Array.from({ length: 32 }).map((_, i) => (
                      <span key={i} className="border-b border-dashed border-slate-200" />
                    ))}
                  </div>
                  <svg viewBox="0 0 320 140" className="relative z-10 h-full w-full">
                    <path d="M10 120 L50 120 L90 80 L130 120 L170 95 L210 120 L250 20 L290 120" fill="none" stroke="#0f172a" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                    {[{ x: 10, y: 120 }, { x: 50, y: 120 }, { x: 90, y: 80 }, { x: 130, y: 120 }, { x: 170, y: 95 }, { x: 210, y: 120 }, { x: 250, y: 20 }, { x: 290, y: 120 }].map((p, i) => (
                      <circle key={i} cx={p.x} cy={p.y} r="5" fill="#fff" stroke="#0f172a" strokeWidth="3" />
                    ))}
                  </svg>
                  <div className="relative z-10 mt-2 flex justify-between px-1 text-[11px] text-slate-500">
                    {["07","08","09","10","11","12","01","02"].map((m) => (
                      <span key={m}>{m}</span>
                    ))}
                  </div>
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-base font-semibold text-slate-700">Response Rate %</h3>
                </div>
                <div className="relative h-48 rounded-xl border border-slate-100 bg-white p-3">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={subChartData}>
                      <CartesianGrid strokeDasharray="4 6" stroke="#E2E8F0" />
                      <XAxis
                        dataKey="month"
                        axisLine={false}
                        tickLine={false}
                        tickMargin={8}
                        tick={{ fill: "#64748B", fontSize: 11 }}
                      />
                      <YAxis
                        domain={[0, 80]}
                        ticks={[0, 20, 40, 80]}
                        axisLine={false}
                        tickLine={false}
                        tickMargin={10}
                        tick={{ fill: "#64748B", fontSize: 11 }}
                      />
                      <Line
                        type="monotone"
                        dataKey="responseRate"
                        stroke="#22c55e"
                        strokeWidth={2.5}
                        dot={{ r: 4, strokeWidth: 2, fill: "#fff", stroke: "#22c55e" }}
                        activeDot={{ r: 4 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-base font-semibold text-slate-700">Avg Bids/Trade</h3>
                </div>
                <div className="relative h-48 rounded-xl border border-slate-100 bg-white p-3">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={subChartData} barSize={24} barCategoryGap="22%" style={{ shapeRendering: "crispEdges" }}>
                      <CartesianGrid strokeDasharray="4 6" stroke="#E2E8F0" />
                      <XAxis
                        dataKey="month"
                        axisLine={false}
                        tickLine={false}
                        tickMargin={8}
                        tick={{ fill: "#64748B", fontSize: 11 }}
                      />
                      <YAxis
                        domain={[0, 3.2]}
                        ticks={[0, 0.8, 1.6, 3.2]}
                        axisLine={false}
                        tickLine={false}
                        tickMargin={10}
                        tick={{ fill: "#64748B", fontSize: 11 }}
                      />
                      <Bar dataKey="avgBids" fill="#0f172a" radius={[8, 8, 0, 0]} minPointSize={2} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-base font-semibold text-slate-700">Ghost Rate %</h3>
                </div>
                <div className="relative h-48 rounded-xl border border-slate-100 bg-white p-3">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={subChartData}>
                      <CartesianGrid strokeDasharray="4 6" stroke="#E2E8F0" />
                      <XAxis
                        dataKey="month"
                        axisLine={false}
                        tickLine={false}
                        tickMargin={8}
                        tick={{ fill: "#64748B", fontSize: 11 }}
                      />
                      <YAxis
                        domain={[0, 24]}
                        ticks={[0, 6, 12, 24]}
                        axisLine={false}
                        tickLine={false}
                        tickMargin={10}
                        tick={{ fill: "#64748B", fontSize: 11 }}
                      />
                      <Line
                        type="monotone"
                        dataKey="ghostRate"
                        stroke="#ef4444"
                        strokeWidth={2.5}
                        dot={{ r: 4, strokeWidth: 2, fill: "#fff", stroke: "#ef4444" }}
                        activeDot={{ r: 4 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </>
          )}
        </section>

        {mode === "gc_owner" ? (
          <GcBreakdown bids={filteredBids} users={users} customers={customers} />
        ) : (
          <SubBreakdown rows={subAnalytics.breakdownRows} />
        )}

        {mode === "gc_owner" && (
          <section className="grid gap-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <h3 className="mb-4 font-semibold text-slate-900">Pipeline</h3>
              <div className="w-full pb-2">
                <div className="flex w-full flex-wrap gap-3">
                  {pipelineCards.map((card) => (
                    <div key={card.label} className="w-56 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                      <span className={`inline-flex rounded-full px-3 py-1 text-sm font-semibold ${card.badge}`}>
                        {card.label}
                      </span>
                      <div className="mt-3 text-3xl font-semibold text-slate-900">{card.count}</div>
                      <div className="mt-1 text-base font-semibold text-slate-500">{card.amount}</div>
                      <div className="mt-4 space-y-2 text-sm text-slate-700">
                        {card.items.map((item) => (
                          <div key={item} className="rounded-lg border border-slate-200 px-3 py-2 shadow-sm">
                            {item}
                          </div>
                        ))}
                        <div className="text-sm font-medium text-slate-500">{card.more}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>
        )}

        {mode === "gc_owner" ? (
          <section className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <h4 className="mb-4 text-base font-semibold text-slate-900">Aging Buckets</h4>
              <div className="grid grid-cols-5 gap-4">
                {[
                  { label: "0–7d", value: 0 },
                  { label: "8–14d", value: 1 },
                  { label: "15–30d", value: 0 },
                  { label: "31–60d", value: 1 },
                  { label: "60+d", value: 6 },
                ].map((bucket) => (
                  <div key={bucket.label} className="text-center">
                    <div className="text-2xl font-semibold text-slate-700">{bucket.value}</div>
                    <div className="text-sm text-slate-500">{bucket.label}</div>
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="mb-3 flex flex-wrap items-center gap-3">
                <h4 className="text-base font-semibold text-slate-900">Stale Bids</h4>
                <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600">
                  <span className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-slate-300">
                    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-3 w-3 text-slate-500">
                      <path d="M12 7v5l3 2" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
                      <circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" strokeWidth="1.8" />
                    </svg>
                  </span>
                  Stale &gt; 30 days
                </span>
              </div>
              <div className="space-y-3">
                {staleBids.map((item) => (
                  <div key={item.id} className="flex items-center justify-between rounded-xl border border-slate-200 px-4 py-3 text-sm">
                    <p className="font-semibold text-slate-800">{item.projectName}</p>
                    <span className="text-sm font-semibold text-slate-500">{formatCurrency(item.submittedValue)}</span>
                  </div>
                ))}
              </div>
            </div>
          </section>
        ) : (
          <section className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="mb-3 flex flex-wrap items-center gap-3">
                <h4 className="text-base font-semibold text-slate-900">Trades at Risk</h4>
                <span className="inline-flex items-center gap-2 rounded-full border border-orange-200 bg-orange-50 px-3 py-1 text-xs font-semibold text-orange-600">
                  <svg aria-hidden="true" viewBox="0 0 24 24" className="h-3 w-3">
                    <path d="M4 20V5m5 15V9m5 11V13m5 7V7" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
                  </svg>
                  Low coverage
                </span>
              </div>
              <div className="space-y-3">
                {subAnalytics.atRiskTrades.length ? (
                  subAnalytics.atRiskTrades.map((trade, idx) => (
                    <div key={`${trade.trade}-${idx}`} className="flex items-center justify-between rounded-xl border border-slate-200 px-4 py-3 text-sm">
                      <p className="font-semibold text-slate-800">{trade.trade}</p>
                      <span className="text-sm font-semibold text-slate-500">
                        Due {trade.dueDate || "TBD"}
                      </span>
                    </div>
                  ))
                ) : (
                  <div className="rounded-xl border border-dashed border-slate-200 px-4 py-3 text-sm text-slate-500">
                    No at-risk trades found.
                  </div>
                )}
              </div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <h4 className="mb-3 text-base font-semibold text-slate-900">Most Ghosted Vendors</h4>
              <div className="space-y-3">
                {subAnalytics.ghostedVendors.length ? (
                  subAnalytics.ghostedVendors.map((vendor) => (
                    <div key={vendor.name} className="flex items-center justify-between rounded-xl border border-slate-200 px-4 py-3 text-sm">
                      <p className="font-semibold text-slate-800">{vendor.name}</p>
                      <span className="text-sm font-semibold text-slate-500">
                        {vendor.ghosts} {vendor.ghosts === 1 ? "ghost" : "ghosts"}
                      </span>
                    </div>
                  ))
                ) : (
                  <div className="rounded-xl border border-dashed border-slate-200 px-4 py-3 text-sm text-slate-500">
                    No ghosted vendors.
                  </div>
                )}
              </div>
            </div>
          </section>
        )}

        {mode === "sub" && (
          <section className="rounded-2xl border border-slate-200 bg-white p-4">
            <h3 className="mb-3 font-semibold">Active Bid Packages</h3>
            <div className="grid gap-3 md:grid-cols-3">
              {subAnalytics.activePackages.map((project) => {
                return (
                  <Link key={project.id} href={`/bids/sub/${project.id}`} className="rounded-xl border border-slate-200 p-3 hover:border-slate-300">
                    <p className="font-medium text-slate-900">{project.projectName}</p>
                    <p className="text-xs text-slate-500">{project.location}</p>
                    <p className="mt-2 text-xs text-slate-500">Due {project.dueDate ?? "TBD"}</p>
                  </Link>
                );
              })}
            </div>
          </section>
        )}
      </div>

      {selectedBid && (
        <BidOpportunityDrawer bid={selectedBid} users={users} customers={customers} onClose={() => setSelectedBid(null)} />
      )}
    </main>
  );
}

function MultiSelect({ label, options, onChange, disabled }: { label: string; options: { label: string; value: string }[]; onChange: (v: string[]) => void; disabled?: boolean }) {
  return (
    <select disabled={disabled} onChange={(e) => onChange(Array.from(e.target.selectedOptions).map((o) => o.value))} multiple className="h-10 rounded-xl border border-slate-200 px-2 text-xs text-slate-700">
      <option value="">{label}</option>
      {options.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
    </select>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) { return <div className="rounded-2xl border border-slate-200 bg-white p-4"><p className="text-xs text-slate-500">{label}</p><p className="mt-1 text-2xl font-semibold text-slate-900">{value}</p></div>; }

function GcKpis({ kpis }: { kpis: { bidsSubmitted: number; submittedValue: number; awardedValue: number; winRate: number; weightedWinRate: number } }) {
  const items = [
    {
      label: "Bids Submitted",
      value: `${kpis.bidsSubmitted}`,
      icon: (
        <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4.5 w-4.5">
          <path d="M4 20V5m5 15V9m5 11V13m5 7V7" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
        </svg>
      ),
    },
    {
      label: "Total Bid Value",
      value: formatCurrency(kpis.submittedValue),
      icon: (
        <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4.5 w-4.5">
          <path d="M12 4v16m-4-3a4 4 0 0 0 4 3m0-16a4 4 0 0 1 4 3M9 9h6m-6 6h6" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
        </svg>
      ),
    },
    {
      label: "Awarded $",
      value: formatCurrency(kpis.awardedValue),
      icon: (
        <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4.5 w-4.5">
          <path d="M5 15l6-6 4 4 4-5" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
          <path d="M19 8h-4V4" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
        </svg>
      ),
    },
    {
      label: "Win Rate",
      value: `${kpis.winRate.toFixed(1)}%`,
      icon: (
        <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4.5 w-4.5">
          <circle cx="12" cy="12" r="7" fill="none" stroke="currentColor" strokeWidth="1.8" />
          <circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" strokeWidth="1.8" />
          <circle cx="12" cy="12" r="1" fill="currentColor" />
        </svg>
      ),
    },
    {
      label: "$ Win Rate",
      value: `${kpis.weightedWinRate.toFixed(1)}%`,
      icon: (
        <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4.5 w-4.5">
          <circle cx="12" cy="12" r="7" fill="none" stroke="currentColor" strokeWidth="1.8" />
          <path d="M12 8v8m-2-2a2 2 0 0 0 2 2m0-8a2 2 0 0 1 2 2" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.6" />
        </svg>
      ),
    },
    {
      label: "Avg Days to Award",
      value: "27",
      icon: (
        <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4.5 w-4.5">
          <circle cx="12" cy="12" r="7" fill="none" stroke="currentColor" strokeWidth="1.8" />
          <path d="M12 8v4l3 2" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
        </svg>
      ),
    },
  ];

  return (
    <section className="flex w-full flex-wrap justify-between gap-3">
      {items.map((item) => (
        <div key={item.label} className="w-full rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:w-[180px]">
          <div className="flex items-center gap-2 text-slate-500">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
              {item.icon}
            </span>
            <p className="text-sm font-medium text-slate-500">{item.label}</p>
          </div>
          <p className="mt-3 text-2xl font-semibold text-slate-900">{item.value}</p>
        </div>
      ))}
    </section>
  );
}

function SubKpis({ kpis }: { kpis: { activePackages: number; tradesDueThisWeek: number; responseRate: number; ghostRate: number; avgBidsPerTrade: number; coverageComplete: number } }) {
  const items = [
    {
      label: "Active Bids",
      value: `${kpis.activePackages}`,
      icon: (
        <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4.5 w-4.5">
          <path d="M4 20V5m5 15V9m5 11V13m5 7V7" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
        </svg>
      ),
    },
    {
      label: "Due This Week",
      value: `${kpis.tradesDueThisWeek}`,
      icon: (
        <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4.5 w-4.5">
          <circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" strokeWidth="1.8" />
          <path d="M12 8v5l3 2" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
        </svg>
      ),
    },
    {
      label: "Response Rate",
      value: `${kpis.responseRate.toFixed(1)}%`,
      icon: (
        <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4.5 w-4.5">
          <circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" strokeWidth="1.8" />
          <path d="m8 12 2.5 2.5L16 9" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
        </svg>
      ),
    },
    {
      label: "Ghost Rate",
      value: `${kpis.ghostRate.toFixed(1)}%`,
      icon: (
        <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4.5 w-4.5">
          <path d="M6 18a6 6 0 1 1 12 0v2l-2-1-2 1-2-1-2 1-2-1-2 1Z" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
          <path d="M9 9h.01M15 9h.01" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
        </svg>
      ),
    },
    {
      label: "Avg Bids/Trade",
      value: kpis.avgBidsPerTrade.toFixed(1),
      icon: (
        <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4.5 w-4.5">
          <path d="M7 10a4 4 0 1 1 8 0" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
          <path d="M4 20a4 4 0 0 1 8 0M12 20a4 4 0 0 1 8 0" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
        </svg>
      ),
    },
    {
      label: "Coverage ≥3",
      value: `${kpis.coverageComplete.toFixed(1)}%`,
      icon: (
        <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4.5 w-4.5">
          <circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" strokeWidth="1.8" />
          <circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" strokeWidth="1.8" />
          <circle cx="12" cy="12" r="1" fill="currentColor" />
        </svg>
      ),
    },
  ];

  return (
    <section className="flex w-full flex-wrap justify-between gap-3">
      {items.map((item) => (
        <div key={item.label} className="w-full rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:w-[200px]">
          <div className="flex items-center gap-2 text-slate-500">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
              {item.icon}
            </span>
            <p className="text-sm font-medium text-slate-500">{item.label}</p>
          </div>
          <p className="mt-3 text-2xl font-semibold text-slate-900">{item.value}</p>
        </div>
      ))}
    </section>
  );
}

function GcBreakdown({
  bids,
  users,
  customers,
}: {
  bids: BidOpportunity[];
  users: User[];
  customers: Customer[];
}) {
  const [breakdownMode, setBreakdownMode] = useState<"estimator" | "project_type" | "client">("estimator");

  const grouped = Object.values(
    bids.reduce<Record<string, { key: string; label: string; count: number; submitted: number; awarded: number }>>((acc, bid) => {
      let key = "";
      let label = "";
      if (breakdownMode === "estimator") {
        key = bid.personId;
        label = users.find((u) => u.id === bid.personId)?.name ?? "Unassigned";
      } else if (breakdownMode === "client") {
        key = bid.customerId;
        label = customers.find((c) => c.id === bid.customerId)?.name ?? "Unassigned";
      } else {
        key = bid.projectType;
        label = bid.projectType;
      }
      if (!acc[key]) acc[key] = { key, label, count: 0, submitted: 0, awarded: 0 };
      acc[key].count += 1;
      acc[key].submitted += bid.submittedValue;
      acc[key].awarded += bid.outcome?.awardedValue ?? 0;
      return acc;
    }, {})
  );
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="mb-4">
        <h3 className="text-xl font-semibold text-slate-900">Breakdowns</h3>
        <div className="mt-3 inline-flex rounded-2xl bg-slate-100 p-1.5">
          <button
            onClick={() => setBreakdownMode("estimator")}
            className={`rounded-xl px-5 py-2 text-sm font-semibold shadow-sm ${
              breakdownMode === "estimator" ? "bg-white text-slate-900" : "text-slate-500"
            }`}
          >
            Estimator
          </button>
          <button
            onClick={() => setBreakdownMode("project_type")}
            className={`rounded-xl px-5 py-2 text-sm font-semibold shadow-sm ${
              breakdownMode === "project_type" ? "bg-white text-slate-900" : "text-slate-500"
            }`}
          >
            Project Type
          </button>
          <button
            onClick={() => setBreakdownMode("client")}
            className={`rounded-xl px-5 py-2 text-sm font-semibold shadow-sm ${
              breakdownMode === "client" ? "bg-white text-slate-900" : "text-slate-500"
            }`}
          >
            Client
          </button>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="text-base text-slate-500">
            <tr className="border-b border-slate-200">
              <th className="px-4 py-3 text-left font-semibold text-slate-500">
                {breakdownMode === "estimator" ? "Estimator" : breakdownMode === "client" ? "Client" : "Project Type"}
              </th>
              <th className="px-4 py-3 text-right font-semibold text-slate-500">Submitted</th>
              <th className="px-4 py-3 text-right font-semibold text-slate-500">Submitted $</th>
              <th className="px-4 py-3 text-right font-semibold text-slate-500">Awarded $</th>
              <th className="px-4 py-3 text-right font-semibold text-slate-500">Win Rate</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {grouped.map((row) => (
              <tr key={row.key} className="border-b border-slate-100">
                <td className="px-4 py-4 text-base font-medium text-slate-900">{row.label}</td>
                <td className="px-4 py-4 text-right text-base font-semibold text-slate-900">{row.count}</td>
                <td className="px-4 py-4 text-right text-base font-semibold text-slate-900">{formatCurrency(row.submitted)}</td>
                <td className="px-4 py-4 text-right text-base font-semibold text-slate-900">{formatCurrency(row.awarded)}</td>
                <td className="px-4 py-4 text-right text-base font-semibold text-slate-900">{row.submitted ? `${((row.awarded / row.submitted) * 100).toFixed(1)}%` : "0%"}</td>
                <td className="px-4 py-4" />
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function SubBreakdown({ rows }: { rows: Array<{ trade: string; invited: number; submitted: number; declined: number; ghosted: number }> }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4">
      <h3 className="mb-4 text-base font-semibold text-slate-900">Breakdowns by Trade</h3>
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="text-base text-slate-500">
            <tr className="border-b border-slate-200">
              <th className="px-4 py-3 text-left font-semibold text-slate-500">Trade</th>
              <th className="px-4 py-3 text-right font-semibold text-slate-500">Invited</th>
              <th className="px-4 py-3 text-right font-semibold text-slate-500">Submitted</th>
              <th className="px-4 py-3 text-right font-semibold text-slate-500">Declined</th>
              <th className="px-4 py-3 text-right font-semibold text-slate-500">Ghosted</th>
              <th className="px-4 py-3 text-right font-semibold text-slate-500">Response %</th>
            </tr>
          </thead>
          <tbody>
            {rows.length ? (
              rows.map((row, index) => (
                <tr key={`${row.trade}-${index}`} className="border-b border-slate-100">
                  <td className="px-4 py-4 text-base font-medium text-slate-900">{row.trade}</td>
                  <td className="px-4 py-4 text-right text-base font-semibold text-slate-900">{row.invited}</td>
                  <td className="px-4 py-4 text-right text-base font-semibold text-slate-900">{row.submitted}</td>
                  <td className="px-4 py-4 text-right text-base font-semibold text-slate-900">{row.declined}</td>
                  <td className="px-4 py-4 text-right text-base font-semibold text-slate-900">{row.ghosted}</td>
                  <td className="px-4 py-4 text-right text-base font-semibold text-slate-900">
                    {row.invited ? `${((row.submitted / row.invited) * 100).toFixed(1)}%` : "0.0%"}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-sm text-slate-500">
                  No trade response data yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function BidOpportunityDrawer({
  bid,
  users,
  customers,
  onClose,
}: {
  bid: BidOpportunity;
  users: User[];
  customers: Customer[];
  onClose: () => void;
}) {
  const customer = customers.find((c) => c.id === bid.customerId)?.name ?? "Unknown";
  const person = users.find((u) => u.id === bid.personId)?.name ?? "Unknown";
  const followUps = bidFollowUps.filter((f) => f.bidOpportunityId === bid.id);
  return (
    <div className="fixed inset-0 z-40 bg-black/30" onClick={onClose}>
      <aside className="absolute right-0 top-0 h-full w-full max-w-xl overflow-y-auto bg-white p-5" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-start justify-between"><div><h3 className="text-xl font-semibold">Bid Opportunity Detail</h3><p className="text-sm text-slate-500">{bid.projectName}</p></div><button onClick={onClose}>✕</button></div>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <Field label="Customer" value={customer} /><Field label="Project Type" value={bid.projectType} /><Field label="City" value={bid.city} /><Field label="Estimator" value={person} /><Field label="Bid Due" value={bid.dueDate} /><Field label="Submitted Date" value={bid.submittedDate ?? "—"} /><Field label="Stage" value={stageLabel[bid.stage]} /><Field label="Bid Value" value={formatCurrency(bid.submittedValue)} />
        </div>
        <div className="mt-4 rounded-xl border border-slate-200 p-3"><p className="mb-1 text-xs text-slate-500">Notes</p><p className="text-sm text-slate-700">{bid.notes}</p></div>
        <div className="mt-4 rounded-xl border border-slate-200 p-3"><p className="mb-2 text-sm font-medium">Follow-up log</p>{followUps.length ? followUps.map((f) => <p key={f.id} className="text-xs text-slate-600">{f.timestamp} · {f.note}</p>) : <p className="text-xs text-slate-500">No follow-ups yet.</p>}</div>
      </aside>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) { return <div className="rounded-xl border border-slate-200 p-2"><p className="text-xs text-slate-500">{label}</p><p className="text-sm font-medium text-slate-800">{value}</p></div>; }

function SkeletonGrid() {
  return <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-24 animate-pulse rounded-2xl bg-slate-200" />)}</div>;
}
