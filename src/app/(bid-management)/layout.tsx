"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BidManagementToolbarProvider, useBidManagementToolbar } from "@/components/bidding/bid-management-toolbar";

function BidManagementLayoutShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { actions } = useBidManagementToolbar();
  const isBidding = pathname === "/bidding";
  const isOwnerBids = pathname === "/bidding/owner-bids";
  const isBids = pathname === "/bids";
  const isTemplates = pathname.startsWith("/bidding/templates");

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="sticky top-0 z-30 bg-slate-50">
        <div className="px-4 pt-4 sm:px-6">
          <div className="rounded-2xl bg-white px-6 py-5">
            <h1 className="text-4xl font-semibold text-slate-900">Bid Management</h1>
          </div>
        </div>
        <div className="px-4 sm:px-6">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 px-6 text-base font-medium">
            <nav className="flex flex-wrap items-center gap-8">
              <Link
                href="/bidding"
                className={isBidding ? "border-b-2 border-slate-900 pb-3 text-slate-900" : "pb-3 text-slate-500 hover:text-slate-700"}
              >
                Active Bids
              </Link>
              <Link
                href="/bidding/owner-bids"
                className={isOwnerBids ? "border-b-2 border-slate-900 pb-3 text-slate-900" : "pb-3 text-slate-500 hover:text-slate-700"}
              >
                Owner Bids
              </Link>
              <Link
                href="/bids"
                className={isBids ? "border-b-2 border-slate-900 pb-3 text-slate-900" : "pb-3 text-slate-500 hover:text-slate-700"}
              >
                Bid Analytics
              </Link>
              <Link
                href="/bidding/templates"
                className={isTemplates ? "border-b-2 border-slate-900 pb-3 text-slate-900" : "pb-3 text-slate-500 hover:text-slate-700"}
              >
                Templates
              </Link>
            </nav>
            {actions ? <div className="pb-3">{actions}</div> : null}
          </div>
        </div>
      </div>
      {children}
    </div>
  );
}

export default function BidManagementLayout({ children }: { children: React.ReactNode }) {
  return (
    <BidManagementToolbarProvider>
      <BidManagementLayoutShell>{children}</BidManagementLayoutShell>
    </BidManagementToolbarProvider>
  );
}
