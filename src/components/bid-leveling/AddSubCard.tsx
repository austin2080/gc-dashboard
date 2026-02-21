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
    <div className="relative w-[210px] flex-none rounded-xl border border-dashed border-slate-300 bg-slate-50 p-3">
      <button
        type="button"
        disabled={readOnly}
        onClick={() => setOpen((prev) => !prev)}
        className="w-full rounded-lg border border-slate-200 bg-white px-2 py-2 text-xs font-semibold text-slate-700 disabled:bg-slate-100"
      >
        + Add sub
      </button>

      {open ? (
        <div className="absolute left-0 top-[calc(100%+6px)] z-20 w-[260px] rounded-xl border border-slate-200 bg-white p-2 shadow-xl">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search subs"
            className="mb-2 w-full rounded-md border border-slate-200 px-2 py-1.5 text-xs"
          />
          <div className="max-h-48 overflow-auto">
            {filtered.length ? (
              filtered.map((sub) => (
                <button
                  key={sub.id}
                  type="button"
                  onClick={() => {
                    onAdd(sub.id);
                    setSearch("");
                    setOpen(false);
                  }}
                  className="block w-full rounded-md px-2 py-1.5 text-left text-xs text-slate-700 hover:bg-slate-100"
                >
                  {sub.subcontractor?.company_name ?? "Unnamed sub"}
                </button>
              ))
            ) : (
              <p className="px-2 py-1.5 text-xs text-slate-500">No matching subs</p>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
