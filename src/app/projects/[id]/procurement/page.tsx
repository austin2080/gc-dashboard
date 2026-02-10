import ProcurementTracker from "@/components/procurement/procurement-tracker";

type Props = {
  params: { id: string };
};

export default function ProjectProcurementPage({ params }: Props) {
  return <ProcurementTracker projectId={params.id} />;
}
