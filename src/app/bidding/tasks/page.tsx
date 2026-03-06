import BiddingTabPageHeader from "@/components/bidding-tab-page-header";
import TasksWorkspace from "@/components/bidding/tasks-workspace";

export default function BiddingTasksPage() {
  return (
    <main className="space-y-6 bg-slate-50 px-4 pb-4 pt-[2px] sm:px-6 sm:pb-6 sm:pt-[2px]">
      <BiddingTabPageHeader label="Tasks" />
      <TasksWorkspace />
    </main>
  );
}
