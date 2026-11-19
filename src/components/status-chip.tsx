import {
  Archive, CheckCircle2, CircleAlert, CircleDashed, Clock3, LockKeyhole,
} from "lucide-react";
import { STATUS_MAP, type StatusCode } from "@/lib/firm/workflow";

const TONE_CLASS: Record<string, string> = {
  slate: "badge-slate",
  brand: "badge-info",
  orange: "badge-orange",
  amber: "badge-amber",
  violet: "badge-old",
  red: "badge-red",
  green: "badge-healthy",
};

const TYPE_ICON = {
  Active: CircleDashed,
  Approval: Clock3,
  "On Hold": CircleAlert,
  Locked: LockKeyhole,
  Closed: Archive,
} as const;

/** S01–S20 status label: code, full name and an icon, never colour alone. */
export function StatusChip({
  status,
  compact = false,
  showCode = true,
}: {
  status: StatusCode;
  compact?: boolean;
  showCode?: boolean;
}) {
  const meta = STATUS_MAP[status];
  const Icon = TYPE_ICON[meta.type] ?? CheckCircle2;
  return (
    <span
      className={`badge ${TONE_CLASS[meta.tone]}`}
      title={`${meta.code} ${meta.name} · ${meta.layer} · ${meta.type} · ${meta.impact}`}
    >
      <Icon size={11} aria-hidden />
      {showCode && <span className="font-mono text-[12px] font-bold">{meta.code}</span>}
      <span className={compact ? "max-w-[150px] truncate" : ""}>{meta.name}</span>
    </span>
  );
}

export function FlagChip({
  label,
  tone = "slate",
}: {
  label: string;
  tone?: "slate" | "brand" | "orange" | "amber" | "violet" | "red" | "green";
}) {
  return <span className={`badge ${TONE_CLASS[tone]}`}>{label}</span>;
}
