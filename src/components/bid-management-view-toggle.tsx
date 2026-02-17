"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

const VIEWS = [
  { label: "Overview", href: "/bidding" },
  { label: "Invites", href: "/bidding/itbs" },
  { label: "Leveling", href: "/bidding/bid-leveling" },
];

function withProjectQuery(href: string, projectId: string | null) {
  if (!projectId) return href;
  const params = new URLSearchParams();
  params.set("project", projectId);
  return `${href}?${params.toString()}`;
}

export default function BidManagementViewToggle() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const projectId = searchParams.get("project");

  return (
    <nav
      aria-label="Bid Management Views"
      className="inline-flex w-fit items-center gap-1 rounded-xl border border-slate-200 bg-white p-1 shadow-sm"
    >
      {VIEWS.map((view) => {
        const active = pathname === view.href;
        return (
          <Link
            key={view.href}
            href={withProjectQuery(view.href, projectId)}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
              active ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            {view.label}
          </Link>
        );
      })}
    </nav>
  );
}
