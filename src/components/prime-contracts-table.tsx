"use client";

import type { KeyboardEvent } from "react";
import { useRouter } from "next/navigation";

export type ContractRow = {
  id: string;
  project_number: string;
  owner_name: string | null;
  title: string;
  status: "draft" | "out_for_signature" | "approved" | "rejected";
  executed: boolean;
  original_amount: number;
  created_at: string;
  updated_at: string;
};

function money(n: number) {
  return n.toLocaleString(undefined, { style: "currency", currency: "USD" });
}

function statusLabel(status: ContractRow["status"]) {
  switch (status) {
    case "approved":
      return "Approved";
    case "out_for_signature":
      return "Out for Signature";
    case "rejected":
      return "Rejected";
    default:
      return "Draft";
  }
}

function statusStyle(status: ContractRow["status"]) {
  switch (status) {
    case "approved":
      return "border border-green-500/50 text-green-700";
    case "out_for_signature":
      return "border border-yellow-500/50 text-yellow-700";
    case "rejected":
      return "border border-red-500/50 text-red-700";
    default:
      return "border border-black/30 text-black";
  }
}

export default function PrimeContractsTable({
  projectId,
  contracts,
}: {
  projectId: string;
  contracts: ContractRow[];
}) {
  const router = useRouter();

  function onRowClick(id: string) {
    router.push(`/projects/${projectId}/contract/${id}`);
  }

  function onRowKeyDown(id: string, e: KeyboardEvent<HTMLTableRowElement>) {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      router.push(`/projects/${projectId}/contract/${id}`);
    }
  }

  const totalAmount = contracts.reduce(
    (sum, c) => sum + (c.original_amount || 0),
    0
  );

  return (
    <section className="border rounded-lg">
      <div className="p-4 border-b">
        <h2 className="font-semibold">Contracts</h2>
        <p className="text-sm opacity-70">
          Click a contract to view details, line items, and attachments.
        </p>
      </div>

      <div className="max-h-[calc(100vh-280px)] overflow-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-black/5 backdrop-blur border-b">
            <tr>
              <th className="text-left p-3">Project #</th>
              <th className="text-left p-3">Owner/Client</th>
              <th className="text-left p-3">Title</th>
              <th className="text-left p-3">Status</th>
              <th className="text-left p-3">Executed</th>
              <th className="text-right p-3">Original Amount</th>
              <th className="text-left p-3">Created</th>
              <th className="text-left p-3">Updated</th>
            </tr>
          </thead>
          <tbody>
            {contracts.length === 0 ? (
              <tr>
                <td className="p-4 opacity-70" colSpan={8}>
                  No contracts yet. Click “New Contract” to add one.
                </td>
              </tr>
            ) : (
              contracts.map((c) => (
                <tr
                  key={c.id}
                  className="border-b last:border-b-0 cursor-pointer transition-colors hover:[&>td]:bg-black/[0.03] active:[&>td]:bg-black/[0.06] focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40"
                  onClick={() => onRowClick(c.id)}
                  onKeyDown={(e) => onRowKeyDown(c.id, e)}
                  role="link"
                  tabIndex={0}
                >
                  <td className="p-3">{c.project_number}</td>
                  <td className="p-3">{c.owner_name ?? "-"}</td>
                  <td className="p-3 font-medium">{c.title}</td>
                  <td className="p-3">
                    <span className={`rounded-full px-2 py-1 text-xs ${statusStyle(c.status)}`}>
                      {statusLabel(c.status)}
                    </span>
                  </td>
                  <td className="p-3">{c.executed ? "Yes" : "No"}</td>
                  <td className="p-3 text-right">{money(c.original_amount)}</td>
                  <td className="p-3">{new Date(c.created_at).toLocaleDateString()}</td>
                  <td className="p-3">{new Date(c.updated_at).toLocaleDateString()}</td>
                </tr>
              ))
            )}
          </tbody>
          <tfoot>
            <tr className="border-t bg-black/[0.02]">
              <td className="p-3 text-sm font-medium" colSpan={5}>
                Total Contract Amount
              </td>
              <td className="p-3 text-right font-semibold">{money(totalAmount)}</td>
              <td className="p-3" colSpan={2}></td>
            </tr>
          </tfoot>
        </table>
      </div>
    </section>
  );
}
