"use client";

import Link from "next/link";

export default function BiddingBreadcrumb({ label }: { label: string }) {
  return (
    <div className="mb-1 flex items-center gap-2 text-sm text-slate-500">
      <Link href="/bidding/all" className="font-medium text-slate-600 hover:text-slate-900 hover:underline">
        Bid Packages
      </Link>
      <span aria-hidden>/</span>
      <span className="truncate text-slate-700">{label}</span>
    </div>
  );
}
