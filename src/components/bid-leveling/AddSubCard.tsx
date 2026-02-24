"use client";

import { useMemo, useState } from "react";
import type { BidProjectSub } from "@/lib/bidding/types";

type AddSubCardProps = {
  availableSubs: BidProjectSub[];
  readOnly: boolean;
  onAdd: (subId: string) => void;
  onCreateAndAdd: (payload: {
    companyName: string;
    contact: string;
    email: string;
    phone: string;
  }) => Promise<void>;
};

export default function AddSubCard({
  availableSubs,
  readOnly,
  onAdd,
  onCreateAndAdd,
}: AddSubCardProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [mode, setMode] = useState<"search" | "create">("search");
  const [companyName, setCompanyName] = useState("");
  const [contact, setContact] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [submitting, setSubmitting] = useState(false);

  function resetDrawer() {
    setOpen(false);
    setSearch("");
    setMode("search");
    setCompanyName("");
    setContact("");
    setEmail("");
    setPhone("");
    setSubmitting(false);
  }

  const filtered = useMemo(
    () =>
      availableSubs.filter((sub) =>
        (sub.subcontractor?.company_name ?? "")
          .toLowerCase()
          .includes(search.trim().toLowerCase()),
      ),
    [availableSubs, search],
  );

  return (
    <div className="w-[210px] flex-none rounded-xl border border-dashed border-slate-300 bg-slate-50 p-3">
      <button
        type="button"
        disabled={readOnly}
        onClick={() => {
          resetDrawer();
          setOpen(true);
        }}
        className="w-full rounded-lg border border-slate-200 bg-white px-2 py-2 text-xs font-semibold text-slate-700 disabled:bg-slate-100"
      >
        + Add sub
      </button>

      {open ? (
        <div className="fixed inset-0 z-50">
          <button
            type="button"
            aria-label="Close add sub drawer"
            onClick={resetDrawer}
            className="absolute inset-0 bg-slate-900/35"
          />
          <aside className="absolute right-0 top-0 h-full w-full max-w-md border-l border-slate-200 bg-white p-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 className="text-sm font-semibold text-slate-900">Add sub to trade</h3>
              <button
                type="button"
                onClick={resetDrawer}
                className="rounded-md border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50"
              >
                Close
              </button>
            </div>

            {mode === "search" ? (
              <>
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search subs"
                  className="mt-4 w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
                />

                <div className="mt-3 max-h-[calc(100vh-220px)] overflow-auto pr-1">
                  {filtered.length ? (
                    <div className="space-y-1.5">
                      {filtered.map((sub) => (
                        <button
                          key={sub.id}
                          type="button"
                          onClick={() => {
                            onAdd(sub.id);
                            resetDrawer();
                          }}
                          className="block w-full rounded-lg border border-slate-200 px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                        >
                          {sub.subcontractor?.company_name ?? "Unnamed sub"}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="px-1 py-2">
                      <p className="text-sm text-slate-500">No matching subs</p>
                      <button
                        type="button"
                        onClick={() => setMode("create")}
                        className="mt-2 rounded-md border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                      >
                        Create new sub
                      </button>
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => setMode("create")}
                  className="mt-3 rounded-md border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  + Create new sub
                </button>
              </>
            ) : (
              <form
                className="mt-4 space-y-3"
                onSubmit={async (event) => {
                  event.preventDefault();
                  if (!companyName.trim()) return;
                  setSubmitting(true);
                  await onCreateAndAdd({
                    companyName,
                    contact,
                    email,
                    phone,
                  });
                  resetDrawer();
                }}
              >
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">Company name *</label>
                  <input
                    value={companyName}
                    onChange={(event) => setCompanyName(event.target.value)}
                    placeholder="ABC Mechanical"
                    required
                    className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">Contact</label>
                  <input
                    value={contact}
                    onChange={(event) => setContact(event.target.value)}
                    placeholder="Jane Doe"
                    className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">Email</label>
                  <input
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="jane@abcmech.com"
                    type="email"
                    className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">Phone</label>
                  <input
                    value={phone}
                    onChange={(event) => setPhone(event.target.value)}
                    placeholder="(555) 123-4567"
                    className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
                  />
                </div>
                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setMode("search")}
                    className="rounded-md border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    Back
                  </button>
                  <button
                    type="submit"
                    disabled={submitting || !companyName.trim()}
                    className="rounded-md bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white disabled:bg-slate-400"
                  >
                    {submitting ? "Creating..." : "Create and add"}
                  </button>
                </div>
              </form>
            )}
          </aside>
        </div>
      ) : null}
    </div>
  );
}
