import type { SettingsNavItem, SettingsSectionId } from "./types";

type SettingsNavProps = {
  items: SettingsNavItem[];
  activeSection: SettingsSectionId;
  onChange: (section: SettingsSectionId) => void;
};

export function SettingsNav({ items, activeSection, onChange }: SettingsNavProps) {
  return (
    <>
      <label className="sr-only" htmlFor="settings-section-select">
        Select settings section
      </label>
      <select
        id="settings-section-select"
        className="mb-4 w-full rounded-xl border border-slate-300 bg-white p-3 text-sm md:hidden"
        value={activeSection}
        onChange={(event) => onChange(event.target.value as SettingsSectionId)}
      >
        {items.map((item) => (
          <option key={item.id} value={item.id}>
            {item.label}
          </option>
        ))}
      </select>

      <nav className="sticky top-24 hidden rounded-2xl border border-slate-200 bg-white p-2 shadow-sm md:block">
        <ul className="space-y-1">
          {items.map((item) => {
            const isActive = item.id === activeSection;
            return (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => onChange(item.id)}
                  className={`w-full rounded-xl px-3 py-2 text-left transition ${
                    isActive
                      ? "bg-slate-900 text-white"
                      : "text-slate-700 hover:bg-slate-100"
                  }`}
                  aria-current={isActive ? "page" : undefined}
                >
                  <div className="flex items-start gap-2">
                    <span aria-hidden="true" className="mt-0.5 text-sm">
                      {item.icon}
                    </span>
                    <div>
                      <div className="text-sm font-medium">{item.label}</div>
                      <div
                        className={`text-xs ${
                          isActive ? "text-slate-300" : "text-slate-500"
                        }`}
                      >
                        {item.description}
                      </div>
                    </div>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      </nav>
    </>
  );
}
