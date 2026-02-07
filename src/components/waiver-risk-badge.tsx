import {
  type WaiverRiskLevel,
  type WaiverStatus,
  waiverStatusMeta,
} from "@/lib/waiver-status";

const riskMeta: Record<WaiverRiskLevel, { label: string; className: string }> = {
  high: {
    label: "High",
    className: "bg-red-500",
  },
  medium: {
    label: "Medium",
    className: "bg-amber-500",
  },
  low: {
    label: "Low",
    className: "bg-emerald-500",
  },
};

type WaiverRiskBadgeProps = {
  status: WaiverStatus;
  showLabel?: boolean;
};

export default function WaiverRiskBadge({
  status,
  showLabel = true,
}: WaiverRiskBadgeProps) {
  const risk = waiverStatusMeta[status].riskLevel;
  const meta = riskMeta[risk];

  return (
    <span className="inline-flex items-center gap-1.5" title={`${meta.label} risk`}>
      <span className={`h-2.5 w-2.5 rounded-full ${meta.className}`} />
      {showLabel ? <span className="text-xs text-black/70">{meta.label}</span> : null}
    </span>
  );
}
