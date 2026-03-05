import BidManagementViewToggle from "@/components/bid-management-view-toggle";

export default function BiddingFilesPage() {
  return (
    <main className="space-y-3 p-6">
      <div className="sticky top-0 z-10 bg-slate-50/95 py-2 backdrop-blur">
        <BidManagementViewToggle />
      </div>
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-semibold text-slate-900">Files</h1>
        <p className="mt-2 text-sm text-slate-500">Bid package files workspace coming soon.</p>
      </section>
    </main>
  );
}
