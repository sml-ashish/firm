import { Clock3 } from "lucide-react";

/** Age of a waiting item. Amber after 3 days, red after 5 — never colour alone. */
export function AgeChip({ days, label }: { days: number; label?: string }) {
  const tone = days > 5 ? "badge-red" : days > 3 ? "badge-amber" : "badge-slate";
  return (
    <span className={`badge ${tone}`} title={`Waiting ${days} day${days === 1 ? "" : "s"}`}>
      <Clock3 size={11} aria-hidden />
      <span className="tabular-nums">{days}d</span>
      {label ? <span className="font-normal">{label}</span> : null}
    </span>
  );
}
