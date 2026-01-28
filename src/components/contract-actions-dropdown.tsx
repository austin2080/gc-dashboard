"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

type Props = {
  projectId: string;
  contractId: string;
};

export default function ContractActionsDropdown({ projectId, contractId }: Props) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const handleClick = (event: MouseEvent) => {
      if (!menuRef.current) return;
      if (!menuRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        className="rounded border border-black/10 px-3 py-2 text-base cursor-pointer flex items-center gap-2"
        onClick={() => setOpen((prev) => !prev)}
      >
        Create
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className="h-3 w-3 opacity-60"
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>
      {open ? (
        <div className="absolute right-0 top-full z-30 mt-2 min-w-[220px] rounded-md border border-black/10 bg-white p-2 shadow-sm">
          <Link
            href={`/projects/${projectId}/contract/${contractId}/invoices/new`}
            className="block rounded px-2 py-1 text-base opacity-80 hover:bg-black/[0.03]"
            onClick={() => setOpen(false)}
          >
            Create Invoice
          </Link>
          <Link
            href={`/projects/${projectId}/contract/${contractId}/change-events/new`}
            className="block rounded px-2 py-1 text-base opacity-80 hover:bg-black/[0.03]"
            onClick={() => setOpen(false)}
          >
            Create Change Event
          </Link>
        </div>
      ) : null}
    </div>
  );
}
