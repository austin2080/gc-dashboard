"use client";

import { useState } from "react";

type Status = "draft" | "out_for_signature" | "approved";

function labelFor(status: Status) {
  switch (status) {
    case "approved":
      return "Approved";
    case "out_for_signature":
      return "Out for Signature";
    default:
      return "Draft";
  }
}

function styleFor(status: Status) {
  switch (status) {
    case "approved":
      return "border border-green-500/50 text-green-700";
    case "out_for_signature":
      return "border border-yellow-500/50 text-yellow-700";
    default:
      return "border border-black/30 text-black";
  }
}

export default function ContractStatusPill({ initialStatus }: { initialStatus?: Status }) {
  const [status, setStatus] = useState<Status>(initialStatus ?? "draft");

  return (
    <div className={`relative inline-flex items-center rounded-full px-3 py-1 text-xs ${styleFor(status)}`}>
      <span>{labelFor(status)}</span>
      <select
        className="absolute inset-0 opacity-0 cursor-pointer"
        value={status}
        onChange={(e) => setStatus(e.target.value as Status)}
        aria-label="Contract status"
      >
        <option value="draft">Draft</option>
        <option value="out_for_signature">Out for Signature</option>
        <option value="approved">Approved</option>
      </select>
      <span className="ml-2 opacity-60 pointer-events-none">▾</span>
    </div>
  );
}
