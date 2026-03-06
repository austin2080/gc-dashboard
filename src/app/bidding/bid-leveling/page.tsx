import BiddingTabPageHeader from "@/components/bidding-tab-page-header";
import LevelingPage from "@/components/bid-leveling/LevelingPage";

export default function BidLevelingPage() {
  return (
    <main className="space-y-6 bg-slate-50 px-4 pb-4 pt-[2px] sm:px-6 sm:pb-6 sm:pt-[2px]">
      <BiddingTabPageHeader label="Leveling" />
      <LevelingPage />
    </main>
  );
}
