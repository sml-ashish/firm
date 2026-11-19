"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { ActionForm } from "@/components/approval-actions";
import { FlagChip } from "@/components/status-chip";
import type { Flags } from "@/lib/firm/workflow";

type FinanceCrane = {
  id: string;
  equipmentId: string;
  flags: Flags;
};

function routeFor(flags: Flags) {
  if (flags.nonDeployable) {
    return { category: "Non-Deployable", status: "S08", route: "Sale, then scrap sale if unsold" };
  }
  if (flags.oldFleet) {
    return { category: "Old Fleet", status: "S04", route: "International BU rental" };
  }
  if (flags.nrg) {
    return { category: "NRG", status: "S04", route: "International BU rental" };
  }
  return { category: "Not in FIRM", status: "S03", route: "Stays in active fleet" };
}

/** Finance reviews the Sales/Maintenance flags and finalises one crane. */
export function FinanceDedupeButton({
  crane,
  role,
}: {
  crane: FinanceCrane;
  role: string;
}) {
  const preview = routeFor(crane.flags);
  return (
    <Dialog.Root>
      <Dialog.Trigger asChild>
        <button type="button" className="btn btn-secondary h-8 px-2.5 text-[12px]">
          Review &amp; dedupe
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/45 backdrop-blur-[2px]" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[min(94vw,520px)] -translate-x-1/2 -translate-y-1/2 rounded-xl border border-line bg-panel p-5 shadow-[var(--shadow-lg)]">
          <div className="flex items-start justify-between gap-3">
            <div>
              <Dialog.Title className="font-display text-[16px] font-semibold text-ink">
                Review {crane.equipmentId}
              </Dialog.Title>
              <Dialog.Description className="mt-1 text-[12px] text-muted">
                Finance deduplication · S02 Under Finance Review
              </Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <button type="button" className="btn btn-ghost btn-icon" aria-label="Close">
                <X size={16} />
              </button>
            </Dialog.Close>
          </div>

          <div className="mt-4 rounded-lg border border-line bg-panel-2 p-3">
            <div className="text-[11px] font-bold uppercase tracking-[0.08em] text-faint">Flags after Sales + Maintenance</div>
            <div className="mt-2 flex flex-wrap gap-1">
              {crane.flags.oldFleet && <FlagChip label="Old Fleet" tone="violet" />}
              {crane.flags.nrg && <FlagChip label="NRG" tone="orange" />}
              {crane.flags.nonDeployable && <FlagChip label="Non-Deployable" tone="red" />}
              {!crane.flags.oldFleet && !crane.flags.nrg && !crane.flags.nonDeployable && (
                <span className="text-[12px] text-faint">No flags</span>
              )}
            </div>
            <div className="mt-3 text-[12px] text-muted">
              Proposed: <span className="font-semibold text-ink">{preview.category}</span> · {preview.status} · {preview.route}
            </div>
          </div>

          <div className="mt-4 border-t border-line pt-4">
            <ActionForm
              craneId={crane.id}
              kind="FINALISE_LIST"
              label="Deduplicate crane"
              role={role}
              requireComment
            />
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
