import { inr, inrCompact } from "@/lib/format";

export function InrAmount({
  value,
  compact = false,
  className = "",
}: {
  value: number | null | undefined;
  compact?: boolean;
  className?: string;
}) {
  return (
    <span className={`mono tnum ${className}`} title={value == null ? "Not reported" : inr(value)}>
      {compact ? inrCompact(value) : inr(value)}
    </span>
  );
}
