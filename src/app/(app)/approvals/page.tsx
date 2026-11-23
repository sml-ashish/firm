import Link from "next/link";
import { redirect } from "next/navigation";
import { ClipboardCheck, ShieldAlert } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { getApprovalQueue } from "@/lib/firm/api";
import { PageHeader } from "@/components/page-header";
import { StatusChip } from "@/components/status-chip";
import { EmptyState } from "@/components/empty-state";
import { ActionForm } from "@/components/approval-actions";
import { ROLE_MAP, STATUS_MAP, conflictOptions, type Role } from "@/lib/firm/workflow";

export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const TASKS: Record<string, { title: string; note: string }> = {
  S01: { title: "Submit parallel check", note: "Sales and Maintenance review the full fleet side by side." },
  S02: { title: "Finalise FIRM list", note: "Finance deduplicates and routes the crane." },
  S06: { title: "Decide BU award", note: "CSO decision on the award sent by Strategy." },
  S07: { title: "Record international transfer", note: "Deployment waits for the current SO to end." },
  S10: { title: "Approve sale", note: "FP&A has validated the price." },
  S11: { title: "Approve scrap sale", note: "No acceptable buyer in the sale window." },
  S13: { title: "Approve claim-back", note: "Customer, rate, duration and expected SO date are required." },
  S14: { title: "Resolve conflict", note: "Everything is paused; decision due in 3 working days." },
};

