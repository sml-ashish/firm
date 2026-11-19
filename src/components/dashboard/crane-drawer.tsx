"use client";

import * as Dialog from "@radix-ui/react-dialog";
import Link from "next/link";
import { useEffect, useRef } from "react";
import {
  Building2,
  CalendarClock,
  CheckCircle2,
  CircleAlert,
  ClipboardList,
  FileText,
  History,
  LockKeyhole,
  PackageOpen,
  Plane,
  ReceiptText,
  RotateCcw,
  Wrench,
  X,
} from "lucide-react";
import { ActionForm } from "@/components/approval-actions";
import { FlagChip, StatusChip } from "@/components/status-chip";
import { dateTimeLabel, inr, pct } from "@/lib/format";
import type { Crane } from "@/lib/firm/types";
import { CATEGORY_LABEL, STATUS_MAP, conflictOptions } from "@/lib/firm/workflow";

const LOCKED_STATUSES = ["S16", "S17", "S18", "S19"];

function Section({
  title,
  icon,
  children,
}: {
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-2">
      <h3 className="flex items-center gap-2 text-[12px] font-bold uppercase tracking-[0.08em] text-faint">
        {icon}
        {title}
      </h3>
      <div className="card p-3.5">{children}</div>
    </section>
  );
}

function Row({
  label,
  value,
  mono = false,
}: {
  label: string;
  value?: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-line py-1.5 last:border-0">
      <span className="shrink-0 text-[12px] text-muted">{label}</span>
      <span
        className={`text-right text-[12px] font-medium text-ink tabular-nums ${mono ? "font-mono" : ""}`}
      >
        {value ?? "—"}
      </span>
    </div>
  );
}

function Fact({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="rounded-lg bg-panel-2 px-3 py-2">
      <dt className="text-[12px] text-muted">{label}</dt>
      <dd
        className={`mt-0.5 text-[13px] font-semibold text-ink tabular-nums ${mono ? "font-mono" : ""}`}
      >
        {value}
      </dd>
    </div>
  );
}

function EmptyNote({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-lg border border-dashed border-line bg-panel-2 px-3 py-3 text-[12px] leading-relaxed text-muted">
      {children}
    </p>
  );
}

