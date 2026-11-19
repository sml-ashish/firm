"use client";

import { useActionState, useEffect, useState } from "react";
import * as AlertDialog from "@radix-ui/react-alert-dialog";
import { toast } from "sonner";
import { craneAction, type ActionState } from "@/app/actions/firm";
import { LockedActionChip } from "@/components/dashboard/locked-action-chip";
import type { Role } from "@/lib/firm/workflow";

const ALLOWED: Record<string, Role[]> = {
  SUBMIT_SALES: ["SALES"],
  SUBMIT_MAINTENANCE: ["MAINTENANCE"],
  FINALISE_LIST: ["FINANCE", "GLOBAL_ADMIN"],
  UPLOAD_CATALOGUE: ["MARKETING", "GLOBAL_ADMIN"],
  CLOSE_CATALOGUE_WINDOW: ["MARKETING", "GLOBAL_ADMIN"],
  FLOAT_TO_BUS: ["STRATEGY", "GLOBAL_ADMIN"],
  SUBMIT_BU_QUOTE: ["BU", "STRATEGY", "GLOBAL_ADMIN"],
  AWARD_BU: ["STRATEGY", "GLOBAL_ADMIN"],
  NO_TAKER_TO_SALE: ["STRATEGY", "GLOBAL_ADMIN"],
  APPROVE_AWARD: ["STRATEGY", "CSO", "GLOBAL_ADMIN"],
  REJECT_AWARD: ["STRATEGY", "CSO", "GLOBAL_ADMIN"],
  SUBMIT_SALE_QUOTE: ["SCM", "GLOBAL_ADMIN"],
  SELECT_SALE_QUOTE: ["SCM", "GLOBAL_ADMIN"],
  VALIDATE_SALE_PRICE: ["FPNA", "GLOBAL_ADMIN"],
  APPROVE_SALE: ["CBO", "MD", "GLOBAL_ADMIN"],
  REJECT_SALE: ["CBO", "MD", "GLOBAL_ADMIN"],
  APPROVE_SCRAP: ["MD", "GLOBAL_ADMIN"],
  REJECT_SCRAP: ["MD", "GLOBAL_ADMIN"],
  APPROVE_CLAIM: ["CBO", "CSO", "SALES", "STRATEGY", "GLOBAL_ADMIN"],
  REJECT_CLAIM: ["CBO", "CSO", "SALES", "STRATEGY", "GLOBAL_ADMIN"],
  RESOLVE_CONFLICT: ["CBO", "CSO", "STRATEGY", "MD", "GLOBAL_ADMIN"],
  DEPLOY: ["STRATEGY", "GLOBAL_ADMIN"],
  RECORD_SO: ["SALES", "STRATEGY", "SCM", "GLOBAL_ADMIN"],
};

export function ActionForm({
  craneId,
  kind,
  label,
  tone = "primary",
  role,
  requireComment = false,
  extra,
  confirmTitle,
  confirmBody,
}: {
  craneId: string;
  kind: string;
  label: string;
  tone?: "primary" | "secondary" | "danger";
  role: string;
  requireComment?: boolean;
  extra?: React.ReactNode;
  confirmTitle?: string;
  confirmBody?: string;
}) {
  const [state, action, pending] = useActionState<ActionState, FormData>(craneAction, null);
  const [open, setOpen] = useState(false);
  const [comment, setComment] = useState("");
  useEffect(() => {
    if (state?.ok) toast.success(state.ok);
  }, [state]);
  const allowed = ALLOWED[kind]?.includes(role as Role);

  if (!allowed) {
    return <LockedActionChip label={label} role={(ALLOWED[kind] ?? []).join(" or ")} />;
  }

  const fields = (
    <>
      <input type="hidden" name="craneId" value={craneId} />
      <input type="hidden" name="kind" value={kind} />
      {extra}
      {requireComment && (
        <>
          <input
            name="comment"
            required
            value={comment}
            onChange={(event) => setComment(event.target.value)}
            autoFocus={!!confirmTitle}
            placeholder="Decision comment (mandatory)"
            className="input h-9 min-w-[200px] flex-1"
            aria-label="Decision comment"
          />
          <span className="w-full text-[11px] text-muted">
            A comment is required before this decision can be submitted.
          </span>
        </>
      )}
    </>
  );

  if (!confirmTitle) {
    // React sets enctype="multipart/form-data" automatically for function actions, including file inputs.
    return (
      <form action={action} className="flex flex-wrap items-end gap-2">
        {fields}
        <button type="submit" className={`btn btn-${tone} h-9`} disabled={pending || (requireComment && !comment.trim())}>
          {pending ? "Saving…" : label}
        </button>
        {state?.error && <span className="w-full text-[12px] font-medium text-nd-ink">{state.error}</span>}
        {state?.ok && <span className="w-full text-[12px] font-medium text-healthy-ink" role="status">{state.ok}</span>}
      </form>
    );
  }

  return (
    <>
      <button type="button" className={`btn btn-${tone} h-9`} onClick={() => setOpen(true)}>
        {label}
      </button>
      <AlertDialog.Root open={open} onOpenChange={setOpen}>
        <AlertDialog.Portal>
          <AlertDialog.Overlay className="fixed inset-0 z-50 bg-black/45 backdrop-blur-[2px]" />
          <AlertDialog.Content className="fixed left-1/2 top-1/2 z-50 w-[min(92vw,440px)] -translate-x-1/2 -translate-y-1/2 rounded-xl border border-line bg-panel p-5 shadow-[var(--shadow-lg)]">
            <AlertDialog.Title className="font-display text-[16px] font-semibold text-ink">
              {confirmTitle}
            </AlertDialog.Title>
            <AlertDialog.Description className="mt-2 text-[12.5px] leading-relaxed text-muted">
              {confirmBody ?? "This decision is recorded with your name and the time. A comment is mandatory."}
            </AlertDialog.Description>
            <form action={action} className="mt-4 space-y-2">
              {fields}
              {state?.error && <p className="text-[12px] font-medium text-nd-ink">{state.error}</p>}
              {state?.ok && <p className="text-[12px] font-medium text-healthy-ink" role="status">{state.ok}</p>}
              <div className="flex justify-end gap-2 pt-2">
                <AlertDialog.Cancel asChild>
                  <button type="button" className="btn btn-secondary">Cancel</button>
                </AlertDialog.Cancel>
                <AlertDialog.Action asChild>
                  <button type="submit" className={`btn btn-${tone}`} disabled={pending || (requireComment && !comment.trim())}>
                    {pending ? "Saving…" : `Confirm ${label.toLowerCase()}`}
                  </button>
                </AlertDialog.Action>
              </div>
            </form>
          </AlertDialog.Content>
        </AlertDialog.Portal>
      </AlertDialog.Root>
    </>
  );
}
