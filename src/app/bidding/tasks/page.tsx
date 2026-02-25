import BidManagementViewToggle from "@/components/bid-management-view-toggle";
import TasksWorkspace from "@/components/bidding/tasks-workspace";

export default function BiddingTasksPage() {
  return (
    <main className="space-y-3 p-6">
      <div className="sticky top-0 z-10 bg-slate-50/95 py-2 backdrop-blur">
        <BidManagementViewToggle />
      </div>
      <TasksWorkspace />
    </main>
  );
}
