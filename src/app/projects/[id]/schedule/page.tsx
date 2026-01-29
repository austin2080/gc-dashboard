import ScheduleGantt from "./ScheduleGantt";

export default function ProjectSchedulePage() {
  return (
    <main className="p-6 space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">Schedule</h1>
        <p className="text-sm opacity-80">
          Build, track, and adjust your project plan with a Gantt-style timeline.
        </p>
      </header>
      <ScheduleGantt />
    </main>
  );
}
