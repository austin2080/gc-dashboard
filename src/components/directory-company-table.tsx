"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
type CompanyRow = {
  id: string;
  name: string;
  mode?: string | null;
  created_at?: string | null;
};

type Props = {
  companies: CompanyRow[];
};

type SortKey = "name" | "mode" | "created_at";

export default function DirectoryCompanyTable({ companies }: Props) {
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q
      ? companies.filter((c) => {
          const haystack = `${c.name} ${c.mode ?? ""}`.toLowerCase();
          return haystack.includes(q);
        })
      : companies;

    const sorted = [...list].sort((a, b) => {
      const aVal = String(a[sortKey] ?? "").toLowerCase();
      const bVal = String(b[sortKey] ?? "").toLowerCase();
      if (aVal < bVal) return sortDir === "asc" ? -1 : 1;
      if (aVal > bVal) return sortDir === "asc" ? 1 : -1;
      return 0;
    });

    return sorted;
  }, [companies, query, sortKey, sortDir]);

  return (
    <section className="border rounded-lg">
      <div className="p-4 border-b flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="font-semibold">Subcontractors &amp; Vendors</h2>
          <p className="text-sm opacity-70">
            Search by company name or mode.
          </p>
        </div>
        
      </div>
      <div className="p-4 border-b grid grid-cols-1 md:grid-cols-4 gap-3 text-sm">
        <input
          className="rounded border border-black/20 px-3 py-2"
          placeholder="Search companies"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <label className="flex items-center gap-2">
          <span className="opacity-70">Sort</span>
          <select
            className="rounded border border-black/20 px-3 py-2"
            value={sortKey}
            onChange={(event) => setSortKey(event.target.value as SortKey)}
          >
            <option value="name">Company</option>
            <option value="mode">Mode</option>
            <option value="created_at">Created</option>
          </select>
        </label>
        <label className="flex items-center gap-2">
          <span className="opacity-70">Order</span>
          <select
            className="rounded border border-black/20 px-3 py-2"
            value={sortDir}
            onChange={(event) => setSortDir(event.target.value as "asc" | "desc")}
          >
            <option value="asc">A–Z</option>
            <option value="desc">Z–A</option>
          </select>
        </label>
        <div className="flex items-center justify-end text-xs opacity-60">
          {filtered.length} companies
        </div>
      </div>
      <div className="max-h-[520px] overflow-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-black/5 backdrop-blur border-b">
            <tr>
              <th className="text-left p-3">Company</th>
              <th className="text-left p-3">Mode</th>
              <th className="text-left p-3">Created</th>
              <th className="text-right p-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((company) => (
              <tr key={company.id} className="border-b last:border-b-0">
                <td className="p-3">
                  <Link className="underline" href={`/directory/${company.id}`}>
                    {company.name}
                  </Link>
                </td>
                <td className="p-3 capitalize">{company.mode ?? "-"}</td>
                <td className="p-3">
                  {company.created_at ? new Date(company.created_at).toLocaleDateString() : "-"}
                </td>
                <td className="p-3 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <Link className="text-xs underline" href={`/directory/${company.id}`}>
                      View
                    </Link>
                    <Link className="text-xs underline" href={`/directory/${company.id}/edit`}>
                      Edit
                    </Link>
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 ? (
              <tr>
                <td className="p-4 opacity-70" colSpan={5}>
                  No companies match this search.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </section>
  );
}
