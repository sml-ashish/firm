import Link from "next/link";
import { Filter, Search, Truck } from "lucide-react";
import { getCranes } from "@/lib/firm/api";
import { PageHeader } from "@/components/page-header";
import { StatusChip, FlagChip } from "@/components/status-chip";
import { EmptyState } from "@/components/empty-state";
import { CraneReviewButton } from "@/components/crane-review-button";
import { FinanceDedupeButton } from "@/components/finance-dedupe-button";
import { FinanceBulkDedupeButton } from "@/components/finance-bulk-dedupe-button";
import { MarketingCatalogueButton } from "@/components/marketing-catalogue-button";
import { StrategyFlowButton } from "@/components/strategy-flow-button";
import { BuQuoteButton } from "@/components/bu-quote-button";
import { CsoDecisionButton } from "@/components/cso-decision-button";
import { ScmCatalogueDocuments } from "@/components/scm-catalogue-documents";
import { ScmSaleQuoteButton } from "@/components/scm-sale-quote-button";
import { FpnaPriceCheckButton } from "@/components/fpna-price-check-button";
import { CboDecisionButton } from "@/components/cbo-decision-button";
import {
  CATEGORY_LABEL, STATUSES,
  type FinalCategory,
} from "@/lib/firm/workflow";
import { requireUser } from "@/lib/auth";
import { DensityToggle } from "@/components/dashboard/density-toggle";

export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const one = (value: string | string[] | undefined) =>
  Array.isArray(value) ? value[0] ?? "" : value ?? "";

