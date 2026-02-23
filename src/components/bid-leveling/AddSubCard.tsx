"use client";

import { useMemo, useState } from "react";
import type { BidProjectSub } from "@/lib/bidding/types";

type AddSubCardProps = {
  availableSubs: BidProjectSub[];
  readOnly: boolean;
  onAdd: (subId: string) => void;
};

export default function AddSubCard({ availableSubs, readOnly, onAdd }: AddSubCardProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const filtered = useMemo(
    () =>
      availableSubs.filter((sub) =>
        (sub.subcontractor?.company_name ?? "").toLowerCase().includes(search.trim().toLowerCase())
      ),
    [availableSubs, search]
  );

  return (
    <div className="w-[210px] flex-none rounded-xl border border-dashed border-slate-300 bg-slate-50 p-3">
      <button
        type="button"
        disabled={readOnly}
        onClick={() => setOpen(true)}
        className="w-full rounded-lg border border-slate-200 bg-white px-2 py-2 text-xs font-semibold text-slate-700 disabled:bg-slate-100"
      >
        + Add sub
      </button>

      {open ? (
        <div className="fixed inset-0 z-50">
          <button
            type="button"
            aria-label="Close add sub drawer"
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-slate-900/35"
          />
          <aside className="absolute right-0 top-0 h-full w-full max-w-md border-l border-slate-200 bg-white p-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 className="text-sm font-semibold text-slate-900">Add sub to trade</h3>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-md border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50"
              >
                Close
              </button>
            </div>

            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search subs"
              className="mt-4 w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
            />

            <div className="mt-3 max-h-[calc(100vh-170px)] overflow-auto pr-1">
              {filtered.length ? (
                <div className="space-y-1.5">
                  {filtered.map((sub) => (
                    <button
                      key={sub.id}
                      type="button"
                      onClick={() => {
                        onAdd(sub.id);
                        setSearch("");
                        setOpen(false);
                      }}
                      className="block w-full rounded-lg border border-slate-200 px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                    >
                      {sub.subcontractor?.company_name ?? "Unnamed sub"}
                    </button>
                  ))}
                </div>
              ) : (
                <p className="px-1 py-2 text-sm text-slate-500">No matching subs</p>
              )}
            </div>
          </aside>
        </div>
      ) : null}
    </div>
  );
}