/** Right-side crane detail sheet used by the dashboard. */
export function CraneDrawer({
  cranes,
  selectedId,
  onClose,
  role,
}: {
  cranes: Crane[];
  selectedId: string | null;
  onClose: () => void;
  role: string;
}) {
  const open = selectedId !== null;
  const crane = cranes.find((item) => item.id === selectedId) ?? null;
  const previouslyOpen = useRef<string | null>(null);

  // Keep ?crane=<id> in sync without going through next/navigation.
  useEffect(() => {
    const wasOpen = previouslyOpen.current;
    previouslyOpen.current = selectedId;
    if (typeof window === "undefined") return;

    const url = new URL(window.location.href);
    if (selectedId) {
      if (url.searchParams.get("crane") !== selectedId) {
        url.searchParams.set("crane", selectedId);
        window.history.replaceState(window.history.state, "", url);
      }
      return;
    }
    // Only remove the param after this drawer was actually open; do not strip a
    // deep link on the initial render before the parent has selected a crane.
    if (wasOpen !== null && url.searchParams.has("crane")) {
      url.searchParams.delete("crane");
      window.history.replaceState(window.history.state, "", url);
    }
  }, [selectedId]);

  const audit = crane ? [...crane.audit].sort((a, b) => b.at.localeCompare(a.at)) : [];
  const meta = crane ? STATUS_MAP[crane.status] : null;
  const isLocked = crane ? LOCKED_STATUSES.includes(crane.status) : false;

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/45 backdrop-blur-[2px] transition-opacity duration-200 motion-reduce:transition-none" />
        <Dialog.Content className="fixed inset-y-0 right-0 z-50 flex w-[min(560px,94vw)] flex-col border-l border-line bg-panel shadow-[var(--shadow-lg)] outline-none transition-transform duration-200 data-[state=closed]:translate-x-full motion-reduce:transition-none">
          <div className="flex items-start justify-between gap-4 border-b border-line bg-panel px-5 py-4">
            <div className="min-w-0">
              <Dialog.Title className="truncate font-mono text-[15px] font-bold tracking-tight text-ink">
                {crane?.equipmentId ?? selectedId}
              </Dialog.Title>
              <Dialog.Description className="mt-1 line-clamp-2 text-[12px] leading-relaxed text-muted">
                {crane?.description ?? "This crane is not in the current crane list."}
              </Dialog.Description>
              {selectedId && (
                <Link
                  href={`/cranes/${encodeURIComponent(selectedId)}`}
                  data-no-drawer
                  className="mt-1 inline-block text-[12px] font-semibold text-brand hover:underline"
                >
                  Open full record →
                </Link>
              )}
            </div>
            <Dialog.Close asChild>
              <button
                type="button"
                className="btn btn-ghost btn-icon shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
                aria-label="Close crane details"
              >
                <X size={16} />
              </button>
            </Dialog.Close>
          </div>

          <div className="scroll-thin flex-1 space-y-5 overflow-y-auto px-5 py-4">
            {!crane ? (
              <EmptyNote>
                No crane matches this selection. Close the panel and choose a crane from the dashboard.
              </EmptyNote>
            ) : (
              <>
                {/* 1 — Status banner */}
                <section className="card p-3.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusChip status={crane.status} />
                    <span className="badge badge-slate text-[12px]">
                      {meta?.layer} · {meta?.type}
                    </span>
                    <span className="badge badge-slate text-[12px]">{meta?.impact}</span>
                  </div>
                  {meta && <p className="mt-2 text-[12px] leading-relaxed text-muted">{meta.hint}</p>}
                  {isLocked && (
                    <div className="mt-3 flex items-start gap-2 rounded-lg border border-[color-mix(in_srgb,var(--healthy)_35%,transparent)] bg-healthy-soft px-3 py-2 text-[12px] leading-relaxed text-healthy-ink">
                      <LockKeyhole size={15} className="mt-0.5 shrink-0" />
                      <span>
                        <strong className="font-semibold">Locked in SAP.</strong> The exit is recorded (
                        {crane.sap.soNumber ?? crane.sap.assetTransferNo ?? "SAP document"}). Nobody can
                        claim this crane back.
                      </span>
                    </div>
                  )}
                </section>

                {/* 2 — Facts */}
                <Section title="Facts">
                  <dl className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    <Fact label="YOM" value={crane.yom} mono />
                    <Fact label="Age" value={`${crane.age} yrs`} mono />
                    <Fact label="Yield" value={pct(crane.yieldPct)} />
                    <Fact label="Utilisation" value={pct(crane.utilisationPct)} />
                    <Fact
                      label="Final category"
                      value={crane.finalCategory ? CATEGORY_LABEL[crane.finalCategory] : "Not finalised"}
                    />
                    <div className="rounded-lg bg-panel-2 px-3 py-2">
                      <dt className="text-[12px] text-muted">Original flags</dt>
                      <dd className="mt-1 flex flex-wrap gap-1">
                        {crane.flags.oldFleet && <FlagChip label="Old Fleet" tone="violet" />}
                        {crane.flags.nrg && <FlagChip label="NRG" tone="orange" />}
                        {crane.flags.nonDeployable && <FlagChip label="Non-Deployable" tone="red" />}
                        {!crane.flags.oldFleet && !crane.flags.nrg && !crane.flags.nonDeployable && (
                          <span className="text-[12px] font-medium text-ink">None</span>
                        )}
                      </dd>
                    </div>
                  </dl>
                  {crane.finalOverride && (
                    <p className="mt-2.5 rounded-lg border border-[color-mix(in_srgb,var(--old)_30%,transparent)] bg-old-soft px-3 py-2 text-[12px] leading-relaxed text-old-ink">
                      <strong className="font-semibold">Finance override:</strong>{" "}
                      {CATEGORY_LABEL[crane.finalOverride.category]} — “{crane.finalOverride.reason}”
                      <span className="mt-0.5 block font-mono text-[12px] opacity-80">
                        {crane.finalOverride.by} · {dateTimeLabel(crane.finalOverride.at)}
                      </span>
                    </p>
                  )}
                </Section>

                {/* 3 — Workflow timeline */}
                <Section title="Workflow timeline" icon={<History size={14} className="text-brand" />}>
                  {audit.length === 0 ? (
                    <EmptyNote>
                      No workflow events yet. Decisions and status changes will appear here as the crane
                      moves through the cycle.
                    </EmptyNote>
                  ) : (
                    <ol className="space-y-3">
                      {audit.map((entry) => (
                        <li key={entry.id} className="flex gap-2.5 border-l border-line pl-3">
                          <span
                            className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${
                              /lock|complete/i.test(entry.action) ? "bg-healthy" : "bg-brand"
                            }`}
                          />
                          <div className="min-w-0">
                            <div className="text-[12px] font-semibold text-ink">{entry.action}</div>
                            {entry.detail && (
                              <div className="text-[12px] leading-relaxed text-muted">{entry.detail}</div>
                            )}
                            <div className="mt-0.5 text-[12px] text-faint">
                              {entry.actor} · {entry.actorRole} ·{" "}
                              <span className="font-mono tabular-nums">{dateTimeLabel(entry.at)}</span>
                            </div>
                          </div>
                        </li>
                      ))}
                    </ol>
                  )}
                </Section>

                {/* 4 — Approvals */}
                <Section title="Approvals" icon={<CheckCircle2 size={14} className="text-brand" />}>
                  {crane.approvals.length === 0 ? (
                    <EmptyNote>No approvals recorded for this crane yet.</EmptyNote>
                  ) : (
                    <ul className="space-y-2">
                      {crane.approvals.map((entry) => (
                        <li key={entry.id} className="rounded-lg border border-line bg-panel-2 px-3 py-2">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="text-[12px] font-semibold text-ink">{entry.decision}</span>
                            <span
                              className={`badge text-[12px] ${
                                entry.action === "APPROVED" ? "badge-healthy" : "badge-red"
                              }`}
                            >
                              {entry.action}
                            </span>
                          </div>
                          <div className="mt-1 text-[12px] text-muted">
                            {entry.approverName} · {entry.approverRole} ·{" "}
                            <span className="font-mono tabular-nums">{dateTimeLabel(entry.at)}</span>
                          </div>
                          {entry.comment && (
                            <div className="mt-1 text-[12px] italic leading-relaxed text-faint">
                              “{entry.comment}”
                            </div>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </Section>

                {/* 5 — Sales & Maintenance checks */}
                <Section title="Sales & Maintenance checks" icon={<Building2 size={14} className="text-brand" />}>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-lg border border-line bg-panel-2 p-3">
                      <div className="mb-1.5 flex items-center gap-2 text-[12px] font-semibold text-ink">
                        <Building2 size={14} className="text-brand" /> Sales check
                      </div>
                      <Row label="Marketability" value={crane.sales.marketable ?? "Not submitted"} />
                      <Row
                        label="NRG"
                        value={
                          crane.sales.nrg === null
                            ? "Not submitted"
                            : crane.sales.nrg
                              ? "Yes"
                              : "No"
                        }
                      />
                      <Row
                        label="Expected duration"
                        value={crane.sales.expectedMonths === null ? "—" : `${crane.sales.expectedMonths} months`}
                      />
                      <Row label="Remarks" value={crane.sales.remarks} />
                      <Row
                        label="Submitted"
                        value={
                          crane.sales.submittedBy ? (
                            <>
                              {crane.sales.submittedBy} ·{" "}
                              <span className="font-mono">{dateTimeLabel(crane.sales.submittedAt)}</span>
                            </>
                          ) : undefined
                        }
                      />
                    </div>
                    <div className="rounded-lg border border-line bg-panel-2 p-3">
                      <div className="mb-1.5 flex items-center gap-2 text-[12px] font-semibold text-ink">
                        <Wrench size={14} className="text-brand" /> Maintenance check
                      </div>
                      <Row
                        label="Deployability"
                        value={
                          crane.maintenance.deployable === null
                            ? "Not submitted"
                            : crane.maintenance.deployable
                              ? "Deployable"
                              : "Non-Deployable"
                        }
                      />
                      <Row label="Reason" value={crane.maintenance.reason} />
                      <Row
                        label="Submitted"
                        value={
                          crane.maintenance.submittedBy ? (
                            <>
                              {crane.maintenance.submittedBy} ·{" "}
                              <span className="font-mono">
                                {dateTimeLabel(crane.maintenance.submittedAt)}
                              </span>
                            </>
                          ) : undefined
                        }
                      />
                    </div>
                  </div>
                </Section>

                {/* 6 — Commercial detail, only when present */}
                {(crane.buQuotes.length > 0 ||
                  crane.award ||
                  crane.catalogue.uploaded ||
                  crane.saleQuotes.length > 0 ||
                  crane.claimBack ||
                  crane.conflict) && (
                  <Section title="Commercial record">
                    {(crane.buQuotes.length > 0 || crane.award) && (
                      <div className="mb-3">
                        <div className="mb-1.5 flex items-center gap-2 text-[12px] font-semibold text-ink">
                          <Plane size={14} className="text-brand" /> BU quotes & award
                        </div>
                        <div className="space-y-2">
                          {crane.buQuotes.map((quote, index) => (
                            <div
                              key={`${quote.bu}-${index}`}
                              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-line bg-panel-2 px-3 py-2 text-[12px]"
                            >
                              <span className="font-semibold text-ink">{quote.bu}</span>
                              <span className={quote.interested ? "badge badge-healthy" : "badge badge-slate"}>
                                {quote.interested ? "Interested" : "Not interested"}
                              </span>
                              <span className="text-muted tabular-nums">
                                {quote.ratePerMonth === null ? "—" : inr(quote.ratePerMonth)}/mo ·{" "}
                                {quote.durationMonths ?? "—"} mo · yield{" "}
                                {quote.expectedYieldPct === null ? "—" : pct(quote.expectedYieldPct, 0)}
                              </span>
                              <span className="text-[12px] text-faint">
                                {quote.customer ?? "—"} · {quote.country ?? "—"}
                              </span>
                            </div>
                          ))}
                        </div>
                        {crane.award && (
                          <div className="mt-2 rounded-lg border border-[color-mix(in_srgb,var(--old)_30%,transparent)] bg-old-soft px-3 py-2 text-[12px] leading-relaxed text-old-ink">
                            <strong className="font-semibold">Awarded to {crane.award.bu}</strong> —{" "}
                            {crane.award.reason}
                            <span className="mt-0.5 block font-mono text-[12px] opacity-80">
                              {crane.award.decidedBy} · {dateTimeLabel(crane.award.decidedAt)}
                              {crane.award.approvedBy
                                ? ` · approved by ${crane.award.approvedBy}`
                                : " · approval pending"}
                            </span>
                          </div>
                        )}
                      </div>
                    )}

                    {(crane.catalogue.uploaded || crane.saleQuotes.length > 0) && (
                      <div className="mb-3 grid gap-3 sm:grid-cols-2">
                        {crane.catalogue.uploaded && (
                          <div className="rounded-lg border border-line bg-panel-2 p-3">
                            <div className="mb-1.5 flex items-center gap-2 text-[12px] font-semibold text-ink">
                              <PackageOpen size={14} className="text-brand" /> Catalogue
                            </div>
                            <Row label="Uploaded" value="Yes" />
                            <Row label="Files" value={crane.catalogue.files.join(", ") || "—"} />
                            <Row label="By" value={crane.catalogue.uploadedBy} />
                            <Row
                              label="At"
                              value={
                                crane.catalogue.at ? (
                                  <span className="font-mono">{dateTimeLabel(crane.catalogue.at)}</span>
                                ) : undefined
                              }
                            />
                          </div>
                        )}
                        {crane.saleQuotes.length > 0 && (
                          <div className="rounded-lg border border-line bg-panel-2 p-3">
                            <div className="mb-1.5 flex items-center gap-2 text-[12px] font-semibold text-ink">
                              <ReceiptText size={14} className="text-brand" /> Sale quotations
                            </div>
                            {crane.saleQuotes.map((quote, index) => (
                              <Row
                                key={`${quote.buyer}-${index}`}
                                label={`${quote.buyer} · ${quote.market}`}
                                value={`${inr(quote.value)} · ${dateTimeLabel(quote.date)}${quote.fpnaValidated ? " · FP&A checked" : ""}`}
                              />
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {crane.claimBack && (
                      <div className="mb-3 rounded-lg border border-line bg-panel-2 p-3 text-[12px] leading-relaxed">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="flex items-center gap-2 font-semibold text-ink">
                            <RotateCcw size={14} className="text-brand" /> Claim-back by {crane.claimBack.team}
                          </span>
                          <span
                            className={`badge text-[12px] ${
                              crane.claimBack.status === "APPROVED"
                                ? "badge-healthy"
                                : crane.claimBack.status === "REJECTED"
                                  ? "badge-red"
                                  : "badge-amber"
                            }`}
                          >
                            {crane.claimBack.status}
                          </span>
                        </div>
                        <div className="mt-1.5 text-muted tabular-nums">
                          {crane.claimBack.customer} · {inr(crane.claimBack.rate)}/mo ·{" "}
                          {crane.claimBack.durationMonths} months · SO expected{" "}
                          <span className="font-mono">{crane.claimBack.expectedSoDate}</span>
                        </div>
                        <div className="mt-1 text-faint">
                          “{crane.claimBack.reason}” · {crane.claimBack.createdBy}
                        </div>
                      </div>
                    )}

                    {crane.conflict && (
                      <div className="rounded-lg border border-[color-mix(in_srgb,var(--nd)_28%,transparent)] bg-nd-soft p-3 text-[12px] leading-relaxed text-nd-ink">
                        <div className="flex items-center gap-2 font-semibold">
                          <CircleAlert size={14} className="shrink-0" /> {crane.conflict.title}
                        </div>
                        <div className="mt-1">
                          Decided by {crane.conflict.decidedBy} · status {crane.conflict.status}
                        </div>
                        {crane.conflict.winner && <div className="mt-1">Outcome: {crane.conflict.winner}</div>}
                        {crane.conflict.reason && (
                          <div className="mt-1 opacity-80">“{crane.conflict.reason}”</div>
                        )}
                      </div>
                    )}
                  </Section>
                )}

                {/* 7 — SAP record */}
                <Section title="SAP / SO record" icon={<FileText size={14} className="text-brand" />}>
                  <Row label="SAP status" value={crane.sap.currentStatus} />
                  <Row label="SO number" value={crane.sap.soNumber} mono />
                  <Row label="SO start" value={crane.sap.soStart} mono />
                  <Row label="SO end" value={crane.sap.soEnd} mono />
                  <Row label="Asset transfer no." value={crane.sap.assetTransferNo} mono />
                  <div className="mt-2.5 rounded-lg border border-line bg-panel-2 px-3 py-2">
                    <div className="flex items-center gap-1.5 text-[12px] font-bold uppercase tracking-[0.08em] text-faint">
                      <CalendarClock size={13} /> Execution allowed from
                    </div>
                    <div className="mt-1 font-mono text-[14px] font-semibold tabular-nums text-ink">
                      {crane.sap.soEnd ?? "Immediately"}
                    </div>
                    <p className="mt-1 text-[12px] leading-relaxed text-muted">
                      No new SO, deployment or handover before this date. The crane stays in the cycle and
                      can still be quoted or claimed.
                    </p>
                  </div>
                </Section>

                {/* 8 — Quick actions (role gating lives in ActionForm) */}
                <Section title="Quick actions" icon={<ClipboardList size={14} className="text-brand" />}>
                  {crane.status === "S01" && (
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <div className="mb-2 text-[12px] font-semibold text-ink">Sales check</div>
                        <ActionForm
                          craneId={crane.id}
                          kind="SUBMIT_SALES"
                          label="Submit sales check"
                          role={role}
                          extra={
                            <>
                              <select name="marketable" className="select h-9 w-auto" aria-label="Marketability">
                                <option>Marketable</option>
                                <option>Not marketable</option>
                              </select>
                              <select name="nrg" className="select h-9 w-auto" aria-label="NRG">
                                <option value="false">NRG: No</option>
                                <option value="true">NRG: Yes</option>
                              </select>
                              <input
                                name="expectedMonths"
                                type="number"
                                min="0"
                                placeholder="Duration (months)"
                                className="input h-9 w-[150px] tabular-nums"
                                aria-label="Expected deployment duration"
                              />
                            </>
                          }
                        />
                      </div>
                      <div>
                        <div className="mb-2 text-[12px] font-semibold text-ink">Maintenance check</div>
                        <ActionForm
                          craneId={crane.id}
                          kind="SUBMIT_MAINTENANCE"
                          label="Submit maintenance check"
                          role={role}
                          extra={
                            <select name="deployable" className="select h-9 w-auto" aria-label="Deployability">
                              <option value="true">Deployable</option>
                              <option value="false">Non-Deployable</option>
                            </select>
                          }
                        />
                      </div>
                    </div>
                  )}

                  {crane.status === "S02" && (
                    <ActionForm
                      craneId={crane.id}
                      kind="FINALISE_LIST"
                      label="Finalise list"
                      role={role}
                      requireComment
                      confirmTitle="Finalise FIRM list?"
                      confirmBody={`${crane.equipmentId} will be routed by the dedup rule: Non-Deployable wins, otherwise Old Fleet beats NRG. Original flags stay visible.`}
                    />
                  )}

                  {crane.status === "S06" && (
                    <div className="flex flex-wrap gap-2">
                      <ActionForm
                        craneId={crane.id}
                        kind="APPROVE_AWARD"
                        label="Approve award"
                        role={role}
                        requireComment
                        confirmTitle="Approve BU award?"
                        confirmBody={`${crane.award?.bu ?? "The awarded BU"} will be reserved for the crane (S07).`}
                      />
                      <ActionForm
                        craneId={crane.id}
                        kind="REJECT_AWARD"
                        label="Reject award"
                        tone="danger"
                        role={role}
                        requireComment
                        confirmTitle="Reject the award?"
                        confirmBody="The crane returns to bid evaluation (S05)."
                      />
                    </div>
                  )}

                  {crane.status === "S07" && (
                    <ActionForm
                      craneId={crane.id}
                      kind="DEPLOY"
                      label="Record asset transfer"
                      role={role}
                      extra={
                        <input
                          name="assetTransferNo"
                          placeholder="SAP asset transfer no."
                          className="input h-9 w-[220px] font-mono"
                          aria-label="Asset transfer number"
                        />
                      }
                      confirmTitle="Record international deployment?"
                      confirmBody={
                        crane.sap.soEnd && crane.sap.soEnd > new Date().toISOString().slice(0, 10)
                          ? `SAP hard stop: execution allowed only from ${crane.sap.soEnd}. This action will be blocked.`
                          : "The crane will be locked in SAP (S16) and cannot be claimed back."
                      }
                    />
                  )}

                  {crane.status === "S10" && (
                    <div className="flex flex-wrap gap-2">
                      <ActionForm
                        craneId={crane.id}
                        kind="APPROVE_SALE"
                        label="Approve sale"
                        role={role}
                        requireComment
                        confirmTitle="Approve the sale?"
                        confirmBody="A sale SO must be created in SAP; the crane will then be locked (S18)."
                        extra={
                          <input
                            name="soNumber"
                            placeholder="SAP sale SO no."
                            className="input h-9 w-[200px] font-mono"
                            aria-label="Sale SO number"
                          />
                        }
                      />
                      <ActionForm
                        craneId={crane.id}
                        kind="REJECT_SALE"
                        label="Reject sale"
                        tone="danger"
                        role={role}
                        requireComment
                        confirmTitle="Reject the sale?"
                        confirmBody="The crane returns to the sale list (S09)."
                      />
                    </div>
                  )}

                  {crane.status === "S11" && (
                    <div className="flex flex-wrap gap-2">
                      <ActionForm
                        craneId={crane.id}
                        kind="APPROVE_SCRAP"
                        label="Approve scrap"
                        role={role}
                        requireComment
                        confirmTitle="Approve scrap sale?"
                        confirmBody="SCM can run the scrap sale (S12)."
                      />
                      <ActionForm
                        craneId={crane.id}
                        kind="REJECT_SCRAP"
                        label="Decline scrap"
                        tone="danger"
                        role={role}
                        requireComment
                        confirmTitle="Decline scrap sale?"
                        confirmBody="The crane is carried forward to the next cycle (S20)."
                      />
                    </div>
                  )}

                  {crane.status === "S13" && (
                    <div className="flex flex-wrap gap-2">
                      <ActionForm
                        craneId={crane.id}
                        kind="APPROVE_CLAIM"
                        label="Approve claim-back"
                        role={role}
                        requireComment
                        confirmTitle="Approve claim-back?"
                        confirmBody="The crane moves to S15. An SO must be created within 15 days."
                      />
                      <ActionForm
                        craneId={crane.id}
                        kind="REJECT_CLAIM"
                        label="Reject claim-back"
                        tone="danger"
                        role={role}
                        requireComment
                        confirmTitle="Reject claim-back?"
                        confirmBody="The crane returns to the layer it was pulled from."
                      />
                    </div>
                  )}

                  {crane.status === "S14" && (
                    <ActionForm
                      craneId={crane.id}
                      kind="RESOLVE_CONFLICT"
                      label="Resolve conflict"
                      role={role}
                      requireComment
                      confirmTitle="Resolve this conflict?"
                      confirmBody={crane.conflict?.title ?? "Record the decision and the losing option."}
                      extra={
                        <select name="decision" className="select h-9 w-auto" aria-label="Winning option">
                          {conflictOptions(crane.conflict?.ruleId).map((option) => (
                            <option key={option.value} value={option.value}>{option.label}</option>
                          ))}
                        </select>
                      }
                    />
                  )}

                  {!["S01", "S02", "S06", "S07", "S10", "S11", "S13", "S14"].includes(crane.status) && (
                    <EmptyNote>
                      No action is pending for {crane.status} on this screen. Status changes appear in the
                      workflow timeline above.
                    </EmptyNote>
                  )}
                </Section>
              </>
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
