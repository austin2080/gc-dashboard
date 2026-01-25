"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ProjectRow } from "@/lib/db/projects";

const STATIC_NAV = [
  { label: "Dashboard", href: "/dashboard" },
  { label: "Projects", href: "/projects", hasDropdown: true },
  { label: "Cost Codes", href: "/cost-codes" },
  {
    label: "Bidding",
    href: "/bidding",
    children: [
      { label: "ITBs (create, send, track invitations)", href: "/bidding/itbs" },
      { label: "Bid Leveling (side-by-side comparison)", href: "/bidding/bid-leveling" },
      { label: "Vendor Coverage (trade gaps)", href: "/bidding/vendor-coverage" },
    ],
  },
  { label: "Directory", href: "/directory" },
  { label: "Procurement Tracking", href: "/procurement" },
];

function isActive(pathname: string, href: string) {
  if (href === "/dashboard") return pathname === "/dashboard";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function TopNavClient({ projects }: { projects: ProjectRow[] }) {
  const pathname = usePathname();

  const projectLinks = projects.map((p) => ({
    label: p.project_number ? `${p.project_number} - ${p.name}` : p.name,
    href: `/projects/${p.id}`,
  }));

  return (
    <header className="sticky top-0 z-20 w-full border-b border-black/10 bg-white">
      <div className="flex items-center justify-between px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="text-xs uppercase tracking-widest opacity-60">GC</div>
          <div className="text-lg font-semibold">Dashboard</div>
        </div>

        <nav className="flex flex-wrap gap-2">
          {STATIC_NAV.map((item) => {
            const active = isActive(pathname, item.href);
            const children = item.children ?? [];

            return (
              <div key={item.href} className="relative group pb-2">
                <Link
                  href={item.href}
                  className={`rounded-full px-3 py-1 text-sm transition-colors ${
                    active ? "bg-black/5 text-black" : "text-black/80 hover:bg-black/[0.03]"
                  }`}
                >
                  {item.label}
                </Link>

                {item.href === "/projects" ? (
                  <div className="absolute left-0 top-full z-30 hidden min-w-[260px] rounded-md border border-black/10 bg-white p-2 shadow-sm group-hover:block group-focus-within:block">
                    <Link
                      href="/projects/new"
                      className="block rounded px-2 py-1 text-xs font-medium opacity-90 hover:bg-black/[0.03]"
                    >
                      + Create New
                    </Link>
                    <div className="my-1 border-t border-black/10" />
                    {projectLinks.length ? (
                      projectLinks.map((child) => (
                        <Link
                          key={child.href}
                          href={child.href}
                          className="block rounded px-2 py-1 text-xs opacity-80 hover:bg-black/[0.03]"
                        >
                          {child.label}
                        </Link>
                      ))
                    ) : (
                      <div className="px-2 py-1 text-xs opacity-60">
                        No active projects yet
                      </div>
                    )}
                  </div>
                ) : children.length ? (
                  <div className="absolute left-0 top-full z-30 hidden min-w-[260px] rounded-md border border-black/10 bg-white p-2 shadow-sm group-hover:block group-focus-within:block">
                    {children.map((child) =>
                      "href" in child ? (
                        <Link
                          key={child.href}
                          href={child.href}
                          className="block rounded px-2 py-1 text-xs opacity-80 hover:bg-black/[0.03]"
                        >
                          {child.label}
                        </Link>
                      ) : (
                        <div key={child.label} className="px-2 py-1 text-xs opacity-70">
                          {child.label}
                        </div>
                      )
                    )}
                  </div>
                ) : null}
              </div>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
