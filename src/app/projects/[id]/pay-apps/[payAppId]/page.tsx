import PayAppDetailWorkspace from "@/components/pay-apps/pay-app-detail-workspace";

type PageProps = {
  params: { id: string; payAppId: string } | Promise<{ id: string; payAppId: string }>;
};

export default async function PayAppDetailPage({ params }: PageProps) {
  const resolved = await Promise.resolve(params);
  const projectId = resolved?.id ?? "default";
  const payAppId = resolved?.payAppId ?? "";

  return <PayAppDetailWorkspace projectId={projectId} payAppId={payAppId} />;
}
