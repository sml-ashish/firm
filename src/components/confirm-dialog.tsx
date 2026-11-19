"use client";

import * as AlertDialog from "@radix-ui/react-alert-dialog";
import { AlertTriangle, Loader2 } from "lucide-react";
import { useState } from "react";

export function ConfirmDialog({
  trigger,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  tone = "primary",
  onConfirm,
  children,
  open: openProp,
  onOpenChange,
}: {
  trigger?: React.ReactNode;
  title: string;
  description: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: "primary" | "danger";
  onConfirm: () => void | Promise<void>;
  children?: React.ReactNode;
  /** Controlled open state. Omit to let the dialog manage itself through the trigger. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const [internalOpen, setInternalOpen] = useState(false);
  const [pending, setPending] = useState(false);

  const controlled = openProp !== undefined;
  const open = controlled ? openProp : internalOpen;
  const setOpen = (next: boolean) => {
    if (!controlled) setInternalOpen(next);
    onOpenChange?.(next);
  };

  return (
    <AlertDialog.Root open={open} onOpenChange={setOpen}>
      {trigger ? <AlertDialog.Trigger asChild>{trigger}</AlertDialog.Trigger> : null}
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="fixed inset-0 z-50 bg-black/45 backdrop-blur-[2px]" />
        <AlertDialog.Content className="fixed left-1/2 top-1/2 z-50 w-[min(92vw,480px)] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-line bg-panel p-5 shadow-[var(--shadow-lg)]">
          <div className="flex items-start gap-3">
            <span
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                tone === "danger" ? "bg-nd-soft text-nd-ink" : "bg-brand-soft text-brand-ink"
              }`}
            >
              <AlertTriangle size={17} />
            </span>
            <div className="min-w-0 flex-1">
              <AlertDialog.Title className="font-display text-[16px] font-semibold text-ink">
                {title}
              </AlertDialog.Title>
              <AlertDialog.Description asChild>
                <div className="mt-1.5 text-[12.5px] leading-relaxed text-muted">{description}</div>
              </AlertDialog.Description>
              {children && <div className="mt-3">{children}</div>}
            </div>
          </div>
          <div className="mt-5 flex items-center justify-end gap-2">
            <AlertDialog.Cancel asChild>
              <button type="button" className="btn btn-secondary" disabled={pending}>
                {cancelLabel}
              </button>
            </AlertDialog.Cancel>
            <button
              type="button"
              className={`btn ${tone === "danger" ? "btn-danger" : "btn-primary"}`}
              disabled={pending}
              onClick={async () => {
                setPending(true);
                try {
                  await onConfirm();
                  setOpen(false);
                } finally {
                  setPending(false);
                }
              }}
            >
              {pending && <Loader2 size={14} className="animate-spin" />}
              {pending ? "Working…" : confirmLabel}
            </button>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}
