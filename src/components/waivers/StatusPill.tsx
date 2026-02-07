import { type WaiverStatus, getWaiverStatusClass, getWaiverStatusLabel } from "@/lib/waivers/status";

type StatusPillProps = {
  status: WaiverStatus;
  className?: string;
};

export default function StatusPill({ status, className }: StatusPillProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium ${getWaiverStatusClass(
        status
      )} ${className ?? ""}`}
    >
      {getWaiverStatusLabel(status)}
    </span>
  );
}
