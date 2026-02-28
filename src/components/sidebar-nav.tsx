"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type NavItem = {
  label: string;
  href?: string;
  children?: NavItem[];
  comingSoon?: boolean;
};

const NAV: NavItem[] = [
  {
    label: "Dashboard",
    href: "/dashboard",
    children: [
      { label: "Central portfolio view", comingSoon: true },
      { label: "Health/status indicators", comingSoon: true },
      { label: "Alerts & risks", comingSoon: true },
    ],
  },
  {
    label: "Projects",
    href: "/projects",
    children: [
      { label: "Overview", comingSoon: true },
      { label: "Bidding", comingSoon: true },
      { label: "Procurement", comingSoon: true },
      { label: "Directory", comingSoon: true },
    ],
  },
  {
    label: "Bidding",
    href: "/bidding/all",
    children: [
      { label: "ITBs", comingSoon: true },
      { label: "Bid Leveling", comingSoon: true },
      { label: "Vendor Coverage", comingSoon: true },
    ],
  },
  {
    label: "Subcontractor Directory",
    href: "/subcontractors",
  },
  {
    label: "Procurement Tracking",
    href: "/procurement",
  },
];

function isActive(pathname: string, href?: string) {
  if (!href) return false;
  if (href === "/dashboard") return pathname === "/dashboard";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function SidebarNav() {
  const pathname = usePathname();

  return (
    <aside className="w-64 shrink-0 border-r border-black/10 bg-white">
      <div className="sticky top-0 h-screen overflow-auto p-4">
        <div className="mb-6">
          <div className="text-xs uppercase tracking-widest opacity-60">GC</div>
          <div className="text-lg font-semibold">Dashboard</div>
        </div>

        <nav className="space-y-4">
          {NAV.map((item) => {
            const active = isActive(pathname, item.href);
            return (
              <div key={item.label} className="space-y-2">
                {item.href ? (
                  <Link
                    href={item.href}
                    className={`block rounded px-2 py-1 text-sm transition-colors ${
                      active ? "bg-black/5 text-black" : "text-black/80 hover:bg-black/[0.03]"
                    }`}
                  >
                    {item.label}
                  </Link>
                ) : (
                  <div className="px-2 text-sm opacity-70">{item.label}</div>
                )}

                {item.children ? (
                  <div className="ml-2 space-y-1 border-l border-black/10 pl-2">
                    {item.children.map((child) => (
                      <div
                        key={child.label}
                        className={`text-xs ${
                          child.comingSoon ? "opacity-50" : "opacity-80"
                        }`}
                        title={child.comingSoon ? "Coming soon" : undefined}
                      >
                        {child.label}
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            );
          })}
        </nav>
      </div>
    </aside>
  );
}
