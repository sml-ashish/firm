import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft, Building2, CalendarClock, CheckCircle2, CircleAlert, FileText,
  LockKeyhole, PackageOpen, Plane, ReceiptText, RotateCcw, ShieldCheck, Wrench,
} from "lucide-react";
import { requireUser } from "@/lib/auth";
import { getCrane, roleAllowsCrane } from "@/lib/firm/api";
import { PageHeader } from "@/components/page-header";
import { StatusChip, FlagChip } from "@/components/status-chip";
import {
  CATEGORY_LABEL, STATUS_MAP,
  type Role,
} from "@/lib/firm/workflow";
import { ROLE_MAP } from "@/lib/firm/workflow";
import { buCodeForUser } from "@/lib/firm/bu";
import { dateLabel } from "@/lib/format";

export const dynamic = "force-dynamic";

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
    <section className="card p-4">
      <h2 className="flex items-center gap-2 panel-title">
        {icon}
        {title}
      </h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function Row({ label, value, mono = false }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-line py-2 last:border-0">
      <span className="text-[12px] text-muted">{label}</span>
      <span className={`text-right text-[12px] font-medium text-ink ${mono ? "font-mono" : ""}`}>{value ?? "—"}</span>
    </div>
  );
}

export default async function CraneDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const crane = await getCrane(decodeURIComponent(id));
  if (!crane || !roleAllowsCrane(user.role, crane, buCodeForUser(user))) notFound();
  const meta = STATUS_MAP[crane.status];
  const role = ROLE_MAP[crane.audit.at(-1)?.actorRole as Role];

  return (
    <>
      <Link href="/cranes" className="mb-4 inline-flex items-center gap-1.5 text-[12px] font-semibold text-brand hover:underline">
        <ArrowLeft size={13} /> Back to crane register
      </Link>

      <PageHeader
        eyebrow={`Crane · ${crane.equipmentId}`}
        title={crane.description}
        description={`YOM ${crane.yom} · ${crane.age} years old · yield ${crane.yieldPct}% · utilisation ${crane.utilisationPct}%`}
        help="The single source of truth for one crane: flags, parallel checks, quotes, SAP data and the full audit trail."
        actions={<StatusChip status={crane.status} />}
      />

      {meta.type === "Locked" && (
        <div className="mb-4 flex items-start gap-2 rounded-xl border border-[color-mix(in_srgb,var(--healthy)_35%,transparent)] bg-healthy-soft px-4 py-3 text-[12px] text-healthy-ink">
          <LockKeyhole size={16} className="mt-0.5 shrink-0" />
          <div>
            <strong className="block font-semibold">Locked in SAP</strong>
            The exit is recorded ({crane.sap.soNumber ?? crane.sap.assetTransferNo ?? "SAP document"}). Nobody can claim this crane back.
          </div>
        </div>
      )}
      {crane.status === "S14" && (
        <div className="mb-4 flex items-start gap-2 rounded-xl border border-[color-mix(in_srgb,var(--nd)_32%,transparent)] bg-nd-soft px-4 py-3 text-[12px] text-nd-ink">
          <CircleAlert size={16} className="mt-0.5 shrink-0" />
          <div>
            <strong className="block font-semibold">Conflict — everything paused</strong>
            {crane.conflict?.title ?? "A decision is pending"} · decided by {crane.conflict?.decidedBy ?? "named approver"} within 3 working days.
          </div>
        </div>
      )}

      <div className="grid gap-4 xl:grid-cols-3">
        <div className="space-y-4 xl:col-span-2">
          <Section title="Workflow position" icon={<ShieldCheck size={15} className="text-brand" />}>
            <div className="grid gap-3 sm:grid-cols-2">
              <Row label="Current status" value={<StatusChip status={crane.status} />} />
              {crane.saleWindowStartedAt && (
                <Row label="Sale window started" value={new Date(crane.saleWindowStartedAt).toLocaleString()} />
              )}
              <Row label="Layer / type" value={`${meta.layer} · ${meta.type}`} />
              <Row label="Cycle impact" value={meta.impact} />
              <Row label="Cycle" value={crane.cycleId} />
              <Row label="Final category" value={crane.finalCategory ? CATEGORY_LABEL[crane.finalCategory] : "Not finalised"} />
              <Row label="Flags" value={
                <span className="flex flex-wrap gap-1">
                  {crane.flags.oldFleet && <FlagChip label="Old Fleet" tone="violet" />}
                  {crane.flags.nrg && <FlagChip label="NRG" tone="orange" />}
                  {crane.flags.nonDeployable && <FlagChip label="Non-Deployable" tone="red" />}
                  {!crane.flags.oldFleet && !crane.flags.nrg && !crane.flags.nonDeployable && "None"}
                </span>
              } />
            </div>
            {crane.finalOverride && (
              <div className="mt-3 rounded-lg border border-[color-mix(in_srgb,var(--old)_30%,transparent)] bg-old-soft px-3 py-2.5 text-[12px] text-old-ink">
                <strong>Finance override:</strong> {CATEGORY_LABEL[crane.finalOverride.category]} — “{crane.finalOverride.reason}”
                <div className="mt-0.5 text-[12px] opacity-80">Recorded by {crane.finalOverride.by} on {crane.finalOverride.at}</div>
                <div className="mt-1 text-[12px] opacity-80">Original flags remain visible above.</div>
              </div>
            )}
          </Section>

          <Section title="Parallel checks" icon={<CheckCircle2 size={15} className="text-brand" />}>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-lg border border-line bg-panel-2 p-3">
                <div className="mb-2 flex items-center gap-2 text-[12px] font-semibold text-ink"><Building2 size={14} /> Sales check</div>
                <Row label="Marketability" value={crane.sales.marketable ?? "Not submitted"} />
                <Row label="NRG / RG (system, from upload)" value={crane.sales.nrg === null ? "Not classified" : crane.sales.nrg ? "NRG" : "RG"} />
                <Row label="Expected deployment" value={crane.sales.expectedMonths ? `${crane.sales.expectedMonths} months` : "—"} />
                <Row label="Remarks" value={crane.sales.remarks ?? "—"} />
                <Row label="Submitted" value={crane.sales.submittedBy ? `${crane.sales.submittedBy} · ${crane.sales.submittedAt}` : "—"} />
              </div>
              <div className="rounded-lg border border-line bg-panel-2 p-3">
                <div className="mb-2 flex items-center gap-2 text-[12px] font-semibold text-ink"><Wrench size={14} /> Maintenance check</div>
                <Row label="Deployability" value={crane.maintenance.deployable === null ? "Not submitted" : crane.maintenance.deployable ? "Deployable" : "Non-Deployable"} />
                <Row label="Reason" value={crane.maintenance.reason ?? "—"} />
                <Row label="Submitted" value={crane.maintenance.submittedBy ? `${crane.maintenance.submittedBy} · ${crane.maintenance.submittedAt}` : "—"} />
              </div>
            </div>
          </Section>

          {(crane.buQuotes.length > 0 || crane.award) && (
            <Section title="International rental" icon={<Plane size={15} className="text-brand" />}>
              <div className="space-y-2">
                {crane.buQuotes.map((quote, index) => (
                  <div key={`${quote.bu}-${index}`} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-line bg-panel-2 px-3 py-2 text-[12px]">
                    <span className="font-semibold text-ink">{quote.bu}</span>
                    <span className={quote.interested ? "badge badge-healthy" : "badge badge-slate"}>
                      {quote.interested ? "Interested" : "Not interested"}
                    </span>
                    {quote.closedAt && (
                      <span className="badge badge-red" title={quote.closedReason ?? "BU quote closed"}>
                        Closed · {new Date(quote.closedAt).toLocaleDateString()}
                      </span>
                    )}
                    <span className="text-muted">
                      {quote.ratePerMonth ? `₹${quote.ratePerMonth.toLocaleString("en-IN")}/mo` : "—"} · {quote.durationMonths ?? "—"} mo · yield {quote.expectedYieldPct ?? "—"}%
                    </span>
                    <span className="text-[12px] text-faint">{quote.customer ?? "—"} · {quote.country ?? "—"}</span>
                  </div>
                ))}
              </div>
              {crane.award && (
                <div className="mt-3 rounded-lg border border-[color-mix(in_srgb,var(--old)_30%,transparent)] bg-old-soft px-3 py-2.5 text-[12px] text-old-ink">
                  <strong>Awarded to {crane.award.bu}</strong> — {crane.award.reason}
                  <div className="mt-1 text-[12px] opacity-80">
                    {crane.award.decidedBy} · {crane.award.decidedAt}
                    {crane.award.approvedBy ? ` · approved by ${crane.award.approvedBy}` : " · approval pending"}
                  </div>
                </div>
              )}
            </Section>
          )}

          {(crane.saleQuotes.length > 0 || crane.catalogue.uploaded) && (
            <div className="grid gap-4 md:grid-cols-2">
              <Section title="Catalogue" icon={<PackageOpen size={15} className="text-brand" />}>
                <Row label="Uploaded" value={crane.catalogue.uploaded ? "Yes" : "No"} />
                <Row label="Files" value={crane.catalogue.files.length ? crane.catalogue.files.join(", ") : "—"} />
                <Row label="By" value={crane.catalogue.uploadedBy ?? "—"} />
              </Section>
              <Section title="Sale quotations" icon={<ReceiptText size={15} className="text-brand" />}>
                {crane.saleQuotes.length === 0 ? (
                  <p className="text-[12px] text-muted">No quotations yet.</p>
                ) : crane.saleQuotes.map((quote, index) => (
                  <Row
                    key={`${quote.buyer}-${index}`}
                    label={`${quote.buyer} · ${quote.market}`}
                    value={`₹${quote.value.toLocaleString("en-IN")} · ${dateLabel(quote.date)}${quote.fpnaValidated ? " · FP&A checked" : ""}`}
                  />
                ))}
              </Section>
            </div>
          )}

          {(crane.claimBack || crane.conflict) && (
            <Section title="Claim-back & conflict" icon={<RotateCcw size={15} className="text-brand" />}>
              {crane.claimBack && (
                <div className="rounded-lg border border-line bg-panel-2 p-3 text-[12px]">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-ink">Claim-back by {crane.claimBack.team}</span>
                    <span className={`badge ${crane.claimBack.status === "APPROVED" ? "badge-healthy" : crane.claimBack.status === "REJECTED" ? "badge-red" : "badge-amber"}`}>
                      {crane.claimBack.status}
                    </span>
                  </div>
                  <div className="mt-1.5 text-muted">
                    {crane.claimBack.customer} · ₹{crane.claimBack.rate.toLocaleString("en-IN")}/mo · {crane.claimBack.durationMonths} months · SO expected {crane.claimBack.expectedSoDate}
                  </div>
                  <div className="mt-1 text-[12px] text-faint">“{crane.claimBack.reason}” · {crane.claimBack.createdBy}</div>
                  {crane.claimBack.rentalSoDueAt && (
                    <div className="mt-1 text-[11px] text-faint">Rental SO due by {crane.claimBack.rentalSoDueAt} · no SO returns the crane to S09</div>
                  )}
                  {crane.claimBack.reservationDueAt && (
                    <div className="mt-1 text-[11px] text-faint">BU reservation / SAP transfer due by {crane.claimBack.reservationDueAt} · otherwise back to S09</div>
                  )}
                </div>
              )}
              {crane.conflict && (
                <div className="mt-3 rounded-lg border border-[color-mix(in_srgb,var(--nd)_28%,transparent)] bg-nd-soft p-3 text-[12px] text-nd-ink">
                  <div className="font-semibold">{crane.conflict.title}</div>
                  <div className="mt-1">Decided by {crane.conflict.decidedBy} · status {crane.conflict.status}</div>
                  {crane.conflict.winner && <div className="mt-1">Outcome: {crane.conflict.winner}</div>}
                  {crane.conflict.reason && <div className="mt-1 text-[12px] opacity-80">“{crane.conflict.reason}”</div>}
                  {crane.conflict.salePausedAt && (
                    <div className="mt-1 text-[11px] opacity-80">Sale window paused {new Date(crane.conflict.salePausedAt).toLocaleString()}</div>
                  )}
                  {crane.conflict.saleWindowRestartedAt && (
                    <div className="mt-1 text-[11px] opacity-80">Sale window restarted {new Date(crane.conflict.saleWindowRestartedAt).toLocaleString()}</div>
                  )}
                  {crane.conflict.buyerNotifiedAt && (
                    <div className="mt-1 text-[11px] opacity-80">Buyer notified by {crane.conflict.buyerNotifiedBy} · {new Date(crane.conflict.buyerNotifiedAt).toLocaleString()}</div>
                  )}
                  {(crane.conflict.buQuotesClosedAt || crane.conflict.busNotifiedAt) && (
                    <div className="mt-1 text-[11px] opacity-80">
                      BU quotes closed and all BUs notified · {new Date(crane.conflict.busNotifiedAt ?? crane.conflict.buQuotesClosedAt!).toLocaleString()}
                    </div>
                  )}
                </div>
              )}
            </Section>
          )}
        </div>

        <div className="space-y-4">
          <Section title="SAP / SO record" icon={<FileText size={15} className="text-brand" />}>
            <Row label="SAP status" value={crane.sap.currentStatus} />
            <Row label="SO number" value={crane.sap.soNumber} mono />
            <Row label="SO start" value={crane.sap.soStart} mono />
            <Row label="SO end" value={crane.sap.soEnd} mono />
            <Row label="Asset transfer no." value={crane.sap.assetTransferNo} mono />
            <div className="mt-3 rounded-lg border border-line bg-panel-2 px-3 py-2">
              <div className="flex items-center gap-1.5 text-[12px] font-bold uppercase tracking-[0.1em] text-faint">
                <CalendarClock size={12} /> Execution allowed from
              </div>
              <div className="mt-1 font-mono text-[13px] font-semibold text-ink">{crane.sap.soEnd ?? "Immediately"}</div>
              <p className="mt-1 text-[12px] leading-relaxed text-muted">
                No new SO, deployment or handover before this date. The crane stays in the cycle and can still be quoted or claimed.
              </p>
            </div>
          </Section>

          <Section title="Approvals & audit" icon={<ShieldCheck size={15} className="text-brand" />}>
            {crane.approvals.length === 0 && crane.audit.length === 0 ? (
              <p className="text-[12px] text-muted">No approval or audit entries yet.</p>
            ) : (
              <ol className="space-y-3">
                {crane.audit.slice().reverse().map((entry) => (
                  <li key={entry.id} className="flex gap-2.5 border-l border-line pl-3">
                    <span className={`mt-1 h-2 w-2 shrink-0 rounded-full ${entry.action.toLowerCase().includes("lock") || entry.action.toLowerCase().includes("complete") ? "bg-healthy" : "bg-brand"}`} />
                    <div className="min-w-0">
                      <div className="text-[12px] font-semibold text-ink">{entry.action}</div>
                      <div className="text-[12px] text-muted">{entry.detail}</div>
                      <div className="text-[12px] text-faint">
                        {entry.actor}{role ? ` · ${role.short}` : ""} · {entry.at}
                      </div>
                    </div>
                  </li>
                ))}
              </ol>
            )}
            {crane.approvals.length > 0 && (
              <div className="mt-3 border-t border-line pt-3">
                <div className="mb-2 text-[12px] font-bold uppercase tracking-[0.1em] text-faint">Approvals</div>
                {crane.approvals.map((entry) => (
                  <div key={entry.id} className="mb-2 rounded-lg border border-line bg-panel-2 px-2.5 py-2 text-[12px]">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-ink">{entry.decision}</span>
                      <span className={entry.action === "APPROVED" ? "badge badge-healthy" : "badge badge-red"}>{entry.action}</span>
                    </div>
                    <div className="mt-0.5 text-[12px] text-muted">{entry.approverName} · {entry.approverRole} · {entry.at}</div>
                    {entry.comment && <div className="mt-1 text-[12px] italic text-faint">“{entry.comment}”</div>}
                  </div>
                ))}
              </div>
            )}
          </Section>

          <Link href="/approvals" className="btn btn-secondary w-full">
            <ShieldCheck size={14} /> Go to approvals
          </Link>
        </div>
      </div>
    </>
  );
}
