"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

export default function InlineEstBuyout({
  value,
  onSave,
}: {
  value: number;
  onSave: (next: number) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [displayValue, setDisplayValue] = useState(value);
  const [draft, setDraft] = useState(value.toFixed(2));
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  useEffect(() => {
    setDisplayValue(value);
    setDraft(value.toFixed(2));
  }, [value]);

  function save() {
    const cleaned = Number(draft.replace(/[^\d.]/g, ""));
    const next = Number.isNaN(cleaned) ? 0 : cleaned;
    startTransition(async () => {
      setDisplayValue(next);
      await onSave(next);
      router.refresh();
      setEditing(false);
    });
  }

  if (!editing) {
    return (
      <button
        type="button"
        className="mt-1 text-left text-xl font-semibold underline decoration-black/20 hover:decoration-black"
        onClick={() => setEditing(true)}
      >
        {displayValue.toLocaleString(undefined, { style: "currency", currency: "USD" })}
      </button>
    );
  }

  return (
    <div className="mt-1 flex items-center gap-2">
      <div className="relative">
        <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-black/60">
          $
        </span>
        <input
          className="w-32 rounded border border-black/20 pl-5 pr-2 py-1 text-sm"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
        />
      </div>
      <button
        type="button"
        className="rounded border border-black px-2 py-1 text-xs"
        onClick={save}
        disabled={pending}
      >
        {pending ? "Saving..." : "Save"}
      </button>
      <button
        type="button"
        className="text-xs opacity-60"
        onClick={() => {
          setDraft(displayValue.toFixed(2));
          setEditing(false);
        }}
        disabled={pending}
      >
        Cancel
      </button>
    </div>
  );
}
