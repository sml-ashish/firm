"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { ActionForm } from "@/components/approval-actions";

type BuQuoteView = {
  bu: string;
  interested: boolean;
  ratePerMonth: number | null;
  durationMonths: number | null;
  expectedYieldPct: number | null;
  earliestStart: string | null;
  customer: string | null;
  country: string | null;
  revisedAt: string;
};

type StrategyCrane = {
  id: string;
  equipmentId: string;
  status: string;
  yom: number;
  yieldPct: number;
  finalCategory: string | null;
  deployable: boolean | null;
  catalogueUploaded: boolean;
  buQuotes: BuQuoteView[];
  award: {
    bu: string;
    reason: string;
    decidedBy: string;
    csoRequired?: boolean;
    strategyHeadApprovedBy?: string | null;
    csoApprovedBy?: string | null;
    approvedBy: string | null;
  } | null;
  sap: { soEnd: string | null; assetTransferNo: string | null };
};

const CATEGORY_LABEL: Record<string, string> = {
  OLD_FLEET: "Old Fleet",
  NRG: "NRG",
  NON_DEPLOYABLE: "Non-Deployable",
  NOT_IN_FIRM: "Not in FIRM",
};

const STATUS_LABEL: Record<string, string> = {
  S04: "Offered to International BUs",
  S05: "BU Bid Evaluation",
  S06: "BU Award Approval Pending",
  S07: "Reserved – Pending Deployment",
  S16: "Completed – International Transfer",
};

