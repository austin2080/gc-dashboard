import type { ReactNode } from "react";

type SettingsCardProps = {
  title?: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
};

export function SettingsCard({ title, subtitle, children, footer }: SettingsCardProps) {
  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      {title ? (
        <header className="border-b border-slate-200 px-5 py-4">
          <h3 className="text-base font-semibold text-slate-900">{title}</h3>
          {subtitle ? <p className="mt-1 text-sm text-slate-600">{subtitle}</p> : null}
        </header>
      ) : null}
      <div className="px-5 py-4">{children}</div>
      {footer ? <footer className="border-t border-slate-200 px-5 py-4">{footer}</footer> : null}
    </section>
  );
}