export default async function CranesPage({ searchParams }: { searchParams: SearchParams }) {
  const user = await requireUser();
  const params = await searchParams;
  const filters = {
    q: one(params.q),
    status: one(params.status),
    layer: one(params.layer),
    category: one(params.category),
    type: one(params.type),
  };
  const scopeByRole = ["STRATEGY", "BU", "MARKETING", "CSO", "SCM", "CBO"].includes(user.role);
  const result = await getCranes(scopeByRole ? { ...filters, role: user.role } : filters);

  const isSales = user.role === "SALES";
  const isMaintenance = user.role === "MAINTENANCE";
  const isReviewer = isSales || isMaintenance;
  const isFinance = user.role === "FINANCE" || user.role === "GLOBAL_ADMIN";
  const isMarketing = user.role === "MARKETING";
  const isStrategy = user.role === "STRATEGY";
  const isBu = user.role === "BU";
  const isCso = user.role === "CSO";
  const isScm = user.role === "SCM";
  const isFpna = user.role === "FPNA";
  const isCbo = user.role === "CBO";
  const hideSummary = isReviewer || isMarketing || isStrategy || isBu || isCso;
  const canUpload = user.role === "FPNA" || user.role === "GLOBAL_ADMIN";
  const financePending = isFinance
    ? (await getCranes()).rows.filter((crane) => crane.status === "S02").length
    : 0;

  return (
    <>
      <PageHeader
        eyebrow="FIRM cycle"
        title="Crane register"
        actions={
          <>
            <DensityToggle />
            {isFinance && <FinanceBulkDedupeButton count={financePending} />}
            {canUpload && (
              <Link href="/import" className="btn btn-primary">
                <Truck size={14} /> Upload fleet
              </Link>
            )}
          </>
        }
      />

      <div className="card mb-4 p-3">
        <form method="get" className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
          <div className="relative sm:col-span-2 lg:col-span-1">
            <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-faint" />
            <input name="q" defaultValue={filters.q} placeholder="Equipment ID or description" className="input h-9 pl-9" aria-label="Search cranes" />
          </div>
          <select name="status" defaultValue={filters.status} className="select h-9" aria-label="Status">
            <option value="">All statuses</option>
            {STATUSES.map((status) => (
              <option key={status.code} value={status.code}>{status.code} · {status.name}</option>
            ))}
          </select>
          <select name="layer" defaultValue={filters.layer} className="select h-9" aria-label="Layer">
            <option value="">All layers</option>
            {["L1", "L2", "L3", "L4", "L5", "L6", "L7", "L8"].map((layer) => (
              <option key={layer} value={layer}>{layer}</option>
            ))}
          </select>
          <select name="category" defaultValue={filters.category} className="select h-9" aria-label="Final category">
            <option value="">All categories</option>
            {(Object.keys(CATEGORY_LABEL) as FinalCategory[]).map((category) => (
              <option key={category} value={category}>{CATEGORY_LABEL[category]}</option>
            ))}
          </select>
          <select name="type" defaultValue={filters.type} className="select h-9" aria-label="Status type">
            <option value="">All types</option>
            {["Active", "Approval", "On Hold", "Locked", "Closed"].map((type) => (
              <option key={type} value={type}>{type}</option>
            ))}
          </select>
          <div className="flex items-center gap-2 sm:col-span-2 lg:col-span-5">
            <button type="submit" className="btn btn-primary h-9"><Filter size={13} /> Apply filters</button>
            <Link href="/cranes" className="btn btn-ghost h-9">Clear</Link>
            <span className="ml-auto text-[12px] text-muted">
              {result.total} crane{result.total === 1 ? "" : "s"}
              {!hideSummary && ` · ${result.counts.approval} awaiting approval · ${result.counts.locked} locked`}
            </span>
          </div>
        </form>
      </div>

      {result.rows.length === 0 ? (
        <EmptyState
          icon={<Truck size={19} />}
          title="No cranes match these filters"
          actions={<Link href="/cranes" className="btn btn-secondary">Clear filters</Link>}
        />
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto scroll-thin">
            <table id="crane-table" className={`w-full text-left ${isFinance ? "min-w-[1320px]" : isReviewer || isMarketing || isStrategy || isBu || isCso || isScm || isFpna || isCbo ? "min-w-[1180px]" : "min-w-[980px]"}`}>
              <thead>
                <tr className="border-b border-line bg-panel-2 text-[12px] font-bold uppercase tracking-[0.08em] text-faint">
                  <th className="px-3 py-2.5">Equipment</th>
                  <th className="px-3 py-2.5">YOM / Age</th>
                  <th className="px-3 py-2.5">Yield %</th>
                  <th className="px-3 py-2.5">Utilisation %</th>
                  <th className="px-3 py-2.5">Status</th>
                  <th className="px-3 py-2.5">Flags</th>
                  <th className="px-3 py-2.5">Available from</th>
                  {isReviewer && <th className="px-3 py-2.5">Review</th>}
                  {isFinance && <th className="px-3 py-2.5">Final category</th>}
                  {isFinance && <th className="px-3 py-2.5">FIRM list</th>}
                  {isMarketing && <th className="px-3 py-2.5">Catalogue</th>}
                  {isStrategy && <th className="px-3 py-2.5">Strategy</th>}
                  {isBu && <th className="px-3 py-2.5">BU quote</th>}
                  {isCso && <th className="px-3 py-2.5">CSO decision</th>}
                  {isCbo && <th className="px-3 py-2.5">CBO decision</th>}
                  {isScm && <th className="px-3 py-2.5">Catalogue docs</th>}
                  {isScm && <th className="px-3 py-2.5">Sale quote</th>}
                  {isFpna && <th className="px-3 py-2.5">Price check</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {result.rows.map((crane) => {
                  const derivedNrg = crane.utilisationPct < 60 && crane.yieldPct < 1.8;
                  return (
                    <tr key={crane.id} className="text-[12px] transition hover:bg-panel-2">
                      <td className="px-3 py-2.5">
                        <Link href={`/cranes/${crane.id}`} className="font-semibold text-brand hover:underline">
                          {crane.equipmentId}
                        </Link>
                        <div className="max-w-[260px] truncate text-[12px] text-muted">{crane.description}</div>
                      </td>
                      <td className="px-3 py-2.5 tabular-nums text-muted">{crane.yom} <span className="text-faint">({crane.age}y)</span></td>
                      <td className="px-3 py-2.5 tabular-nums text-muted">{crane.yieldPct}%</td>
                      <td className="px-3 py-2.5 tabular-nums text-muted">{crane.utilisationPct}%</td>
                      <td className="px-3 py-2.5"><StatusChip status={crane.status} /></td>
                      <td className="px-3 py-2.5">
                        <div className="flex flex-wrap gap-1">
                          {crane.flags.oldFleet && <FlagChip label="Old Fleet" tone="violet" />}
                          <FlagChip label={derivedNrg ? "NRG" : "Non-NRG"} tone={derivedNrg ? "orange" : "slate"} />
                          {crane.flags.nonDeployable && <FlagChip label="Non-Deployable" tone="red" />}
                        </div>
                      </td>
                      <td className="px-3 py-2.5 font-mono text-[12px] text-muted">{crane.sap.soEnd ?? "—"}</td>
                      {isReviewer && (
                        <td className="px-3 py-2.5">
                          <CraneReviewButton
                            role={user.role}
                            crane={{
                              id: crane.id,
                              equipmentId: crane.equipmentId,
                              status: crane.status,
                              salesSubmitted: !!crane.sales.submittedBy,
                              marketable: crane.sales.marketable,
                              nrg: crane.sales.nrg,
                              expectedMonths: crane.sales.expectedMonths,
                              maintenanceSubmitted: !!crane.maintenance.submittedBy,
                              deployable: crane.maintenance.deployable,
                            }}
                          />
                        </td>
                      )}
                      {isFinance && (
                        <td className="px-3 py-2.5">
                          {crane.finalCategory ? (
                            <span className="text-[12px] font-medium text-ink">
                              {CATEGORY_LABEL[crane.finalCategory]}
                            </span>
                          ) : (
                            <span className="text-[12px] text-faint">Not finalised</span>
                          )}
                        </td>
                      )}
                      {isFinance && (
                        <td className="px-3 py-2.5">
                          {crane.status === "S02" ? (
                            <FinanceDedupeButton
                              role={user.role}
                              crane={{
                                id: crane.id,
                                equipmentId: crane.equipmentId,
                                flags: crane.flags,
                              }}
                            />
                          ) : crane.finalCategory ? (
                            <span className="badge badge-slate">Finalised</span>
                          ) : (
                            <span className="text-[12px] text-faint">—</span>
                          )}
                        </td>
                      )}
                      {isMarketing && (
                        <td className="px-3 py-2.5">
                          {crane.status === "S08" ? (
                            <MarketingCatalogueButton
                              role={user.role}
                              crane={{
                                id: crane.id,
                                equipmentId: crane.equipmentId,
                                uploaded: crane.catalogue.uploaded,
                                files: crane.catalogue.files,
                                attachments: crane.catalogue.attachments,
                                uploadedBy: crane.catalogue.uploadedBy,
                                at: crane.catalogue.at,
                              }}
                            />
                          ) : ["S09", "S10", "S11", "S12", "S18", "S19", "S20"].includes(crane.status) ? (
                            <div className="flex flex-col gap-0.5">
                              <span className="badge badge-brand">Sent to SCM</span>
                              {!crane.catalogue.uploaded && (
                                <span className="text-[11px] font-medium text-danger">Catalogue missing</span>
                              )}
                            </div>
                          ) : (
                            <span className="text-[12px] text-faint">—</span>
                          )}
                        </td>
                      )}
                      {isStrategy && (
                        <td className="px-3 py-2.5">
                          {["S04", "S05", "S06", "S07", "S16"].includes(crane.status) ? (
                            <StrategyFlowButton
                              role={user.role}
                              crane={{
                                id: crane.id,
                                equipmentId: crane.equipmentId,
                                status: crane.status,
                                yom: crane.yom,
                                yieldPct: crane.yieldPct,
                                finalCategory: crane.finalCategory,
                                deployable: crane.maintenance.deployable,
                                catalogueUploaded: crane.catalogue.uploaded,
                                buQuotes: crane.buQuotes,
                                award: crane.award,
                                sap: { soEnd: crane.sap.soEnd, assetTransferNo: crane.sap.assetTransferNo },
                              }}
                            />
                          ) : (
                            <span className="text-[12px] text-faint">—</span>
                          )}
                        </td>
                      )}
                      {isBu && (
                        <td className="px-3 py-2.5">
                          {["S04", "S05"].includes(crane.status) ? (
                            <BuQuoteButton
                              role={user.role}
                              crane={{
                                id: crane.id,
                                equipmentId: crane.equipmentId,
                                status: crane.status,
                                buQuotes: crane.buQuotes,
                              }}
                            />
                          ) : (
                            <span className="text-[12px] text-faint">—</span>
                          )}
                        </td>
                      )}
                      {isCso && (
                        <td className="px-3 py-2.5">
                          {["S06", "S13", "S14"].includes(crane.status) ? (
                            <CsoDecisionButton
                              role={user.role}
                              crane={{
                                id: crane.id,
                                equipmentId: crane.equipmentId,
                                status: crane.status,
                                yieldPct: crane.yieldPct,
                                award: crane.award,
                                buQuotes: crane.buQuotes,
                                claimBack: crane.claimBack,
                                conflict: crane.conflict,
                              }}
                            />
                          ) : (
                            <span className="text-[12px] text-faint">—</span>
                          )}
                        </td>
                      )}
                      {isCbo && (
                        <td className="px-3 py-2.5">
                          {["S10", "S13", "S14"].includes(crane.status) ? (
                            <CboDecisionButton
                              role={user.role}
                              crane={{
                                id: crane.id,
                                equipmentId: crane.equipmentId,
                                status: crane.status as "S10" | "S13" | "S14",
                                saleQuotes: crane.saleQuotes,
                                selectedSaleQuoteIndex: crane.selectedSaleQuoteIndex,
                                claimBack: crane.claimBack,
                                conflict: crane.conflict,
                                award: crane.award,
                              }}
                            />
                          ) : (
                            <span className="text-[12px] text-faint">—</span>
                          )}
                        </td>
                      )}
                      {isScm && (
                        <td className="px-3 py-2.5">
                          <ScmCatalogueDocuments
                            crane={{
                              equipmentId: crane.equipmentId,
                              uploaded: crane.catalogue.uploaded,
                              files: crane.catalogue.files,
                              attachments: crane.catalogue.attachments,
                              uploadedBy: crane.catalogue.uploadedBy,
                              at: crane.catalogue.at,
                            }}
                          />
                        </td>
                      )}
                      {isScm && (
                        <td className="px-3 py-2.5">
                          {["S09", "S10"].includes(crane.status) ? (
                            <ScmSaleQuoteButton
                              role={user.role}
                              crane={{
                                id: crane.id,
                                equipmentId: crane.equipmentId,
                                status: crane.status,
                                saleQuotes: crane.saleQuotes,
                                selectedSaleQuoteIndex: crane.selectedSaleQuoteIndex,
                              }}
                            />
                          ) : (
                            <span className="text-[12px] text-faint">—</span>
                          )}
                        </td>
                      )}
                      {isFpna && (
                        <td className="px-3 py-2.5">
                          {crane.status === "S10" ? (
                            <FpnaPriceCheckButton
                              role={user.role}
                              crane={{
                                id: crane.id,
                                equipmentId: crane.equipmentId,
                                status: crane.status,
                                saleQuotes: crane.saleQuotes,
                                selectedSaleQuoteIndex: crane.selectedSaleQuoteIndex,
                              }}
                            />
                          ) : (
                            <span className="text-[12px] text-faint">—</span>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}