export default async function ApprovalsPage({ searchParams }: { searchParams: SearchParams }) {
  const user = await requireUser();
  if (["FPNA", "SALES", "MAINTENANCE", "FINANCE", "MARKETING", "STRATEGY", "BU", "CSO", "SCM", "CBO"].includes(user.role)) redirect("/cranes");
  const params = await searchParams;
  const craneFilter = Array.isArray(params.crane) ? params.crane[0] : params.crane;
  const queue = await getApprovalQueue(user.role);
  const role = ROLE_MAP[user.role as Role];

  // Same data source as the dashboard "My queue" card.
  const relevant = queue.filter((item) =>
    !craneFilter || item.crane.id === craneFilter || item.crane.equipmentId === craneFilter,
  );

  return (
    <>
      <PageHeader
        eyebrow="Governance"
        title="Approvals & actions"
        description={`Tasks assigned to ${role?.name ?? user.role}. Actions are recorded with your name and time; an approval given elsewhere does not move a crane forward.`}
        help="Only the decisions your role can make appear here. Locked actions stay visible so you can see the workflow; an approval given outside FIRM does not move a crane."
      />

      {relevant.length === 0 ? (
        <EmptyState
          icon={<ClipboardCheck size={19} />}
          title="Nothing for you to action"
          description="There are no cranes waiting on a decision that your role can make. Cranes in other statuses are visible in the register."
          actions={<Link href="/cranes" className="btn btn-secondary">Open crane register</Link>}
        />
      ) : (
        <div className="space-y-3">
          {relevant.map((item) => {
            const crane = item.crane;
            const task = TASKS[crane.status];
            const meta = STATUS_MAP[crane.status];
            return (
              <section key={crane.id} className="card p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link href={`/cranes/${crane.id}`} className="font-display text-[15px] font-semibold text-brand hover:underline">
                        {crane.equipmentId}
                      </Link>
                      <StatusChip status={crane.status} />
                      <span className="badge badge-slate">{meta.type}</span>
                    </div>
                    <p className="mt-1 text-[12px] text-muted">{crane.description}</p>
                    <p className="mt-1.5 text-[12px] font-semibold text-ink">{task.title}</p>
                    <p className="text-[12px] text-muted">{task.note}</p>
                  </div>
                  <div className="text-right text-[12px] text-faint">
                    <div>Execution allowed from</div>
                    <div className="font-mono text-[12px] font-semibold text-ink">{crane.sap.soEnd ?? "Immediately"}</div>
                    {crane.sap.soNumber && <div className="font-mono">SO {crane.sap.soNumber}</div>}
                  </div>
                </div>

                <div className="mt-4 border-t border-line pt-3">
                  {crane.status === "S01" && (
                    <div className="grid gap-3 lg:grid-cols-2">
                      <div>
                        <div className="mb-2 text-[12px] font-bold uppercase tracking-[0.08em] text-faint">Sales check</div>
                        <ActionForm
                          craneId={crane.id} kind="SUBMIT_SALES" label="Submit sales check" role={user.role}
                          extra={
                            <>
                              <select name="marketable" className="select h-9 w-auto" aria-label="Marketability">
                                <option>Marketable</option><option>Not marketable</option>
                              </select>
                              <select name="nrg" className="select h-9 w-auto" aria-label="NRG">
                                <option value="false">NRG: No</option><option value="true">NRG: Yes</option>
                              </select>
                              <input name="expectedMonths" type="number" min="0" placeholder="Duration (months)" className="input h-9 w-[150px]" aria-label="Expected deployment duration" />
                            </>
                          }
                        />
                      </div>
                      <div>
                        <div className="mb-2 text-[12px] font-bold uppercase tracking-[0.08em] text-faint">Maintenance check</div>
                        <ActionForm
                          craneId={crane.id} kind="SUBMIT_MAINTENANCE" label="Submit maintenance check" role={user.role}
                          extra={
                            <select name="deployable" className="select h-9 w-auto" aria-label="Deployability">
                              <option value="true">Deployable</option><option value="false">Non-Deployable</option>
                            </select>
                          }
                        />
                      </div>
                    </div>
                  )}

                  {crane.status === "S02" && (
                    <ActionForm
                      craneId={crane.id} kind="FINALISE_LIST" label="Finalise list" role={user.role}
                      requireComment confirmTitle="Finalise FIRM list?"
                      confirmBody={`${crane.equipmentId} will be routed by the dedup rule: Non-Deployable wins, otherwise Old Fleet beats NRG. Original flags stay visible.`}
                    />
                  )}

                  {crane.status === "S06" && (
                    <div className="flex flex-wrap gap-2">
                      <ActionForm craneId={crane.id} kind="APPROVE_AWARD" label="Approve award" role={user.role} requireComment confirmTitle="Approve BU award?" confirmBody={`${crane.award?.bu ?? "The awarded BU"} will be reserved for the crane (S07).`} />
                      <ActionForm craneId={crane.id} kind="REJECT_AWARD" label="Reject award" tone="danger" role={user.role} requireComment confirmTitle="Reject the award?" confirmBody="The crane returns to bid evaluation (S05)." />
                    </div>
                  )}

                  {crane.status === "S07" && (
                    <ActionForm
                      craneId={crane.id} kind="DEPLOY" label="Record asset transfer" role={user.role}
                      extra={<input name="assetTransferNo" placeholder="SAP asset transfer no." className="input h-9 w-[220px]" aria-label="Asset transfer number" />}
                      confirmTitle="Record international deployment?"
                      confirmBody={crane.sap.soEnd && crane.sap.soEnd > new Date().toISOString().slice(0, 10)
                        ? `SAP hard stop: execution allowed only from ${crane.sap.soEnd}. This action will be blocked.`
                        : "The crane will be locked in SAP (S16) and cannot be claimed back."}
                    />
                  )}

                  {crane.status === "S10" && (
                    <div className="flex flex-wrap gap-2">
                      <ActionForm craneId={crane.id} kind="APPROVE_SALE" label="Approve sale" role={user.role} requireComment confirmTitle="Approve the sale?" confirmBody="A sale SO must be created in SAP; the crane will then be locked (S18)." extra={<input name="soNumber" placeholder="SAP sale SO no." className="input h-9 w-[200px]" aria-label="Sale SO number" />} />
                      <ActionForm craneId={crane.id} kind="REJECT_SALE" label="Reject sale" tone="danger" role={user.role} requireComment confirmTitle="Reject the sale?" confirmBody="The crane returns to the sale list (S09)." />
                    </div>
                  )}

                  {crane.status === "S11" && (
                    <div className="flex flex-wrap gap-2">
                      <ActionForm craneId={crane.id} kind="APPROVE_SCRAP" label="Approve scrap" role={user.role} requireComment confirmTitle="Approve scrap sale?" confirmBody="SCM can run the scrap sale (S12)." />
                      <ActionForm craneId={crane.id} kind="REJECT_SCRAP" label="Decline scrap" tone="danger" role={user.role} requireComment confirmTitle="Decline scrap sale?" confirmBody="The crane is carried forward to the next cycle (S20)." />
                    </div>
                  )}

                  {crane.status === "S13" && (
                    <div className="flex flex-wrap gap-2">
                      <ActionForm craneId={crane.id} kind="APPROVE_CLAIM" label="Approve claim-back" role={user.role} requireComment confirmTitle="Approve claim-back?" confirmBody="The crane moves to S15. An SO must be created within 15 days." />
                      <ActionForm craneId={crane.id} kind="REJECT_CLAIM" label="Reject claim-back" tone="danger" role={user.role} requireComment confirmTitle="Reject claim-back?" confirmBody="The crane returns to the layer it was pulled from." />
                    </div>
                  )}

                  {crane.status === "S14" && (
                    <ActionForm
                      craneId={crane.id} kind="RESOLVE_CONFLICT" label="Resolve conflict" role={user.role}
                      requireComment confirmTitle="Resolve this conflict?"
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
                </div>

                {!crane.sap.soEnd && (
                  <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-line pt-3">
                    <span className="flex items-center gap-1.5 text-[12px] text-muted">
                      <ShieldAlert size={12} className="text-nrg-ink" /> No SAP SO end date entered for this crane.
                    </span>
                    <ActionForm
                      craneId={crane.id} kind="RECORD_SO" label="Record SO details" tone="secondary" role={user.role}
                      extra={
                        <>
                          <input name="soNumber" placeholder="SO number" className="input h-9 w-[140px]" aria-label="SO number" />
                          <input name="soStart" type="date" className="input h-9" aria-label="SO start date" />
                          <input name="soEnd" type="date" className="input h-9" aria-label="SO end date" />
                        </>
                      }
                    />
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}
    </>
  );
}
