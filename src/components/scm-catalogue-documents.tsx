"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { Download, FileText, X } from "lucide-react";

type CatalogueAttachment = {
  label: string;
  filename: string;
  url: string;
  size: number;
  mime: string;
};

type ScmCatalogueCrane = {
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

/** SCM's read-only view of the documents Marketing attached to the catalogue. */
export function ScmCatalogueDocuments({ crane }: { crane: ScmCatalogueCrane }) {
  const attachments = crane.attachments ?? [];
  const count = attachments.length || crane.files.length;
  const hasDocs = count > 0 || crane.uploaded;

  if (!hasDocs) {
    return <span className="badge badge-red">No documents</span>;
  }

  return (
    <Dialog.Root>
      <Dialog.Trigger asChild>
        <button type="button" className="btn btn-secondary h-8 px-2.5 text-[12px]">
          <FileText size={13} /> View docs ({count})
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/45 backdrop-blur-[2px]" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 max-h-[88vh] w-[min(94vw,620px)] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-xl border border-line bg-panel p-5 shadow-[var(--shadow-lg)]">
          <div className="flex items-start justify-between gap-3">
            <div>
              <Dialog.Title className="font-display text-[16px] font-semibold text-ink">
                Catalogue documents · {crane.equipmentId}
              </Dialog.Title>
              <Dialog.Description className="mt-1 text-[12px] text-muted">
                Uploaded by Marketing{crane.uploadedBy ? ` · ${crane.uploadedBy}` : ""}
                {crane.at ? ` · ${new Date(crane.at).toLocaleString()}` : ""}
              </Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <button type="button" className="btn btn-ghost btn-icon" aria-label="Close">
                <X size={16} />
              </button>
            </Dialog.Close>
          </div>

          {attachments.length > 0 ? (
            <div className="mt-4 overflow-hidden rounded-lg border border-line">
              <table className="w-full text-left text-[12px]">
                <thead className="bg-panel-2 text-[11px] font-bold uppercase tracking-[0.08em] text-faint">
                  <tr>
                    <th className="px-3 py-2">Document</th>
                    <th className="px-3 py-2">File</th>
                    <th className="px-3 py-2 text-right">Size</th>
                    <th className="px-3 py-2 text-right">Download</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {attachments.map((file) => (
                    <tr key={file.url} className="transition hover:bg-panel-2">
                      <td className="px-3 py-2.5 font-medium text-ink">{file.label}</td>
                      <td className="px-3 py-2.5 text-muted">{file.filename}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-faint">{formatSize(file.size)}</td>
                      <td className="px-3 py-2.5 text-right">
                        <a
                          href={file.url}
                          download={file.filename}
                          className="btn btn-secondary h-8 px-2.5 text-[12px] inline-flex items-center gap-1"
                        >
                          <Download size={13} /> Download
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="mt-4 rounded-lg border border-line bg-panel-2 p-3 text-[12px] text-muted">
              <div className="mb-2 font-bold uppercase tracking-[0.08em] text-faint">Files on record</div>
              <ul className="space-y-1">
                {crane.files.map((file) => <li key={file}>· {file}</li>)}
              </ul>
              <p className="mt-2 text-faint">No downloadable files are attached to this catalogue.</p>
            </div>
          )}

          <p className="mt-3 text-[11px] text-faint">
            Documents are attached by Marketing during the S08 catalogue window and are read-only for SCM.
          </p>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
