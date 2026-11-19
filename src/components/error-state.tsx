import { AlertTriangle, RotateCcw } from "lucide-react";

export function ErrorState({
  title = "Something went wrong",
  description = "The page could not be loaded. Retry, or contact the FIRM administrator if the problem persists.",
  detail,
  action,
}: {
  title?: string;
  description?: string;
  detail?: string | null;
  action?: React.ReactNode;
}) {
  return (
    <div className="card flex flex-col items-center justify-center px-6 py-14 text-center">
      <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-nd-soft text-nd-ink">
        <AlertTriangle size={20} />
      </div>
      <h2 className="font-display text-[16px] font-semibold text-ink">{title}</h2>
      <p className="mt-1.5 max-w-md text-[12.5px] leading-relaxed text-muted">{description}</p>
      {detail && (
        <pre className="mt-3 max-w-lg overflow-x-auto rounded-lg border border-line bg-panel-2 px-3 py-2 text-left text-[12px] text-faint">
          {detail}
        </pre>
      )}
      <div className="mt-5 flex items-center gap-2">
        {action ?? (
          <a href="" className="btn btn-secondary">
            <RotateCcw size={14} /> Retry
          </a>
        )}
      </div>
    </div>
  );
}
