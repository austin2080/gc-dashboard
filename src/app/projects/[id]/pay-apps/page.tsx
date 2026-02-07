import PayAppsWorkspace from "@/components/pay-apps/pay-apps-workspace";

type PageProps = {
  params: { id: string } | Promise<{ id: string }>;
};

export default async function ProjectPayAppsPage({ params }: PageProps) {
  const resolved = await Promise.resolve(params);
  const projectId = resolved?.id ?? "default";

  return <PayAppsWorkspace projectId={projectId} />;
}
