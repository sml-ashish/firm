"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { CheckCircle2, CircleAlert, FileSpreadsheet, UploadCloud } from "lucide-react";
import { toast } from "sonner";
import {
  uploadFleetAction, validateFleetAction,
  type ActionState, type ValidateState,
} from "@/app/actions/firm";
const FIRM_HEADERS = [
  "Equipment ID", "Equipment Description", "YOM", "Yield %", "Utilisation %",
  "SAP Status", "SO Number", "SO Start Date", "SO End Date",
] as const;

export type OpenCycleOption = {
  id: string;
  name: string;
  startDate: string | null;
  endDate: string | null;
  craneCount: number;
};

export function ImportWizard({ role, cycles }: { role: string; cycles: OpenCycleOption[] }) {
  const [file, setFile] = useState<File | null>(null);
  const [cycleId, setCycleId] = useState(cycles[0]?.id ?? "");
  const fileRef = useRef<HTMLInputElement>(null);
  const [validation, validateAction, validating] = useActionState<ValidateState, FormData>(validateFleetAction, null);
  const [commitState, commitAction, committing] = useActionState<ActionState, FormData>(uploadFleetAction, null);
  const [pending, startTransition] = useTransition();
  const canUpload = role === "FPNA" || role === "GLOBAL_ADMIN";

  useEffect(() => {
    if (commitState?.ok) toast.success(commitState.ok);
    if (commitState?.error) toast.error(commitState.error);
  }, [commitState]);

  const formFor = () => {
    const fd = new FormData();
    if (file) fd.set("file", file);
    fd.set("cycleId", cycleId);
    return fd;
  };

  return (
    <div className="space-y-4">
      <div className="card p-5">
        <h2 className="panel-title">Step 1 — choose the cycle</h2>
        {cycles.length === 0 ? (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-line bg-panel-2 px-3 py-3 text-[12px] text-muted">
            <span>No open cycle yet. FP&A must create one with a start and end date before uploading a fleet.</span>
            <a href="/cycles" className="btn btn-primary h-9">Create a cycle</a>
          </div>
        ) : (
          <>
            <label className="mt-4 block">
              <span className="mb-1 block text-[12px] font-semibold text-ink">Upload into</span>
              <select value={cycleId} onChange={(event) => setCycleId(event.target.value)} className="select h-9">
                {cycles.map((cycle) => (
                  <option key={cycle.id} value={cycle.id}>
                    {cycle.name} · {cycle.startDate ?? "—"} → {cycle.endDate ?? "—"} · {cycle.craneCount} crane(s)
                  </option>
                ))}
              </select>
            </label>
            <p className="mt-2 text-[12px] text-muted">
              New Equipment IDs are appended to this cycle. You can come back and upload another workbook here at any time.
            </p>
          </>
        )}
      </div>

      <div className="card p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="panel-title">Step 2 — choose the workbook</h2>
          </div>
          <div className="flex flex-wrap gap-2">
            <a href="/templates/FIRM-Sample-Fleet.xlsx" className="btn btn-secondary h-9">
              <FileSpreadsheet size={14} /> Download sample data
            </a>
            <a href="/api/template" className="btn btn-secondary h-9">
              <FileSpreadsheet size={14} /> Blank template
            </a>
          </div>
        </div>

        {!canUpload && (
          <div className="mt-4 flex items-center gap-2 rounded-lg border border-line bg-panel-2 px-3 py-2 text-[12px] text-muted">
            <CircleAlert size={13} className="text-nrg-ink" />
            Your role cannot upload a fleet. The step is shown so you can see the workflow; only FP&A can commit.
          </div>
        )}

        <div
          className="mt-4 flex flex-col items-center justify-center rounded-xl border border-dashed border-line-strong bg-panel-2 px-4 py-8 text-center"
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => {
            event.preventDefault();
            const dropped = event.dataTransfer.files?.[0];
            if (dropped) setFile(dropped);
          }}
        >
          <UploadCloud size={24} className="text-brand" />
          <p className="mt-2 text-[12.5px] font-semibold text-ink">
            {file ? file.name : "Drop the fleet workbook here"}
          </p>
          <p className="mt-1 text-[12px] text-muted">.xlsx · Fleet sheet · maximum 500 rows</p>
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx"
            className="hidden"
            onChange={(event) => setFile(event.target.files?.[0] ?? null)}
          />
          <button type="button" className="btn btn-secondary mt-3 h-9" onClick={() => fileRef.current?.click()}>
            Choose file
          </button>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <form action={validateAction}>
            <input type="hidden" name="file" value={file?.name ?? ""} />
            <button
              type="button"
              className="btn btn-primary h-9"
              disabled={!file || validating}
              onClick={() => startTransition(() => validateAction(formFor()))}
            >
              {validating || pending ? "Validating…" : "Validate workbook"}
            </button>
          </form>
          <button
            type="button"
            className="btn btn-secondary h-9"
            disabled={!file || !cycleId || !validation?.preview || validation.preview.errorCount > 0 || !canUpload || committing}
            onClick={() => startTransition(() => {
              void commitAction(formFor());
              toast.success("Upload submitted.");
            })}
          >
            {committing ? "Committing…" : "Commit to cycle"}
          </button>
        </div>
        {validation?.error && <p className="mt-2 text-[12px] font-medium text-nd-ink">{validation.error}</p>}
      </div>

      <div className="card p-4">
        <h2 className="panel-title">Required columns</h2>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {FIRM_HEADERS.map((header, index) => (
            <span key={header} className={`badge ${index < 5 ? "badge-brand" : "badge-slate"}`}>{header}</span>
          ))}
        </div>
      </div>

      {validation?.preview && (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-3">
            <span className={`badge ${validation.preview.errorCount ? "badge-red" : "badge-healthy"}`}>
              {validation.preview.errorCount} error(s)
            </span>
            <span className="badge badge-amber">{validation.preview.warningCount} warning(s)</span>
            <span className="badge badge-info">{validation.preview.rows.length} valid row(s)</span>
          </div>

          {validation.preview.issues.length > 0 && (
            <div className="card overflow-hidden">
              <div className="border-b border-line px-4 py-3"><h3 className="panel-title">Validation issues</h3></div>
              <div className="divide-y divide-line">
                {validation.preview.issues.map((issue, index) => (
                  <div key={`${issue.row}-${index}`} className="flex items-start gap-2 px-4 py-2.5 text-[12px]">
                    {issue.severity === "error"
                      ? <CircleAlert size={13} className="mt-0.5 shrink-0 text-nd" />
                      : <CheckCircle2 size={13} className="mt-0.5 shrink-0 text-nrg-review" />}
                    <span className="text-muted">
                      <strong className="text-ink">Row {issue.row ?? "—"}{issue.field ? ` · ${issue.field}` : ""}:</strong> {issue.message}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {validation.preview.rows.length > 0 && (
            <div className="card overflow-hidden">
              <div className="border-b border-line px-4 py-3"><h3 className="panel-title">Validated rows</h3></div>
              <div className="overflow-x-auto scroll-thin">
                <table className="w-full min-w-[820px] text-left">
                  <thead>
                    <tr className="border-b border-line bg-panel-2 text-[12px] font-bold uppercase tracking-[0.08em] text-faint">
                      <th className="px-3 py-2">Equipment ID</th><th className="px-3 py-2">Description</th>
                      <th className="px-3 py-2">YOM</th><th className="px-3 py-2">Age</th>
                      <th className="px-3 py-2">Yield %</th><th className="px-3 py-2">Utilisation %</th>
                      <th className="px-3 py-2">Old Fleet</th><th className="px-3 py-2">NRG / RG</th><th className="px-3 py-2">SO</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {validation.preview.rows.map((row) => (
                      <tr key={row.equipmentId} className="text-[12px]">
                        <td className="px-3 py-2 font-semibold text-ink">{row.equipmentId}</td>
                        <td className="px-3 py-2 text-muted">{row.description}</td>
                        <td className="px-3 py-2 tabular-nums">{row.yom}</td>
                        <td className="px-3 py-2 tabular-nums">{row.age}</td>
                        <td className="px-3 py-2 tabular-nums">{row.yieldPct}</td>
                        <td className="px-3 py-2 tabular-nums">{row.utilisationPct}</td>
                        <td className="px-3 py-2">{row.oldFleet ? <span className="badge badge-old">Yes</span> : <span className="badge badge-slate">No</span>}</td>
                        <td className="px-3 py-2">{row.nrg ? <span className="badge badge-orange">NRG</span> : <span className="badge badge-healthy">RG</span>}</td>
                        <td className="px-3 py-2 font-mono text-[12px] text-muted">{row.soNumber ?? "—"}{row.soEnd ? ` · ${row.soEnd}` : ""}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
