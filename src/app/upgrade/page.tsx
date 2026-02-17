import UpgradeWall from "@/components/access/upgrade-wall";
import type { ModuleKey } from "@/lib/access/modules";

type UpgradePageProps = {
  searchParams?: Promise<{ module?: string }> | { module?: string };
};

const VALID_MODULES = new Set<ModuleKey>(["bidding", "waiverdesk", "pm"]);

function toModuleKey(value: string | undefined): ModuleKey {
  if (!value) return "waiverdesk";
  return VALID_MODULES.has(value as ModuleKey)
    ? (value as ModuleKey)
    : "waiverdesk";
}

export default async function UpgradePage({ searchParams }: UpgradePageProps) {
  const resolved = await Promise.resolve(searchParams);
  const moduleKey = toModuleKey(resolved?.module);

  return (
    <main className="min-h-[calc(100vh-72px)] bg-slate-50 px-4 py-8 sm:px-6">
      <UpgradeWall module={moduleKey} />
    </main>
  );
}
