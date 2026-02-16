"use client";

import Link from "next/link";
import type { ModuleKey } from "@/lib/access/modules";

const MODULE_LABEL: Record<ModuleKey, string> = {
  bidding: "Bidding",
  waiverdesk: "WaiverDesk",
  pm: "Project Management",
};

const MODULE_FEATURES: Record<ModuleKey, string[]> = {
  bidding: [
    "Bid board, owner bids, and analytics",
    "Subcontractor directory and invite workflows",
    "Coverage and response tracking",
  ],
  waiverdesk: [
    "Waiver collection tracking",
    "Vendor waiver status and exceptions",
    "Pay-app blocking based on waiver compliance",
  ],
  pm: [
    "Project dashboard and portfolio views",
    "RFIs, submittals, and change order workflows",
    "Budget, contract, and pay app management",
  ],
};

export default function UpgradeWall({ module }: { module: ModuleKey }) {
  const label = MODULE_LABEL[module];

  return (
    <section className="mx-auto w-full max-w-3xl rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
        Upgrade Required
      </p>
      <h1 className="mt-2 text-3xl font-semibold text-slate-900">
        Upgrade to unlock {label}
      </h1>
      <p className="mt-3 text-sm text-slate-600">
        Your company plan does not include this module yet.
      </p>

      <ul className="mt-6 space-y-2 text-sm text-slate-700">
        {MODULE_FEATURES[module].map((item) => (
          <li key={item} className="rounded-lg bg-slate-50 px-3 py-2">
            {item}
          </li>
        ))}
      </ul>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <button
          type="button"
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white"
        >
          Request Access
        </button>
        <Link
          href="/bidding"
          className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700"
        >
          Back to Bidding
        </Link>
      </div>
    </section>
  );
}
