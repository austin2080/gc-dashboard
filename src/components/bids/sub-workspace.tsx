"use client";

import { useMemo, useState } from "react";
import {
  bidSubmissions,
  inviteEvents,
  outcomes,
  projectBids,
  projects,
  scopeLibrary,
  tradePackages,
  vendors,
} from "@/lib/bids/mock-data";
import type { BidSubmission } from "@/lib/bids/types";

type Tab = "leveling" | "invites" | "scope" | "outcomes";

const pill: Record<string, string> = {
  submitted: "bg-emerald-100 text-emerald-700",
  declined: "bg-rose-100 text-rose-700",
  ghosted: "bg-amber-100 text-amber-700",
};

export default function SubBidWorkspace({ projectId }: { projectId: string }) {
  const [activeTab, setActiveTab] = useState<Tab>("leveling");
  const [selectedSubmission, setSelectedSubmission] = useState<BidSubmission | null>(null);
  const [localInvites, setLocalInvites] = useState(inviteEvents);

  const project = projects.find((p) => p.id === projectId) ?? projects[0];
  const projectBid = projectBids.find((pb) => pb.projectId === project.id) ?? projectBids[0];
  const projectTrades = tradePackages.filter((trade) => trade.projectBidId === projectBid.id);
  const responseRate = useMemo(() => {
    const invites = localInvites.filter((i) => projectTrades.some((t) => t.id === i.tradePackageId));
    const submitted = invites.filter((i) => i.responseType === "submitted").length;
    return invites.length ? Math.round((submitted / invites.length) * 100) : 0;
  }, [localInvites, projectTrades]);

  return (
    <main className="min-h-screen bg-slate-50 p-6">
      <div className="mx-auto max-w-7xl space-y-4">
        <section className="sticky top-16 z-20 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-semibold text-slate-900">{project.name}</h1>
              <p className="text-sm text-slate-500">Due {projectBid.dueDate} · Response rate {responseRate}% · Last activity 2h ago</p>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <span className="rounded-full bg-amber-100 px-2 py-1 text-amber-700">Scope gap detected</span>
              <span className="rounded-full bg-rose-100 px-2 py-1 text-rose-700">Below typical range</span>
            </div>
          </div>
          <div className="mt-4 inline-flex rounded-xl border border-slate-200 bg-slate-100 p-1 text-sm">
            {(["leveling", "invites", "scope", "outcomes"] as Tab[]).map((tab) => <button key={tab} onClick={() => setActiveTab(tab)} className={`rounded-lg px-3 py-1.5 ${activeTab === tab ? "bg-white shadow-sm" : "text-slate-500"}`}>{tab === "scope" ? "Scope Library" : tab[0].toUpperCase() + tab.slice(1)}</button>)}
          </div>
        </section>

        {activeTab === "leveling" && (
          <section className="space-y-3">
            {projectTrades.map((trade) => {
              const tradeInvites = localInvites.filter((i) => i.tradePackageId === trade.id);
              return (
                <div key={trade.id} className="rounded-2xl border border-slate-200 bg-white p-4">
                  <div className="mb-3 flex items-center justify-between"><h3 className="font-semibold text-slate-900">{trade.tradeName}</h3><button className="rounded-lg border border-slate-200 px-3 py-1 text-xs">Add Bid / Log Response</button></div>
                  {tradeInvites.length === 0 ? <p className="rounded-lg border border-dashed border-slate-200 p-3 text-sm text-slate-500">No submissions in this trade.</p> : <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">{tradeInvites.map((invite) => {
                    const vendor = vendors.find((v) => v.id === invite.vendorId);
                    const submission = bidSubmissions.find((s) => s.tradePackageId === trade.id && s.vendorId === invite.vendorId);
                    return <button key={invite.id} onClick={() => submission && setSelectedSubmission(submission)} className="rounded-xl border border-slate-200 p-3 text-left hover:border-slate-300"><p className="font-medium text-slate-900">{vendor?.companyName}</p><p className="text-xs text-slate-500">{submission?.lumpSum ? `$${submission.lumpSum.toLocaleString()}` : "No amount"}</p><span className={`mt-2 inline-flex rounded-full px-2 py-0.5 text-[11px] ${pill[invite.responseType] ?? "bg-slate-100 text-slate-700"}`}>{invite.responseType}</span><p className="mt-2 text-xs text-slate-500">Rev: {submission?.activeRevision ?? "—"} · Excl {submission?.exclusions.length ?? 0} · Clar {submission?.clarifications.length ?? 0}</p></button>;
                  })}</div>}
                </div>
              );
            })}
          </section>
        )}

        {activeTab === "invites" && (
          <section className="rounded-2xl border border-slate-200 bg-white p-4">
            <h3 className="mb-3 font-semibold text-slate-900">Invite Tracking</h3>
            <div className="space-y-2">
              {projectTrades.map((trade) => (
                <div key={trade.id} className="rounded-xl border border-slate-200 p-3">
                  <p className="mb-2 font-medium text-slate-800">{trade.tradeName}</p>
                  <div className="space-y-2">{localInvites.filter((i) => i.tradePackageId === trade.id).map((invite) => {
                    const vendor = vendors.find((v) => v.id === invite.vendorId);
                    return <div key={invite.id} className="grid gap-2 rounded-lg bg-slate-50 p-2 text-xs md:grid-cols-6"><p>{vendor?.companyName}</p><p>Invited: {invite.invitedAt}</p><p>Viewed: {invite.viewedAt ?? "—"}</p><p>Responded: {invite.respondedAt ?? "—"}</p><p>{invite.responseType}</p><button className="underline" onClick={() => setLocalInvites((prev) => prev.map((i) => i.id === invite.id ? { ...i, followUps: [...i.followUps, { id: Math.random().toString(), timestamp: new Date().toISOString().slice(0, 10), note: "Manual follow-up logged" }] } : i))}>log follow-up ({invite.followUps.length})</button></div>;
                  })}</div>
                </div>
              ))}
            </div>
          </section>
        )}

        {activeTab === "scope" && (
          <section className="rounded-2xl border border-slate-200 bg-white p-4">
            <h3 className="mb-3 font-semibold">Scope Library</h3>
            <div className="grid gap-3 md:grid-cols-3">{projectTrades.map((trade) => <div key={trade.id} className="rounded-xl border border-slate-200 p-3"><p className="font-medium">{trade.tradeName}</p><ul className="mt-2 space-y-1 text-xs text-slate-600">{scopeLibrary.filter((item) => item.tradeName.toLowerCase().includes(trade.tradeName.split(" ")[0].toLowerCase())).slice(0, 3).map((item) => <li key={item.id} className="flex items-center gap-2"><input type="checkbox" />{item.text}</li>)}<li className="text-slate-400">Select to add into a bid (local state only).</li></ul></div>)}</div>
          </section>
        )}

        {activeTab === "outcomes" && (
          <section className="rounded-2xl border border-slate-200 bg-white p-4">
            <h3 className="mb-3 font-semibold">Outcomes</h3>
            <p className="mb-3 text-xs text-slate-500">Outcomes build vendor intelligence over time.</p>
            <div className="overflow-x-auto"><table className="min-w-full text-sm"><thead className="text-xs text-slate-500"><tr><th className="pb-2">Trade</th><th>Awarded</th><th>Original</th><th>Executed</th><th>Approved CO</th><th>Final Contract</th><th>Schedule</th><th>Quality</th><th>Hire Again</th></tr></thead><tbody>{projectTrades.map((trade) => { const outcome = outcomes.find((o) => o.tradePackageId === trade.id); const finalValue = (outcome?.executedContractAmount ?? 0) + (outcome?.approvedCOAmount ?? 0); return <tr key={trade.id} className="border-t border-slate-100"><td className="py-2">{trade.tradeName}</td><td>{outcome?.awarded ? "Yes" : "No"}</td><td>{outcome?.originalBidAmount ? `$${outcome.originalBidAmount.toLocaleString()}` : "—"}</td><td>{outcome?.executedContractAmount ? `$${outcome.executedContractAmount.toLocaleString()}` : "—"}</td><td>{outcome?.approvedCOAmount ? `$${outcome.approvedCOAmount.toLocaleString()}` : "—"}</td><td>{finalValue ? `$${finalValue.toLocaleString()}` : "—"}</td><td>{outcome?.scheduleRating ?? "—"}</td><td>{outcome?.qualityRating ?? "—"}</td><td>{outcome?.wouldHireAgain === undefined ? "—" : outcome.wouldHireAgain ? "Yes" : "No"}</td></tr>; })}</tbody></table></div>
          </section>
        )}
      </div>

      {selectedSubmission && <BidDetailDrawer submission={selectedSubmission} onClose={() => setSelectedSubmission(null)} />}
    </main>
  );
}

