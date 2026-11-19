"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { ActionForm } from "@/components/approval-actions";

type CatalogueAttachment = {
  label: string;
  filename: string;
  url: string;
  size: number;
  mime: string;
};

type CatalogueCrane = {
  id: string;
  equipmentId: string;
  uploaded: boolean;
  files: string[];
  attachments?: CatalogueAttachment[];
  uploadedBy: string | null;
  at: string | null;
};

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Marketing's S08 catalogue window, opened from the crane register. */
export function MarketingCatalogueButton({
  crane,
  role,
}: {
  crane: CatalogueCrane;
  role: string;
}) {
  return (
    <Dialog.Root>
      <Dialog.Trigger asChild>
        <button type="button" className="btn btn-secondary h-8 px-2.5 text-[12px]">
          {crane.uploaded ? "View catalogue" : "Catalogue"}
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/45 backdrop-blur-[2px]" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[min(94vw,560px)] -translate-x-1/2 -translate-y-1/2 rounded-xl border border-line bg-panel p-5 shadow-[var(--shadow-lg)]">
          <div className="flex items-start justify-between gap-3">
            <div>
              <Dialog.Title className="font-display text-[16px] font-semibold text-ink">
                Marketing catalogue · {crane.equipmentId}
              </Dialog.Title>
              <Dialog.Description className="mt-1 text-[12px] text-muted">
                S08 Catalogue Preparation · 5-working-day window before the crane moves to SCM.
              </Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <button type="button" className="btn btn-ghost btn-icon" aria-label="Close">
                <X size={16} />
              </button>
            </Dialog.Close>
          </div>

          {crane.uploaded && (
            <div className="mt-4 rounded-lg border border-line bg-panel-2 p-3">
              <div className="text-[11px] font-bold uppercase tracking-[0.08em] text-faint">Catalogue on file</div>
              {crane.attachments && crane.attachments.length > 0 ? (
                <ul className="mt-2 space-y-1 text-[12px]">
                  {crane.attachments.map((file) => (
                    <li key={file.url} className="flex items-center justify-between gap-2 text-muted">
                      <span>
                        <span className="font-medium text-ink">{file.label}:</span>{" "}
                        <a href={file.url} target="_blank" rel="noreferrer" className="text-brand hover:underline">
                          {file.filename}
                        </a>
                      </span>
                      <span className="text-faint">{formatSize(file.size)}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <ul className="mt-2 space-y-0.5 text-[12px] text-muted">
                  {crane.files.map((file) => <li key={file}>· {file}</li>)}
                </ul>
              )}
              <div className="mt-2 text-[12px] text-faint">
                {crane.uploadedBy ?? "—"} · {crane.at ? new Date(crane.at).toLocaleString() : "—"}
              </div>
            </div>
          )}

          <div className="mt-4 border-t border-line pt-4">
            <div className="mb-1 text-[12px] font-bold uppercase tracking-[0.08em] text-faint">
              {crane.uploaded ? "Add more documents" : "Upload catalogue documents"}
            </div>
            <p className="mb-3 text-[12px] text-muted">Attach photos, short video, spec sheet, load chart and condition summary. Max 20 MB per file.</p>
            <ActionForm
              craneId={crane.id}
              kind="UPLOAD_CATALOGUE"
              label={crane.uploaded ? "Upload more" : "Save catalogue"}
              role={role}
              extra={
                <div className="grid w-full gap-2 sm:grid-cols-2">
                  <label className="flex flex-col gap-1 text-[11px] font-medium text-muted">
                    Photos
                    <input name="photos" type="file" multiple className="input h-9 py-1.5 text-[11px]" aria-label="Photos" />
                  </label>
                  <label className="flex flex-col gap-1 text-[11px] font-medium text-muted">
                    Short video
                    <input name="video" type="file" multiple className="input h-9 py-1.5 text-[11px]" aria-label="Short video" />
                  </label>
                  <label className="flex flex-col gap-1 text-[11px] font-medium text-muted">
                    Spec sheet
                    <input name="specSheet" type="file" multiple className="input h-9 py-1.5 text-[11px]" aria-label="Spec sheet" />
                  </label>
                  <label className="flex flex-col gap-1 text-[11px] font-medium text-muted">
                    Load chart
                    <input name="loadChart" type="file" multiple className="input h-9 py-1.5 text-[11px]" aria-label="Load chart" />
                  </label>
                  <label className="flex flex-col gap-1 text-[11px] font-medium text-muted sm:col-span-2">
                    Condition summary
                    <input name="conditionSummary" type="file" multiple className="input h-9 py-1.5 text-[11px]" aria-label="Condition summary" />
                  </label>
                </div>
              }
            />
          </div>

          <div className="mt-4 border-t border-line pt-4">
            <div className="mb-2 text-[12px] font-bold uppercase tracking-[0.08em] text-faint">Window ends</div>
            <p className="mb-3 text-[12px] leading-relaxed text-muted">
              Closing the window moves the crane to <strong className="text-ink">S09 — Listed for Sale</strong> for SCM. If no catalogue was saved, the Global Administrator is alerted in the audit trail.
            </p>
            <ActionForm
              craneId={crane.id}
              kind="CLOSE_CATALOGUE_WINDOW"
              label="Close window → S09"
              role={role}
              tone="primary"
            />
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
