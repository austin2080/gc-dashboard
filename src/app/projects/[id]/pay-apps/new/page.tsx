import { redirect } from "next/navigation";

type PageProps = {
  params: { id: string } | Promise<{ id: string }>;
};

export default async function NewPayAppPage({ params }: PageProps) {
  const resolved = await Promise.resolve(params);
  redirect(`/projects/${resolved.id}/pay-apps`);
}
