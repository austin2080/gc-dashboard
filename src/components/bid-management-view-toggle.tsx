"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

const VIEWS = [
  { label: "Overview", href: "/bidding" },
  { label: "Files", href: "/bidding/files" },
  { label: "Bidding", href: "/bidding/all" },
  { label: "Invites", href: "/bidding/itbs" },
  { label: "Leveling", href: "/bidding/bid-leveling" },
  { label: "Tasks", href: "/bidding/tasks" },
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
    <nav aria-label="Bid Management Views" className="flex w-full flex-wrap items-center gap-8 border-b border-slate-200">
      {VIEWS.map((view) => {
        const active = pathname === view.href;
        return (
          <Link
            key={view.href}
            href={withProjectQuery(view.href, projectId)}
            className={`border-b-2 px-1 pb-1 pt-2 text-base font-medium transition ${
              active
                ? "border-slate-900 text-slate-900"
                : "border-transparent text-slate-600 hover:border-slate-300 hover:text-slate-900"
            }`}
          >
            {view.label}
          </Link>
        );
      })}
    </nav>
  );
}
