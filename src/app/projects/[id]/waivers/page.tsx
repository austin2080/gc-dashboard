import ProjectLienWaiversWorkspace from "@/components/waivers/project-lien-waivers-workspace";

type PageProps = {
  params: { id: string } | Promise<{ id: string }>;
};

export default async function ProjectLienWaiversPage({ params }: PageProps) {
  const resolved = await Promise.resolve(params);
  const projectId = resolved?.id ?? "default";

  return <ProjectLienWaiversWorkspace projectId={projectId} />;
}
