import ProjectDirectoryClient from "@/components/directory/project-directory-client";

type PageProps = {
  params: { id: string } | Promise<{ id: string }>;
};

export default async function ProjectDirectoryPage({ params }: PageProps) {
  const resolved = await Promise.resolve(params);

  return (
    <main className="space-y-4 p-6">
      <h1 className="text-2xl font-semibold">Project Directory</h1>
      <p className="text-sm opacity-80">
        Assign directory companies to this project for pay app and waiver workflows.
      </p>

      <ProjectDirectoryClient projectId={resolved.id} />
    </main>
  );
}
