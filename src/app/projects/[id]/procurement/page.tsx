import ProcurementTracker from "@/components/procurement/procurement-tracker";

type PageProps = {
  params: { id: string } | Promise<{ id: string }>;
};

export default async function ProjectProcurementPage({ params }: PageProps) {
  const resolved = await Promise.resolve(params);
  const projectId = resolved?.id ?? "";

  return (
    <main className="space-y-6 p-6">
      <ProcurementTracker projectId={projectId} projectName="Procurement Workspace" />
    </main>
  );
}
