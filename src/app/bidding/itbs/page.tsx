import BidManagementViewToggle from "@/components/bid-management-view-toggle";
import BiddingProjectTabs from "@/components/bidding-project-tabs";
import ItbsProjectBidTable from "@/components/itbs-project-bid-table";

export default function ItbsPage() {
  return (
    <main className="p-6 space-y-3">
      <BidManagementViewToggle />
      <BiddingProjectTabs />
      <h1 className="text-2xl font-semibold">ITBs</h1>
      <p className="text-sm opacity-80">
        Create, send, and track invitations to bid (coming soon).
      </p>
      <ItbsProjectBidTable />
    </main>
  );
}
