import type { ReactNode } from "react";

type SettingsSectionHeaderProps = {
  title: string;
  description: string;
  action?: ReactNode;
};

export function SettingsSectionHeader({
  title,
  description,
  action,
}: SettingsSectionHeaderProps) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 pb-4">
      <div>
        <h2 className="text-xl font-semibold text-slate-900">{title}</h2>
        <p className="mt-1 text-sm text-slate-600">{description}</p>
      </div>
      {action ? <div>{action}</div> : null}
    </div>
  );
}
