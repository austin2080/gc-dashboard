import BidManagementViewToggle from "@/components/bid-management-view-toggle";
import LevelingPage from "@/components/bid-leveling/LevelingPage";

export default function BidLevelingPage() {
  return (
    <main className="space-y-3 p-6">
      <div className="sticky top-0 z-40 bg-slate-50/95 py-2 backdrop-blur">
        <BidManagementViewToggle />
      </div>
      <LevelingPage />
    </main>
  );
}
