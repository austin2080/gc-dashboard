import SubBidWorkspace from "@/components/bids/sub-workspace";

export default async function SubBidWorkspacePage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  return <SubBidWorkspace projectId={projectId} />;
}
