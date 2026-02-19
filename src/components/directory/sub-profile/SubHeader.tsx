"use client";

import Link from "next/link";
import { useState } from "react";
import type { SubProfileCompany } from "@/components/directory/sub-profile/types";

type Props = {
  company: SubProfileCompany;
  deleting: boolean;
  saving: boolean;
  onEdit: () => void;
  onToggleStatus: () => void;
  onDelete: () => void;
};

export default function SubHeader({
  company,
  deleting,
  saving,
  onEdit,
  onToggleStatus,
  onDelete,
}: Props) {
  const [moreOpen, setMoreOpen] = useState(false);
  const isActive = company.status === "Active";

  return (
    <header className="rounded-xl border border-black/10 bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <Link href="/directory" className="inline-flex items-center text-sm text-black/70 hover:underline">
            Back to Directory
          </Link>
          <h1 className="text-3xl font-semibold tracking-tight">{company.company_name}</h1>
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                isActive ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-700"
              }`}
            >
              {company.status}
            </span>
            <span className="text-sm text-black/60">{company.trade ?? "Trade not set"}</span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onEdit}
            className="rounded-lg border border-black/15 px-3 py-2 text-sm hover:bg-black/[0.03]"
          >
            Edit Sub
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={onToggleStatus}
            className="rounded-lg border border-black/15 px-3 py-2 text-sm disabled:opacity-60 hover:bg-black/[0.03]"
          >
            Set {isActive ? "Inactive" : "Active"}
          </button>
          <div className="relative">
            <button
              type="button"
              onClick={() => setMoreOpen((prev) => !prev)}
              className="rounded-lg border border-black/15 px-3 py-2 text-sm hover:bg-black/[0.03]"
            >
              More
            </button>
            {moreOpen ? (
              <div className="absolute right-0 z-30 mt-2 w-44 rounded-lg border border-black/10 bg-white p-1 shadow-lg">
                <button
                  type="button"
                  disabled={deleting}
                  onClick={() => {
                    setMoreOpen(false);
                    onDelete();
                  }}
                  className="w-full rounded-md px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50 disabled:opacity-60"
                >
                  Delete
                </button>
                <button
                  type="button"
                  disabled
                  className="w-full rounded-md px-3 py-2 text-left text-sm text-black/40"
                >
                  Merge (coming soon)
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </header>
  );
}
