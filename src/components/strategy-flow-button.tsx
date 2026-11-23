"use client";

import { useEffect, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { ActionForm } from "@/components/approval-actions";
import { INTERNATIONAL_BUS, buLabel } from "@/lib/firm/bu";

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
  invitedBus?: string[];
  csoRejectedBu?: string | null;
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
  claimBack?: {
    customer: string;
    team?: string;
    reservationDueAt?: string | null;
  } | null;
  conflict?: {
    ruleId: string;
    winner: string | null;
    buyerNotifiedAt?: string | null;
  } | null;
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
export function StrategyFlowButton({ crane, role, csoDecision }: {
  crane: StrategyCrane;
  role: string;
  csoDecision?: { approved: boolean; comment: string; at: string; by: string } | null;
}) {
  const [selectedBus, setSelectedBus] = useState<string[]>(crane.invitedBus ?? []);
  // Keep the picker in sync with the current invite after a float / re-float (props change without remount).
  const invitedKey = (crane.invitedBus ?? []).join(",");
  useEffect(() => setSelectedBus(invitedKey ? invitedKey.split(",") : []), [invitedKey]);
  const alreadyFloated = (crane.invitedBus?.length ?? 0) > 0;
  const interested = crane.buQuotes.filter((quote) => quote.interested);
  // A single invited BU or a single interested quote is already an explicit choice.
  const fixedAwardBu = interested.length === 1
    ? interested[0].bu
    : crane.invitedBus?.length === 1 ? crane.invitedBus[0] : null;
  const allBusSelected = selectedBus.length === INTERNATIONAL_BUS.length;
  const toggleBus = (bu: string) =>
    setSelectedBus((prev) => (prev.includes(bu) ? prev.filter((item) => item !== bu) : [...prev, bu]));
  const toggleAll = () => setSelectedBus(allBusSelected ? [] : [...INTERNATIONAL_BUS]);
  const trigger =
    crane.status === "S04" ? "Review & float"
      : crane.status === "S05" ? `Review quotes (${crane.buQuotes.length})`
        : crane.status === "S06" ? "Review award"
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
              {csoDecision && (
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <span className={`badge ${csoDecision.approved ? "badge-green" : "badge-red"}`}>
                    CSO {csoDecision.approved ? "approved" : "rejected"} · {new Date(csoDecision.at).toLocaleDateString()}
                  </span>
                  {csoDecision.comment && (
                    <span className="text-[11px] text-muted">CSO comment: {csoDecision.comment}</span>
                  )}
                </div>
              )}
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
            <div className="col-span-2"><span className="text-faint">Invited BUs:</span> {crane.invitedBus?.length ? crane.invitedBus.map(buLabel).join(", ") : "Not floated yet (all BUs eligible)"}</div>
            <div className="col-span-2"><span className="text-faint">Available from (SO end):</span> {crane.sap.soEnd ?? "Immediately"}</div>
          </div>

          {crane.status === "S04" && (
            alreadyFloated ? (
              <div className="mt-4 border-t border-line pt-4">
                <p className="text-[12px] leading-relaxed text-muted">
                  Crane floated to {crane.invitedBus?.map(buLabel).join(", ")}. Waiting for BU quotes. The Marketing catalogue route becomes available after the BU window closes.
                </p>
              </div>
            ) : (
              <div className="mt-4 space-y-3 border-t border-line pt-4">
                <p className="text-[12px] leading-relaxed text-muted">
                  Select any international BUs to float this crane to — one BU, several, or all of them. Only the selected BUs can see and quote on it.
                </p>
                <div className="rounded-lg border border-line bg-panel-2 p-3">
                  <div className="mb-2 text-[11px] font-bold uppercase tracking-[0.08em] text-faint">Invite BUs</div>
                  <label className="mb-2 flex w-fit items-center gap-2 text-[12px] font-semibold text-ink">
                    <input
                      type="checkbox"
                      checked={allBusSelected}
                      onChange={toggleAll}
                      aria-label="Select all BUs"
                      className="h-3.5 w-3.5 accent-[var(--brand)]"
                    />
                    All BUs
                  </label>
                  <div className="grid gap-2 sm:grid-cols-3">
                    {INTERNATIONAL_BUS.map((bu) => (
                      <label key={bu} className="flex items-center gap-2 text-[12px] text-muted">
                        <input
                          type="checkbox"
                          checked={selectedBus.includes(bu)}
                          onChange={() => toggleBus(bu)}
                          aria-label={`Invite ${bu}`}
                          className="h-3.5 w-3.5 accent-[var(--brand)]"
                        />
                        {buLabel(bu)}
                      </label>
                    ))}
                  </div>
                </div>
                <ActionForm
                  craneId={crane.id}
                  kind="FLOAT_TO_BUS"
                  label="Float to selected BUs"
                  role={role}
                  disabled={selectedBus.length === 0}
                  extra={<input type="hidden" name="invitedBus" value={selectedBus.join(",")} />}
                />
                {selectedBus.length === 0 && (
                  <p className="text-[11px] font-medium text-nd-ink">Select at least one BU before floating.</p>
                )}
                <ActionForm
                  craneId={crane.id}
                  kind="NO_TAKER_TO_SALE"
                  label="Send to Marketing catalogue"
                  role={role}
                  tone="secondary"
                  confirmTitle="Send to Marketing catalogue?"
                  confirmBody="This closes the BU route and moves the crane to Marketing catalogue preparation (S08)."
                />
              </div>
            )
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
                        <span className="font-semibold text-ink">{buLabel(quote.bu)}</span>
                        <span className="flex flex-wrap items-center justify-end gap-1.5">
                          {crane.csoRejectedBu === quote.bu && (
                            <span className="badge badge-red" title="The CSO rejected this BU's quote. Strategy can re-float so the BU can revise it.">
                              Rejected by CSO
                            </span>
                          )}
                          <span className={`badge ${quote.interested ? "badge-green" : "badge-slate"}`}>
                            {quote.interested ? "Interested" : "Not interested"}
                          </span>
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

              <div className="rounded-lg border border-line bg-panel-2 p-3">
                <div className="mb-2 text-[11px] font-bold uppercase tracking-[0.08em] text-faint">Re-float BUs</div>
                <p className="mb-3 text-[12px] leading-relaxed text-muted">
                  Invite other BUs, or re-invite the same BU so it can revise its quote. Existing quotes are kept.
                </p>
                <label className="mb-2 flex w-fit items-center gap-2 text-[12px] font-semibold text-ink">
                  <input
                    type="checkbox"
                    checked={allBusSelected}
                    onChange={toggleAll}
                    aria-label="Select all BUs"
                    className="h-3.5 w-3.5 accent-[var(--brand)]"
                  />
                  All BUs
                </label>
                <div className="grid gap-2 sm:grid-cols-3">
                  {INTERNATIONAL_BUS.map((bu) => (
                    <label key={bu} className="flex items-center gap-2 text-[12px] text-muted">
                      <input
                        type="checkbox"
                        checked={selectedBus.includes(bu)}
                        onChange={() => toggleBus(bu)}
                        aria-label={`Invite ${bu}`}
                        className="h-3.5 w-3.5 accent-[var(--brand)]"
                      />
                      {buLabel(bu)}
                    </label>
                  ))}
                </div>
              </div>
              <ActionForm
                craneId={crane.id}
                kind="FLOAT_TO_BUS"
                label="Float to selected BUs"
                role={role}
                disabled={selectedBus.length === 0}
                extra={<input type="hidden" name="invitedBus" value={selectedBus.join(",")} />}
              />
              {selectedBus.length === 0 && (
                <p className="text-[11px] font-medium text-nd-ink">Select at least one BU before floating.</p>
              )}

              {interested.length > 0 && (
                <div className="space-y-3 rounded-lg border border-line bg-panel-2 p-3">
                  <div>
                    <div className="text-[11px] font-bold uppercase tracking-[0.08em] text-faint">Award a BU</div>
                    <p className="mt-1 text-[12px] leading-relaxed text-muted">
                      Strategy's award is final. Award directly here, or optionally send the award to the CSO for review. When only one BU was floated or quoted, that BU is already locked below.
                    </p>
                  </div>
                  <AwardForm
                    craneId={crane.id}
                    role={role}
                    quotes={interested}
                    fixedBu={fixedAwardBu}
                    kind="AWARD_BU_DIRECT"
                    label="Award directly → S07"
                    direct
                  />
                  <AwardForm
                    craneId={crane.id}
                    role={role}
                    quotes={interested}
                    fixedBu={fixedAwardBu}
                    kind="AWARD_BU"
                    label="Send to CSO → S06"
                  />
                </div>
              )}

              <ActionForm
                craneId={crane.id}
                kind="NO_TAKER_TO_SALE"
                label="Send to Marketing catalogue"
                role={role}
                tone="secondary"
                confirmTitle="Send to Marketing catalogue?"
                confirmBody="This closes the BU route and moves the crane to Marketing catalogue preparation (S08)."
              />
            </div>
          )}

          {crane.status === "S06" && crane.award && (
            <div className="mt-4 space-y-3 border-t border-line pt-4">
              <div className="rounded-lg border border-line bg-panel-2 p-3 text-[12px]">
                <div><span className="text-faint">Awarded to:</span> <strong className="text-ink">{buLabel(crane.award.bu)}</strong></div>
                <div className="mt-1"><span className="text-faint">Reason:</span> {crane.award.reason}</div>
                <div className="mt-1"><span className="text-faint">Decision by:</span> {crane.award.decidedBy}</div>
              </div>
              <div className="mt-2 flex flex-wrap gap-2 text-[12px]">
                <span className={`badge ${crane.award.strategyHeadApprovedBy || crane.award.decidedBy ? "badge-green" : "badge-amber"}`}>
                  Strategy decision {crane.award.strategyHeadApprovedBy || crane.award.decidedBy ? `recorded · ${crane.award.strategyHeadApprovedBy ?? crane.award.decidedBy}` : "pending"}
                </span>
                <span className={`badge ${crane.award.csoRequired ? (crane.award.csoApprovedBy ? "badge-green" : "badge-amber") : "badge-slate"}`}>
                  CSO {crane.award.csoRequired ? (crane.award.csoApprovedBy ? `approved · ${crane.award.csoApprovedBy}` : "pending (CSO route)") : "not required"}
                </span>
              </div>
              <p className="text-[12px] text-muted">
                Strategy chose to send this award to the CSO for review. Strategy's decision is already recorded; only the CSO can approve or reject it. A CSO rejection returns the crane to bid evaluation (S05).
              </p>
            </div>
          )}

          {crane.status === "S07" && (
            <div className="mt-4 space-y-3 border-t border-line pt-4">
              {crane.conflict?.ruleId === "SALE_VS_INTERNATIONAL" && (
                <div className="rounded-lg border border-[color-mix(in_srgb,var(--brand)_30%,transparent)] bg-brand-soft p-3 text-[12px] text-brand-ink">
                  <div className="font-semibold">Reserved after CSO exception · international rental won</div>
                  <div className="mt-1">
                    Customer: <strong className="font-semibold">{crane.claimBack?.customer ?? "—"}</strong>
                    {crane.claimBack?.reservationDueAt && (
                      <> · reserve &amp; deploy by <strong className="font-semibold">{crane.claimBack.reservationDueAt}</strong></>
                    )}
                  </div>
                  <div className="mt-1">
                    SCM buyer notice:{" "}
                    <strong className="font-semibold">
                      {crane.conflict.buyerNotifiedAt ? "done" : "pending"}
                    </strong>
                  </div>
                  <div className="mt-1.5">
                    If the crane is not reserved and deployed within 15 days it returns to S09, where SCM can revive the held sale quotation while it is still valid.
                  </div>
                </div>
              )}
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
            <div className="mt-4 space-y-2 rounded-lg border border-line bg-panel-2 p-3 text-[12px] text-muted">
              <div>
                <span className="badge badge-green">Sent to SAP · {crane.sap.assetTransferNo ?? "—"}</span>
              </div>
              <p>
                International transfer recorded through SAP asset transfer {crane.sap.assetTransferNo ?? "—"}. The crane is locked (S16) and can no longer be claimed back.
              </p>
            </div>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

/** One award route: Strategy's own sign-off, or an explicit CSO approval request. */
function AwardForm({
  craneId,
  role,
  quotes,
  fixedBu,
  kind,
  label,
  direct = false,
}: {
  craneId: string;
  role: string;
  quotes: BuQuoteView[];
  fixedBu: string | null;
  kind: "AWARD_BU_DIRECT" | "AWARD_BU";
  label: string;
  direct?: boolean;
}) {
  const [bu, setBu] = useState(fixedBu ?? "");
  const [reason, setReason] = useState("");
  const selectedBu = fixedBu ?? bu;

  return (
    <ActionForm
      craneId={craneId}
      kind={kind}
      label={label}
      role={role}
      tone={direct ? "primary" : "secondary"}
      confirmTitle={direct ? "Award directly?" : undefined}
      confirmBody={direct
        ? `Strategy signs off on its own behalf and awards the crane to ${buLabel(selectedBu)} (S07).`
        : undefined}
      extra={
        <div className="grid w-full gap-2 sm:grid-cols-2">
          {fixedBu ? (
            <>
              <input type="hidden" name="bu" value={fixedBu} />
              <div className="flex min-h-9 items-center gap-1.5 rounded-lg border border-line bg-panel px-3 text-[12px] text-faint">
                Awarding to: <strong className="text-ink">{buLabel(fixedBu)}</strong>
              </div>
            </>
          ) : (
            <select
              name="bu"
              required
              value={bu}
              onChange={(event) => setBu(event.target.value)}
              className="select h-9"
              aria-label={`BU for ${label}`}
            >
              <option value="">Select BU</option>
              {quotes.map((entry) => (
                <option key={entry.bu} value={entry.bu}>
                  {buLabel(entry.bu)} · {entry.expectedYieldPct ?? "—"}% yield
                </option>
              ))}
            </select>
          )}
          <input
            name="reason"
            required
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Reason for award (mandatory)"
            className="input h-9"
            aria-label={`Reason for ${label}`}
          />
        </div>
      }
    />
  );
}
