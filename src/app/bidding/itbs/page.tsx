import BiddingTabPageHeader from "@/components/bidding-tab-page-header";
import ItbsProjectBidTable from "@/components/itbs-project-bid-table";

export default function ItbsPage() {
  return (
    <main className="space-y-6 bg-slate-50 px-4 pb-4 pt-[2px] sm:px-6 sm:pb-6 sm:pt-[2px]">
      <BiddingTabPageHeader label="Invites" />
      <p className="text-sm opacity-80">
        Create, send, and track invitations to bid (coming soon).
      </p>
      <ItbsProjectBidTable />
    </main>
  );
}
