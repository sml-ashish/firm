export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`skeleton ${className}`} aria-hidden />;
}

export function KpiSkeletonRow({ count = 5 }: { count?: number }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className="card p-4">
          <Skeleton className="h-2.5 w-24" />
          <Skeleton className="mt-3 h-7 w-20" />
          <Skeleton className="mt-2.5 h-2.5 w-32" />
        </div>
      ))}
    </div>
  );
}

export function CardSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="card p-4">
      <Skeleton className="h-3 w-40" />
      <div className="mt-4 space-y-3">
        {Array.from({ length: rows }).map((_, index) => (
          <Skeleton key={index} className="h-9 w-full" />
        ))}
      </div>
    </div>
  );
}

export function TableSkeleton({ rows = 8, columns = 6 }: { rows?: number; columns?: number }) {
  return (
    <div className="card overflow-hidden">
      <div className="flex items-center justify-between border-b border-line p-3">
        <Skeleton className="h-9 w-[300px]" />
        <Skeleton className="h-8 w-[110px]" />
      </div>
      <div className="p-3">
        <Skeleton className="h-7 w-full" />
        <div className="mt-2 space-y-2">
          {Array.from({ length: rows }).map((_, rowIndex) => (
            <div key={rowIndex} className="grid gap-3" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
              {Array.from({ length: columns }).map((__, colIndex) => (
                <Skeleton key={colIndex} className="h-6" />
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function ChartSkeleton() {
  return (
    <div className="card p-4">
      <Skeleton className="h-3 w-44" />
      <Skeleton className="mt-1.5 h-2.5 w-60" />
      <Skeleton className="mt-5 h-[220px] w-full" />
    </div>
  );
}

/** Dashboard-specific skeleton that mirrors the final bento layout. */
export function DashboardSkeleton() {
  return (
    <div className="space-y-5">
      <Skeleton className="h-3 w-28" />
      <Skeleton className="h-8 w-72" />
      <Skeleton className="h-3 w-[440px] max-w-full" />
      <div className="card flex flex-wrap items-center gap-4 p-4">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-5 w-20" />
        <Skeleton className="h-5 w-32" />
        <Skeleton className="ml-auto h-5 w-24" />
        <Skeleton className="h-1.5 w-full" />
      </div>
      <KpiSkeletonRow />
      <div className="grid gap-4 lg:grid-cols-12">
        <div className="lg:col-span-7 min-[1440px]:col-span-8"><ChartSkeleton /></div>
        <div className="lg:col-span-5 min-[1440px]:col-span-4"><CardSkeleton rows={5} /></div>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <CardSkeleton rows={4} />
        <TableSkeleton rows={5} columns={3} />
      </div>
    </div>
  );
}

export function PageSkeleton() {
  return (
    <div className="space-y-5">
      <div>
        <Skeleton className="h-2.5 w-28" />
        <Skeleton className="mt-3 h-7 w-72" />
        <Skeleton className="mt-2 h-3 w-[420px]" />
      </div>
      <KpiSkeletonRow />
      <div className="grid gap-4 xl:grid-cols-[1.6fr_1fr]">
        <ChartSkeleton />
        <CardSkeleton />
      </div>
      <TableSkeleton />
    </div>
  );
}
