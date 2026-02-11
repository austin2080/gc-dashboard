"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useContext } from "react";
import { ModeContext } from "@/components/mode-provider";

type Item = { label: string; href: string };

export default function ProjectSubnav({
  projectId,
  projectName,
}: {
  projectId: string;
  projectName?: string;
}) {
  const { mode } = useContext(ModeContext);
  const pathname = usePathname();
  const base = `/projects/${projectId}`;

  const items: Item[] = [
    { label: "Overview", href: base },
    { label: "Prime Contract", href: `${base}/contract` },
    { label: "Budget", href: `${base}/budget` },
    { label: "Pay Apps", href: `${base}/pay-apps` },
    ...(mode === "waiverdesk" ? [{ label: "Lien Waivers", href: `${base}/waivers` }] : []),
    { label: "Change Orders", href: `${base}/change-orders` },
    { label: "RFIs", href: `${base}/rfis` },
    { label: "Submittals", href: `${base}/submittals` },
    { label: "Procurement", href: `${base}/procurement` },
    { label: "Schedule", href: `${base}/schedule` },
    { label: "Directory", href: `${base}/directory` },
  ];

  return (
    <div className="border-b border-black/10 bg-white">
      <div className="px-6 pt-3">
        <div className="flex items-center gap-2 text-xs text-black/70">
          <Link href="/projects" className="hover:underline">
            Projects
          </Link>
          <span>/</span>
          <span className="text-black">{projectName ?? "Project"}</span>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2 px-6 py-3">
        {items.map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`rounded-full px-3 py-1 text-sm transition-colors ${
                active ? "bg-black/5 text-black" : "text-black/70 hover:bg-black/[0.03]"
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
