"use client";

import { useEffect, useRef, useState } from "react";
import type { LevelingBid } from "@/lib/bidding/leveling-types";

type BidCardActionBarProps = {
  status: LevelingBid["status"];
  readOnly: boolean;
  onOpen: () => void;
  onStatusChange: (status: LevelingBid["status"]) => void;
  onRemove: () => void;
};

export default function BidCardActionBar({
  status,
  readOnly,
  onOpen,
  onStatusChange,
  onRemove,
}: BidCardActionBarProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [menuOpen]);

  return (
    <div className="mt-3 space-y-2">
      <button
        type="button"
        onClick={onOpen}
        className="w-full rounded-lg bg-slate-900 px-2 py-1.5 text-xs font-semibold text-white"
      >
        Open
      </button>

      <div className="flex items-center gap-2">
        <select
          value={status}
          onChange={(event) =>
            onStatusChange(event.target.value as LevelingBid["status"])
          }
          disabled={readOnly}
          className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-700 disabled:bg-slate-100"
        >
          <option value="invited">Invited</option>
          <option value="bidding">Bidding</option>
          <option value="submitted">Submitted</option>
          <option value="declined">Declined</option>
          <option value="no_response">No response</option>
        </select>

        <div className="relative" ref={menuRef}>
          <button
            type="button"
            disabled={readOnly}
            onClick={() => setMenuOpen((prev) => !prev)}
            aria-label="More actions"
            className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm font-semibold text-slate-700 disabled:bg-slate-100"
          >
            ⋮
          </button>

          {menuOpen ? (
            <div className="absolute right-0 top-full z-20 mt-1 min-w-[150px] rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  onRemove();
                }}
                className="w-full px-3 py-1.5 text-left text-xs font-semibold text-rose-700 hover:bg-rose-50"
              >
                Remove from trade
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