function BidDetailDrawer({ submission, onClose }: { submission: BidSubmission; onClose: () => void }) {
  const vendor = vendors.find((v) => v.id === submission.vendorId);
  const trade = tradePackages.find((t) => t.id === submission.tradePackageId);
  return (
    <div className="fixed inset-0 z-50 bg-black/30" onClick={onClose}>
      <aside className="absolute right-0 top-0 h-full w-full max-w-2xl overflow-y-auto bg-white p-5" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-start justify-between"><div><h3 className="text-xl font-semibold">Bid Detail</h3><p className="text-sm text-slate-500">{vendor?.companyName} · {trade?.tradeName}</p></div><button onClick={onClose}>✕</button></div>
        <div className="grid grid-cols-2 gap-3 text-sm"><Card label="Status" value={submission.status} /><Card label="Amount" value={submission.lumpSum ? `$${submission.lumpSum.toLocaleString()}` : "—"} /><Card label="Received" value={submission.receivedDate ?? "—"} /><Card label="Revision" value={submission.activeRevision} /></div>
        <section className="mt-4 rounded-xl border border-slate-200 p-3"><h4 className="mb-2 font-medium">Scope Tags</h4><div className="grid grid-cols-2 gap-2 text-xs">{Object.entries(submission.scopeTags).map(([tag, enabled]) => <label key={tag} className="flex items-center gap-2"><input type="checkbox" checked={enabled} readOnly />{tag}</label>)}</div></section>
        <ListBlock title="Inclusions" items={submission.inclusions} />
        <ListBlock title="Exclusions" items={submission.exclusions} />
        <ListBlock title="Clarifications/Assumptions" items={submission.clarifications} />
        <section className="mt-4 rounded-xl border border-slate-200 p-3"><h4 className="mb-2 font-medium">Alternates</h4>{submission.alternates.map((alt) => <p key={alt.id} className="text-xs text-slate-700">{alt.name} · {alt.deltaAmount > 0 ? "+" : ""}${alt.deltaAmount.toLocaleString()} · {alt.notes}</p>)}</section>
        <section className="mt-4 rounded-xl border border-slate-200 p-3"><h4 className="mb-2 font-medium">Attachments</h4>{submission.attachments.map((att) => <p key={att.id} className="text-xs text-slate-700">{att.fileName} ({att.fileType}) · {att.date}</p>)}</section>
        <section className="mt-4 rounded-xl border border-slate-200 p-3"><h4 className="mb-2 font-medium">Internal Notes + Confidence</h4><p className="text-xs text-slate-700">{submission.internalNotes}</p><p className="mt-1 text-xs text-slate-500">Confidence: {submission.confidence}</p></section>
      </aside>
    </div>
  );
}

function Card({ label, value }: { label: string; value: string }) { return <div className="rounded-xl border border-slate-200 p-2"><p className="text-xs text-slate-500">{label}</p><p className="text-sm font-medium text-slate-800">{value}</p></div>; }

function ListBlock({ title, items }: { title: string; items: string[] }) {
  return <section className="mt-4 rounded-xl border border-slate-200 p-3"><h4 className="mb-2 font-medium">{title}</h4><ul className="list-inside list-disc text-xs text-slate-700">{items.map((item, idx) => <li key={idx}>{item}</li>)}</ul></section>;
}
