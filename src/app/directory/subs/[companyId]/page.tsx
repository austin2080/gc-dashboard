import SubProfilePageClient from "@/components/directory/sub-profile/sub-profile-page-client";

type PageProps = {
  params: { companyId: string } | Promise<{ companyId: string }>;
};

export default async function SubDirectoryProfilePage({ params }: PageProps) {
  const resolved = await Promise.resolve(params);
  return <SubProfilePageClient companyId={resolved.companyId} />;
}
