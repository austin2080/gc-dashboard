import BidManagementViewToggle from "@/components/bid-management-view-toggle";

export default function BidLevelingPage() {
  return (
    <main className="p-6 space-y-2">
      <BidManagementViewToggle />
      <h1 className="text-2xl font-semibold">Bid Leveling</h1>
      <p className="text-sm opacity-80">Side-by-side bid comparison (coming soon).</p>
    </main>
  );
}
