import BiddingTabPageHeader from "@/components/bidding-tab-page-header";

export default function BiddingFilesPage() {
  return (
    <main className="space-y-6 bg-slate-50 px-4 pb-4 pt-[2px] sm:px-6 sm:pb-6 sm:pt-[2px]">
      <BiddingTabPageHeader label="Files" />
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="mt-2 text-sm text-slate-500">Bid package files workspace coming soon.</p>
      </section>
    </main>
  );
}
