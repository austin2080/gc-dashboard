import type { ReactNode } from "react";
import type { SettingsNavItem, SettingsSectionId } from "./types";
import { SettingsNav } from "./SettingsNav";

type SettingsLayoutProps = {
  items: SettingsNavItem[];
  activeSection: SettingsSectionId;
  onSectionChange: (section: SettingsSectionId) => void;
  saveStatus: "saved" | "unsaved";
  children: ReactNode;
  onSave: () => void;
  onCancel: () => void;
};

export function SettingsLayout({
  items,
  activeSection,
  onSectionChange,
  saveStatus,
  children,
  onSave,
  onCancel,
}: SettingsLayoutProps) {
  return (
    <div className="mx-auto max-w-7xl p-4 md:p-6">
      <header className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h1 className="text-3xl font-semibold text-slate-900">Settings</h1>
        <p className="mt-2 text-sm text-slate-600">
          Manage your company, team, permissions, and defaults.
        </p>
      </header>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-[260px_minmax(0,1fr)] md:gap-6">
        <aside>
          <SettingsNav items={items} activeSection={activeSection} onChange={onSectionChange} />
        </aside>

        <section className="space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-center gap-3">
              <label className="text-sm font-medium text-slate-700" htmlFor="active-company">
                Active Company
              </label>
              <select
                id="active-company"
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                defaultValue="builderos"
              >
                <option value="builderos">BuilderOS Construction</option>
                <option value="coastal">Coastal GC Partners</option>
              </select>
              <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-700">
                Production
              </span>
              <span
                className={`rounded-full px-3 py-1 text-xs font-semibold ${
                  saveStatus === "saved"
                    ? "bg-emerald-100 text-emerald-700"
                    : "bg-amber-100 text-amber-700"
                }`}
              >
                {saveStatus === "saved" ? "All changes saved" : "Unsaved changes"}
              </span>
            </div>
          </div>

          {children}
        </section>
      </div>

      {saveStatus === "unsaved" ? (
        <div className="sticky bottom-4 mt-6 flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-4 shadow-lg">
          <p className="text-sm text-slate-600">You have unsaved settings changes.</p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
              onClick={onCancel}
            >
              Cancel
            </button>
            <button
              type="button"
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
              onClick={onSave}
            >
              Save changes
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
