import Link from "next/link";
import { ArrowUpRight, TrendingDown, TrendingUp } from "lucide-react";

type Tone = "brand" | "danger" | "warning" | "violet" | "green" | "neutral";

const TONE: Record<Tone, { accent: string; soft: string; ink: string }> = {
  brand: { accent: "var(--brand)", soft: "var(--brand-soft)", ink: "var(--brand-ink)" },
  danger: { accent: "var(--danger)", soft: "var(--danger-soft)", ink: "var(--danger)" },
  warning: { accent: "var(--warning)", soft: "var(--warning-soft)", ink: "var(--warning)" },
  violet: { accent: "var(--old)", soft: "var(--old-soft)", ink: "var(--old-ink)" },
  green: { accent: "var(--healthy)", soft: "var(--healthy-soft)", ink: "var(--healthy-ink)" },
  neutral: { accent: "var(--faint)", soft: "var(--panel-3)", ink: "var(--muted)" },
};

function Sparkline({ points, color }: { points: number[]; color: string }) {
  if (points.length < 2) return null;
  const max = Math.max(...points, 1);
  const min = Math.min(...points, 0);
  const range = max - min || 1;
  const path = points
    .map((value, index) => `${index === 0 ? "M" : "L"}${(index / (points.length - 1)) * 72},${20 - ((value - min) / range) * 16}`)
    .join(" ");
  return (
    <svg viewBox="0 0 72 22" className="h-6 w-[72px]" aria-hidden focusable="false">
      <path d={path} fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function KpiCard({
  label,
  value,
  sub,
  icon,
  tone = "neutral",
  href,
  note,
  sparkline,
  delta,
  urgent = false,
}: {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  icon?: React.ReactNode;
  tone?: Tone;
  href?: string;
  note?: string;
  sparkline?: number[];
  delta?: string;
  urgent?: boolean;
}) {
  const palette = TONE[tone];
  const positiveDelta = delta?.startsWith("+");
  const body = (
    <div
      className={`card group relative h-full overflow-hidden p-4 transition duration-200 ease-out hover:border-line-strong hover:shadow-[var(--shadow-md)] ${urgent ? "animate-[pulse_2s_ease-out_1]" : ""}`}
    >
      <span
        aria-hidden
        className="absolute inset-x-0 top-0 h-[2px]"
        style={{ background: palette.accent }}
      />
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="stat-label">{label}</div>
          <div className="mt-1 font-display text-[28px] font-semibold leading-none tracking-[-0.03em] text-ink tabular-nums">
            {value}
          </div>
        </div>
        {icon && (
          <div
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[6px]"
            style={{ background: palette.soft, color: palette.ink }}
          >
            {icon}
          </div>
        )}
      </div>

      <div className="mt-3 flex items-end justify-between gap-2">
        <div className="min-w-0">
          {sub && <div className="text-[12px] leading-snug text-muted">{sub}</div>}
          {delta && (
            <div className={`mt-1 flex items-center gap-1 text-[12px] font-medium tabular-nums ${positiveDelta ? "text-healthy-ink" : "text-muted"}`}>
              {positiveDelta ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
              {delta}
            </div>
          )}
          {note && <div className="mt-1 text-[12px] leading-snug text-muted">{note}</div>}
        </div>
        {sparkline && <Sparkline points={sparkline} color={palette.accent} />}
      </div>

      {href && (
        <ArrowUpRight
          size={14}
          className="absolute bottom-3 right-3 text-faint opacity-0 transition group-hover:opacity-100 group-focus-visible:opacity-100"
          aria-hidden
        />
      )}
    </div>
  );

  return href ? (
    <Link href={href} className="block rounded-[8px] focus-visible:ring-2 focus-visible:ring-brand" aria-label={`${label}: ${String(value)}. Open filtered register.`}>
      {body}
    </Link>
  ) : (
    body
  );
}
