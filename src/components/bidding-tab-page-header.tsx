"use client";

import BidManagementViewToggle from "@/components/bid-management-view-toggle";
import BiddingBreadcrumb from "@/components/bidding-breadcrumb";
import BiddingProjectHeading from "@/components/bidding-project-heading";

export default function BiddingTabPageHeader({ label }: { label: string }) {
  return (
    <header className="-mx-4 border-b border-slate-200 bg-white sm:-mx-6">
      <div className="px-6 pt-3 pb-1">
        <BiddingBreadcrumb label={label} />
      </div>
      <div className="flex flex-wrap items-start justify-between gap-4 px-6 pb-[2px]">
        <div>
          <BiddingProjectHeading />
        </div>
        <div className="flex flex-wrap items-center gap-3" />
      </div>
      <div className="px-6">
        <BidManagementViewToggle />
      </div>
    </header>
  );
}