/** Strategy's international-rental flow, opened from the crane register. */
export function StrategyFlowButton({ crane, role }: { crane: StrategyCrane; role: string }) {
  const interested = crane.buQuotes.filter((quote) => quote.interested);
  const trigger =
    crane.status === "S04" ? "Review & float"
      : crane.status === "S05" ? `Review quotes (${crane.buQuotes.length})`
        : crane.status === "S06" ? "Award approval"
          : crane.status === "S07" ? "Deploy"
            : "Transfer done";

  return (
    <Dialog.Root>
      <Dialog.Trigger asChild>
        <button type="button" className="btn btn-secondary h-8 px-2.5 text-[12px]">
          {trigger}
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/45 backdrop-blur-[2px]" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 max-h-[88vh] w-[min(94vw,640px)] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-xl border border-line bg-panel p-5 shadow-[var(--shadow-lg)]">
          <div className="flex items-start justify-between gap-3">
            <div>
              <Dialog.Title className="font-display text-[16px] font-semibold text-ink">
                Strategy · {crane.equipmentId}
              </Dialog.Title>
              <Dialog.Description className="mt-1 text-[12px] text-muted">
                {crane.status} · {STATUS_LABEL[crane.status] ?? "International rental"}
              </Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <button type="button" className="btn btn-ghost btn-icon" aria-label="Close">
                <X size={16} />
              </button>
            </Dialog.Close>
          </div>

          {/* Details every BU sees at S04 */}
          <div className="mt-4 grid grid-cols-2 gap-2 rounded-lg border border-line bg-panel-2 p-3 text-[12px]">
            <div><span className="text-faint">Final category:</span> {CATEGORY_LABEL[crane.finalCategory ?? ""] ?? "—"}</div>
            <div><span className="text-faint">YOM:</span> {crane.yom}</div>
            <div><span className="text-faint">Deployability:</span> {crane.deployable === null ? "—" : crane.deployable ? "Deployable" : "Non-Deployable"}</div>
            <div><span className="text-faint">Catalogue:</span> {crane.catalogueUploaded ? "Ready" : "Pending"}</div>
            <div className="col-span-2"><span className="text-faint">Available from (SO end):</span> {crane.sap.soEnd ?? "Immediately"}</div>
          </div>

          {crane.status === "S04" && (
            <div className="mt-4 space-y-3 border-t border-line pt-4">
              <p className="text-[12px] leading-relaxed text-muted">
                Review the crane details, then float it to all international BUs at once. BUs can quote within a 20-day window.
              </p>
              <ActionForm craneId={crane.id} kind="FLOAT_TO_BUS" label="Float to all BUs" role={role} />
              <ActionForm
                craneId={crane.id}
                kind="NO_TAKER_TO_SALE"
                label="No taker → sale (S08)"
                role={role}
                tone="secondary"
                confirmTitle="Send to sale?"
                confirmBody="This moves the crane to Marketing catalogue preparation (S08)."
              />
            </div>
          )}

          {crane.status === "S05" && (
            <div className="mt-4 space-y-3 border-t border-line pt-4">
              <div className="text-[11px] font-bold uppercase tracking-[0.08em] text-faint">BU quotes</div>
              {crane.buQuotes.length === 0 ? (
                <p className="text-[12px] text-muted">No quotes received yet. BUs can still submit.</p>
              ) : (
                <div className="space-y-2">
                  {crane.buQuotes.map((quote, index) => (
                    <div key={`${quote.bu}-${index}`} className="rounded-lg border border-line bg-panel-2 p-2.5 text-[12px]">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold text-ink">{quote.bu}</span>
                        <span className={`badge ${quote.interested ? "badge-green" : "badge-slate"}`}>
                          {quote.interested ? "Interested" : "Not interested"}
                        </span>
                      </div>
                      {quote.interested && (
                        <div className="mt-1 grid grid-cols-2 gap-1 text-muted">
                          <span>Rate: {quote.ratePerMonth ?? "—"}/mo</span>
                          <span>Duration: {quote.durationMonths ?? "—"} mo</span>
                          <span>Yield: {quote.expectedYieldPct ?? "—"}%</span>
                          <span>Start: {quote.earliestStart ?? "—"}</span>
                          <span>Customer: {quote.customer ?? "—"}</span>
                          <span>Country: {quote.country ?? "—"}</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {interested.length > 0 && (
                <div className="rounded-lg border border-line bg-panel-2 p-3">
                  <div className="mb-2 text-[11px] font-bold uppercase tracking-[0.08em] text-faint">Award a BU</div>
                  <ActionForm
                    craneId={crane.id}
                    kind="AWARD_BU"
                    label="Award BU → S06"
                    role={role}
                    extra={
                      <div className="grid w-full gap-2 sm:grid-cols-2">
                        <select name="bu" required className="select h-9" aria-label="BU to award">
                          <option value="">Select BU</option>
                          {interested.map((quote) => (
                            <option key={quote.bu} value={quote.bu}>
                              {quote.bu} · {quote.expectedYieldPct ?? "—"}% yield
                            </option>
                          ))}
                        </select>
                        <input name="reason" required placeholder="Reason for award (mandatory)" className="input h-9" aria-label="Award reason" />
                      </div>
                    }
                  />
                </div>
              )}

              <ActionForm
                craneId={crane.id}
                kind="NO_TAKER_TO_SALE"
                label="No acceptable quote → sale (S08)"
                role={role}
                tone="secondary"
                confirmTitle="Send to sale?"
                confirmBody="This moves the crane to Marketing catalogue preparation (S08)."
              />
            </div>
          )}

          {crane.status === "S06" && crane.award && (
            <div className="mt-4 space-y-3 border-t border-line pt-4">
              <div className="rounded-lg border border-line bg-panel-2 p-3 text-[12px]">
                <div><span className="text-faint">Awarded to:</span> <strong className="text-ink">{crane.award.bu}</strong></div>
                <div className="mt-1"><span className="text-faint">Reason:</span> {crane.award.reason}</div>
                <div className="mt-1"><span className="text-faint">Decision by:</span> {crane.award.decidedBy}</div>
              </div>
              <div className="mt-2 flex flex-wrap gap-2 text-[12px]">
                <span className={`badge ${crane.award.strategyHeadApprovedBy ? "badge-green" : "badge-amber"}`}>
                  Strategy Head {crane.award.strategyHeadApprovedBy ? `approved · ${crane.award.strategyHeadApprovedBy}` : "pending"}
                </span>
                <span className={`badge ${crane.award.csoRequired ? (crane.award.csoApprovedBy ? "badge-green" : "badge-amber") : "badge-slate"}`}>
                  CSO {crane.award.csoRequired ? (crane.award.csoApprovedBy ? `approved · ${crane.award.csoApprovedBy}` : "pending (yield below expected)") : "not required"}
                </span>
              </div>
              <p className="text-[12px] text-muted">
                Sign-off from the Strategy Head is required. The CSO also approves when the quote yield is below the expected rate ({crane.yieldPct}%). The crane is reserved (S07) once both required approvals are in place.
              </p>
              <div className="flex flex-wrap gap-2">
                <ActionForm
                  craneId={crane.id}
                  kind="APPROVE_AWARD"
                  label="Approve award"
                  role={role}
                  requireComment
                  confirmTitle="Approve this award?"
                  confirmBody="Your sign-off is recorded. The crane moves to S07 once both required approvals are in place."
                />
                <ActionForm
                  craneId={crane.id}
                  kind="REJECT_AWARD"
                  label="Reject award"
                  role={role}
                  tone="danger"
                  requireComment
                  confirmTitle="Reject this award?"
                  confirmBody="The crane returns to BU bid evaluation (S05)."
                />
              </div>
            </div>
          )}

          {crane.status === "S07" && (
            <div className="mt-4 space-y-3 border-t border-line pt-4">
              <p className="text-[12px] leading-relaxed text-muted">
                Deploy the crane to the international entity through an SAP asset transfer. Execution is allowed on or after the current SO end date ({crane.sap.soEnd ?? "immediately"}).
              </p>
              <ActionForm
                craneId={crane.id}
                kind="DEPLOY"
                label="Record asset transfer → S16"
                role={role}
                extra={
                  <input name="assetTransferNo" placeholder="SAP asset transfer number" className="input h-9" aria-label="Asset transfer number" />
                }
              />
            </div>
          )}

          {crane.status === "S16" && (
            <div className="mt-4 rounded-lg border border-line bg-panel-2 p-3 text-[12px] text-muted">
              International transfer recorded · Asset transfer {crane.sap.assetTransferNo ?? "—"}. Crane is locked (S16).
            </div>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
