"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Health = "on_track" | "at_risk" | "on_hold" | "complete";

const HEALTH_OPTIONS: { value: Health; label: string }[] = [
  { value: "on_track", label: "On Track" },
  { value: "at_risk", label: "At Risk" },
  { value: "on_hold", label: "On Hold" },
  { value: "complete", label: "Complete" },
];

function labelFor(value: Health) {
  return HEALTH_OPTIONS.find((o) => o.value === value)?.label ?? value;
}

export default function HealthPill({
  projectId,
  initialHealth,
}: {
  projectId: string;
  initialHealth: Health;
}) {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();

  const [health, setHealth] = useState<Health>(initialHealth);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function onChange(next: Health) {
    if (next === health) return;

    setSaving(true);
    setErr(null);

    const prev = health;
    setHealth(next);

    const { error } = await supabase
      .from("projects")
      .update({ health: next })
      .eq("id", projectId);

    setSaving(false);

    if (error) {
      setHealth(prev);
      setErr(error.message);
      return;
    }

    router.refresh();
  }

  function pillStyle(h: Health) {
  switch (h) {
    case "at_risk":
      return "border border-yellow-500/60 text-yellow-400";
    case "on_hold":
      return "border border-red-500/60 text-red-400";
    case "complete":
      return "border border-green-500/60 text-green-400";
    default:
      return "border border-white/40 text-white";
  }
}



  return (
  <div className="flex items-center gap-2">
    <div className={`relative inline-flex items-center rounded-full px-3 py-1 text-xs whitespace-nowrap ${pillStyle(
    health
  )}`}
>

      {/* Show label once */}
      <span>{labelFor(health)}</span>

      {/* Invisible select sits on top so clicking the pill works */}
      <select
        className="absolute inset-0 opacity-0 cursor-pointer"
        value={health}
        disabled={saving}
        onChange={(e) => onChange(e.target.value as Health)}
        aria-label="Change project health"
      >
        {HEALTH_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>

      {/* Chevron on the right */}
      <span className="ml-2 opacity-60 pointer-events-none">▾</span>

    </div>

    {saving ? <span className="text-xs opacity-60">Saving…</span> : null}
    {err ? <span className="text-xs text-red-600">{err}</span> : null}
  </div>
);

}
