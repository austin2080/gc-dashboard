import BiddingTabPageHeader from "@/components/bidding-tab-page-header";
import EstimateWorkspaceV2 from "@/components/bidding/estimate-workspace-v2";

export default function BiddingEstimatePage() {
  return (
    <main className="space-y-6 bg-slate-50 px-4 pb-4 pt-[2px] sm:px-6 sm:pb-6 sm:pt-[2px]">
      <BiddingTabPageHeader label="Estimate" />
      <EstimateWorkspaceV2 />
    </main>
  );
}
