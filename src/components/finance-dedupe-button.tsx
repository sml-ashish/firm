"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { ActionForm } from "@/components/approval-actions";
import { FlagChip } from "@/components/status-chip";
import { CATEGORY_LABEL, type FinalCategory, type Flags } from "@/lib/firm/workflow";

type FinanceCrane = {
  id: string;
  equipmentId: string;
  flags: Flags;
  finalOverride?: { category: FinalCategory; reason: string } | null;
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
            {crane.finalOverride && (
              <div className="mt-2 text-[12px] font-medium text-nrg-ink">
                Finance override on record: {CATEGORY_LABEL[crane.finalOverride.category]} — {crane.finalOverride.reason}
              </div>
            )}
          </div>

          <div className="mt-4 space-y-3 border-t border-line pt-4">
            <div className="text-[11px] font-bold uppercase tracking-[0.08em] text-faint">
              Finance override (optional)
            </div>
            <p className="text-[12px] text-muted">
              Leave as proposed to apply the flag rule. An override needs a written reason; original flags stay visible.
            </p>
            <ActionForm
              craneId={crane.id}
              kind="FINALISE_LIST"
              label="Deduplicate crane"
              role={role}
              requireComment
              extra={
                <div className="grid w-full gap-2">
                  <select
                    name="finalOverrideCategory"
                    className="select h-9"
                    defaultValue={crane.finalOverride?.category ?? ""}
                    aria-label="Final category override"
                  >
                    <option value="">Use proposed category</option>
                    {(Object.keys(CATEGORY_LABEL) as FinalCategory[]).map((category) => (
                      <option key={category} value={category}>{CATEGORY_LABEL[category]}</option>
                    ))}
                  </select>
                  <textarea
                    name="overrideReason"
                    rows={2}
                    defaultValue={crane.finalOverride?.reason ?? ""}
                    placeholder="Written reason, mandatory if an override is selected"
                    className="input min-h-[60px] w-full py-2"
                    aria-label="Override reason"
                  />
                </div>
              }
            />
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
