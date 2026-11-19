import { Skeleton } from "@/components/skeletons";

/** Shared card frame with a consistent header, description and action slot. */
export function SectionCard({
  title,
  actions,
  children,
  className = "",
  bodyClassName = "",
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section className={`card flex min-w-0 flex-col ${className}`}>
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line px-4 py-3.5">
        <div className="min-w-0">
          <h2 className="font-display text-[14px] font-semibold tracking-[-0.01em] text-ink">{title}</h2>
        </div>
        {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
      </div>
      <div className={`min-w-0 flex-1 p-4 ${bodyClassName}`}>{children}</div>
    </section>
  );
}

export function SectionCardSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="card p-4">
      <Skeleton className="h-4 w-40" />
      <Skeleton className="mt-2 h-3 w-64" />
      <div className="mt-5 space-y-3">
        {Array.from({ length: rows }).map((_, index) => (
          <Skeleton key={index} className="h-10 w-full" />
        ))}
      </div>
    </div>
  );
}
