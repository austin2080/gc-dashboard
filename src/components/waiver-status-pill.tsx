import {
  type WaiverStatus,
  type WaiverSubStatus,
  waiverStatusMeta,
  waiverSubStatusMeta,
} from "@/lib/waiver-status";

type WaiverStatusPillProps = {
  status: WaiverStatus;
  subStatus?: WaiverSubStatus;
  tooltip?: string;
  className?: string;
};

export default function WaiverStatusPill({
  status,
  subStatus,
  tooltip,
  className,
}: WaiverStatusPillProps) {
  const meta = waiverStatusMeta[status];
  const subStatusLabel = subStatus ? waiverSubStatusMeta[subStatus].label : null;

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${meta.className} ${className ?? ""}`}
      title={tooltip ?? meta.description}
    >
      <span>{meta.label}</span>
      {subStatusLabel ? <span className="opacity-80">• {subStatusLabel}</span> : null}
    </span>
  );
}
