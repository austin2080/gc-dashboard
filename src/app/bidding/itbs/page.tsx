import BidManagementViewToggle from "@/components/bid-management-view-toggle";

export default function ItbsPage() {
  return (
    <main className="p-6 space-y-2">
      <BidManagementViewToggle />
      <h1 className="text-2xl font-semibold">ITBs</h1>
      <p className="text-sm opacity-80">
        Create, send, and track invitations to bid (coming soon).
      </p>
    </main>
  );
}
