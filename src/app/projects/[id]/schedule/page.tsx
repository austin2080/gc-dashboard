import ScheduleGantt from "./ScheduleGantt";

type PageProps = {
  params: { id: string } | Promise<{ id: string }>;
};

export default async function ProjectSchedulePage({ params }: PageProps) {
  const resolved = await Promise.resolve(params);
  const projectId =
    typeof resolved?.id === "string"
      ? resolved.id.trim()
      : Array.isArray(resolved?.id)
        ? resolved.id[0]
        : "";

  return (
    <main className="p-6 space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">Schedule</h1>
        <p className="text-sm opacity-80">
          Build, track, and adjust your project plan with a Gantt-style timeline.
        </p>
      </header>
      <ScheduleGantt key={projectId || "project-schedule"} projectId={projectId} />
    </main>
  );
}
