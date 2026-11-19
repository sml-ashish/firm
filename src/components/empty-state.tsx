export function EmptyState({
  icon,
  title,
  actions,
  tone = "brand",
}: {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  actions?: React.ReactNode;
  tone?: "brand" | "warning" | "muted";
}) {
  const toneClass =
    tone === "warning"
      ? "bg-warning-soft text-warning-ink"
      : tone === "muted"
        ? "bg-panel-3 text-faint"
        : "bg-brand-soft text-brand-ink";

  return (
    <div className="card relative flex flex-col items-center justify-center overflow-hidden px-6 py-14 text-center">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-70"
        style={{
          background:
            "radial-gradient(420px 200px at 50% 0%, color-mix(in srgb, var(--brand) 8%, transparent), transparent 70%)",
        }}
      />
      <div className="relative flex flex-col items-center">
        {icon && (
          <div className={`mb-4 flex h-11 w-11 items-center justify-center rounded-xl ${toneClass}`}>
            {icon}
          </div>
        )}
        <h3 className="font-display text-[16px] font-semibold text-ink">{title}</h3>
        {actions && (
          <div className="mt-5 flex flex-wrap items-center justify-center gap-2">{actions}</div>
        )}
      </div>
    </div>
  );
}
