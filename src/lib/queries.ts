import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import type { Database } from "@/db";
import {
  approvals,
  assets,
  auditLog,
  evaluationResults,
  evaluationRuns,
  performance,
  retention,
  uploads,
} from "@/db/schema";
import type { ClassificationMetrics, Reason } from "./classify";
import type { ImportSummary } from "./import";
import { sanitizePolicy, type Policy } from "./policy";

const toNum = (value: unknown): number | null => {
  if (value == null || value === "") return null;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
};

/* ------------------------------------------------------------------ */
/* Shared view models                                                  */
/* ------------------------------------------------------------------ */

export interface AssetRow {
  id: number;
  code: string;
  description: string | null;
  model: string;
  oem: string | null;
  category: string | null;
  capacityMt: number | null;
  yom: number;
  ageYears: number;
  ageThreshold: number | null;
  region: string | null;
  location: string | null;
  currentStatus: string | null;
  replacementCapex: number | null;
  utilisationAvgPct: number | null;
  monthlyYieldAvgPct: number | null;
  oldFleet: boolean;
  nonDeployable: boolean;
  nrg: boolean;
  nrgStatus: string;
  primaryClass: string;
  criticalCount: number;
  warningCount: number;
  metrics: ClassificationMetrics | null;
}

type AssetRecord = typeof assets.$inferSelect;
type ResultRecord = typeof evaluationResults.$inferSelect;

function mapAssetRow(asset: AssetRecord, result: ResultRecord | null): AssetRow {
  const metrics = (result?.metrics ?? null) as ClassificationMetrics | null;
  const reasons = (result?.reasons ?? []) as Reason[];
  return {
    id: asset.id,
    code: asset.assetCode,
    description: asset.description,
    model: asset.model,
    oem: asset.oem,
    category: asset.category,
    capacityMt: toNum(asset.capacityMt),
    yom: asset.yom,
    ageYears: result?.ageYears ?? new Date().getUTCFullYear() - asset.yom,
    ageThreshold: result?.ageThreshold ?? null,
    region: asset.region,
    location: asset.location,
    currentStatus: asset.currentStatus,
    replacementCapex: toNum(asset.replacementCapex),
    utilisationAvgPct: metrics?.utilisationAvgPct ?? null,
    monthlyYieldAvgPct: metrics?.monthlyYieldAvgPct ?? null,
    oldFleet: result?.oldFleet ?? false,
    nonDeployable: result?.nonDeployable ?? false,
    nrg: result?.nrg ?? false,
    nrgStatus: result?.nrgStatus ?? "insufficient",
    primaryClass: result?.primaryClass ?? "HEALTHY",
    criticalCount: reasons.filter((r) => r.severity === "critical").length,
    warningCount: reasons.filter((r) => r.severity === "warning").length,
    metrics,
  };
}

const SEVERITY_WEIGHT: Record<string, number> = {
  NON_DEPLOYABLE: 5,
  NRG: 4,
  NRG_REVIEW: 3,
  OLD_FLEET: 2,
  HEALTHY: 1,
};

/* ------------------------------------------------------------------ */
/* Runs                                                                */
/* ------------------------------------------------------------------ */

export async function getLatestRun(db: Database) {
  const rows = await db
    .select()
    .from(evaluationRuns)
    .orderBy(desc(evaluationRuns.createdAt), desc(evaluationRuns.id))
    .limit(1);
  return rows[0] ?? null;
}

export async function getRunRows(
  db: Database,
  runId: number,
): Promise<{ asset: AssetRecord; result: ResultRecord | null }[]> {
  return db
    .select({ asset: assets, result: evaluationResults })
    .from(evaluationResults)
    .innerJoin(assets, eq(evaluationResults.assetId, assets.id))
    .where(eq(evaluationResults.runId, runId))
    .orderBy(asc(assets.assetCode));
}

export interface RunListItem {
  id: number;
  evaluationDate: string;
  createdAt: Date;
  status: string;
  filename: string | null;
  uploadId: number | null;
  summary: ImportSummary | null;
}

export async function listRuns(db: Database, limit = 50): Promise<RunListItem[]> {
  const rows = await db
    .select({
      id: evaluationRuns.id,
      evaluationDate: evaluationRuns.evaluationDate,
      createdAt: evaluationRuns.createdAt,
      status: evaluationRuns.status,
      uploadId: evaluationRuns.uploadId,
      summary: evaluationRuns.summary,
      filename: uploads.filename,
    })
    .from(evaluationRuns)
    .leftJoin(uploads, eq(evaluationRuns.uploadId, uploads.id))
    .orderBy(desc(evaluationRuns.createdAt), desc(evaluationRuns.id))
    .limit(limit);

  return rows.map((row) => ({
    ...row,
    summary: (row.summary ?? null) as ImportSummary | null,
  }));
}

export interface RunDetail {
  run: typeof evaluationRuns.$inferSelect;
  upload: typeof uploads.$inferSelect | null;
  creatorName: string | null;
  policy: Policy;
  rows: { asset: AssetRecord; result: ResultRecord | null }[];
  approvals: (typeof approvals.$inferSelect)[];
  audit: (typeof auditLog.$inferSelect)[];
}

export async function getRunDetail(db: Database, runId: number): Promise<RunDetail | null> {
  const runRows = await db
    .select({ run: evaluationRuns, upload: uploads })
    .from(evaluationRuns)
    .leftJoin(uploads, eq(evaluationRuns.uploadId, uploads.id))
    .where(eq(evaluationRuns.id, runId))
    .limit(1);
  if (runRows.length === 0) return null;

  const uploadId = runRows[0].run.uploadId;
  const [rows, approvalRows, auditRows] = await Promise.all([
    getRunRows(db, runId),
    db
      .select()
      .from(approvals)
      .where(eq(approvals.runId, runId))
      .orderBy(asc(approvals.actedAt)),
    uploadId == null
      ? Promise.resolve([])
      : db
          .select()
          .from(auditLog)
          .where(and(eq(auditLog.entity, "upload"), eq(auditLog.entityId, String(uploadId))))
          .orderBy(desc(auditLog.createdAt))
          .limit(20),
  ]);

  return {
    run: runRows[0].run,
    upload: runRows[0].upload,
    creatorName: null,
    policy: sanitizePolicy((runRows[0].run.policy ?? {}) as Partial<Policy>),
    rows,
    approvals: approvalRows,
    audit: auditRows,
  };
}

/* ------------------------------------------------------------------ */
/* Assets                                                              */
/* ------------------------------------------------------------------ */

export interface AssetFilters {
  q?: string;
  classification?: string;
  region?: string;
  model?: string;
  sort?: string;
  data?: string;
  page?: number;
  pageSize?: number;
}

export interface AssetListResult {
  rows: AssetRow[];
  total: number;
  page: number;
  pages: number;
  pageSize: number;
  regions: string[];
  models: string[];
  filteredCapex: number;
  filteredOldFleet: number;
  filteredNonDeployable: number;
  filteredNrg: number;
  counts: {
    all: number;
    flagged: number;
    nonDeployable: number;
    nrg: number;
    nrgReview: number;
    oldFleet: number;
    healthy: number;
  };
}

export async function getAllAssetRows(db: Database): Promise<AssetRow[]> {
  const run = await getLatestRun(db);
  const rows = run
    ? await getRunRows(db, run.id)
    : (await db.select().from(assets).orderBy(asc(assets.assetCode))).map((asset) => ({
        asset,
        result: null,
      }));
  return rows.map(({ asset, result }) => mapAssetRow(asset, result));
}

export function filterAndSortAssets(allRows: AssetRow[], filters: AssetFilters): AssetRow[] {
  const q = filters.q?.trim().toLowerCase();
  let filtered = allRows.filter((row) => {
    if (q) {
      const haystack = `${row.code} ${row.description ?? ""} ${row.model} ${row.location ?? ""} ${row.region ?? ""}`.toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    if (filters.region && row.region !== filters.region) return false;
    if (filters.model && row.model !== filters.model) return false;
    if (filters.data === "nrg-insufficient" && row.nrgStatus !== "insufficient") return false;
    if (filters.data === "nrg-potential" && row.nrgStatus !== "potential") return false;
    if (filters.data === "missing-capex" && row.replacementCapex != null) return false;
    switch (filters.classification) {
      case "NON_DEPLOYABLE":
        return row.nonDeployable;
      case "NRG":
        return row.nrg;
      case "NRG_REVIEW":
        return row.primaryClass === "NRG_REVIEW";
      case "OLD_FLEET":
        return row.oldFleet;
      case "HEALTHY":
        return row.primaryClass === "HEALTHY";
      case "FLAGGED":
        return row.primaryClass !== "HEALTHY";
      default:
        return true;
    }
  });

  switch (filters.sort) {
    case "age":
      filtered = filtered.sort((a, b) => b.ageYears - a.ageYears);
      break;
    case "code":
      filtered = filtered.sort((a, b) => a.code.localeCompare(b.code));
      break;
    case "utilisation":
      filtered = filtered.sort(
        (a, b) => (a.utilisationAvgPct ?? 999) - (b.utilisationAvgPct ?? 999),
      );
      break;
    case "yield":
      filtered = filtered.sort(
        (a, b) => (a.monthlyYieldAvgPct ?? 999) - (b.monthlyYieldAvgPct ?? 999),
      );
      break;
    case "risk":
      filtered = filtered.sort(
        (a, b) =>
          SEVERITY_WEIGHT[b.primaryClass] - SEVERITY_WEIGHT[a.primaryClass] ||
          (b.replacementCapex ?? 0) - (a.replacementCapex ?? 0),
      );
      break;
    default:
      filtered = filtered.sort((a, b) => (b.replacementCapex ?? 0) - (a.replacementCapex ?? 0));
  }

  return filtered;
}

export async function listAssets(
  db: Database,
  filters: AssetFilters = {},
): Promise<AssetListResult> {
  const allRows = await getAllAssetRows(db);
  const regions = [...new Set(allRows.map((row) => row.region).filter((v): v is string => !!v))].sort();
  const models = [...new Set(allRows.map((row) => row.model))].sort();
  const filtered = filterAndSortAssets(allRows, filters);

  const pageSize = Math.min(100, Math.max(5, filters.pageSize ?? 25));
  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const page = Math.min(pages, Math.max(1, filters.page ?? 1));
  const rows = filtered.slice((page - 1) * pageSize, page * pageSize);

  return {
    rows,
    total: filtered.length,
    page,
    pages,
    pageSize,
    regions,
    models,
    filteredCapex: filtered.reduce((sum, row) => sum + (row.replacementCapex ?? 0), 0),
    filteredOldFleet: filtered.filter((row) => row.oldFleet).length,
    filteredNonDeployable: filtered.filter((row) => row.nonDeployable).length,
    filteredNrg: filtered.filter((row) => row.nrg).length,
    counts: {
      all: allRows.length,
      flagged: allRows.filter((row) => row.primaryClass !== "HEALTHY").length,
      nonDeployable: allRows.filter((row) => row.nonDeployable).length,
      nrg: allRows.filter((row) => row.nrg).length,
      nrgReview: allRows.filter((row) => row.primaryClass === "NRG_REVIEW").length,
      oldFleet: allRows.filter((row) => row.oldFleet).length,
      healthy: allRows.filter((row) => row.primaryClass === "HEALTHY").length,
    },
  };
}

export async function exportAssets(
  db: Database,
  filters: AssetFilters = {},
): Promise<AssetRow[]> {
  const allRows = await getAllAssetRows(db);
  return filterAndSortAssets(allRows, filters);
}

export interface AssetDetail {
  asset: AssetRecord;
  row: AssetRow;
  result: ResultRecord | null;
  runId: number | null;
  runStatus: string | null;
  runEvaluationDate: string | null;
  performance: (typeof performance.$inferSelect)[];
  retention: (typeof retention.$inferSelect)[];
  approvals: (typeof approvals.$inferSelect)[];
  policy: Policy;
}

export async function getAssetDetail(
  db: Database,
  code: string,
): Promise<AssetDetail | null> {
  const assetRows = await db.select().from(assets).where(eq(assets.assetCode, code)).limit(1);
  if (assetRows.length === 0) return null;
  const asset = assetRows[0];

  const run = await getLatestRun(db);
  const resultRows =
    run != null
      ? await db
          .select()
          .from(evaluationResults)
          .where(
            and(eq(evaluationResults.runId, run.id), eq(evaluationResults.assetId, asset.id)),
          )
          .limit(1)
      : [];
  const result = resultRows[0] ?? null;

  const [perfRows, retRows, approvalRows] = await Promise.all([
    db
      .select()
      .from(performance)
      .where(eq(performance.assetId, asset.id))
      .orderBy(asc(performance.fy)),
    db
      .select()
      .from(retention)
      .where(eq(retention.assetId, asset.id))
      .orderBy(desc(retention.evaluationDate)),
    run
      ? db
          .select()
          .from(approvals)
          .where(eq(approvals.runId, run.id))
          .orderBy(asc(approvals.actedAt))
      : Promise.resolve([]),
  ]);

  return {
    asset,
    row: mapAssetRow(asset, result),
    result,
    runId: run?.id ?? null,
    runStatus: run?.status ?? null,
    runEvaluationDate: run?.evaluationDate ?? null,
    performance: perfRows,
    retention: retRows,
    approvals: approvalRows,
    policy: run ? sanitizePolicy((run.policy ?? {}) as Partial<Policy>) : sanitizePolicy({}),
  };
}

/* ------------------------------------------------------------------ */
/* Dashboard                                                           */
/* ------------------------------------------------------------------ */

export interface RegionStat {
  region: string;
  total: number;
  oldFleet: number;
  nonDeployable: number;
  nrg: number;
  capex: number;
}

export interface ModelStat {
  model: string;
  total: number;
  flagged: number;
  capex: number;
}

export interface DashboardData {
  run: typeof evaluationRuns.$inferSelect | null;
  summary: ImportSummary;
  fleetCount: number;
  rows: AssetRow[];
  byRegion: RegionStat[];
  byModel: ModelStat[];
  priority: AssetRow[];
  recentRuns: RunListItem[];
  pendingApprovals: number;
  dataGaps: { nrgInsufficient: number; nrgPotential: number; missingCapex: number };
}

export function emptySummary(): ImportSummary {
  return {
    total: 0,
    oldFleet: 0,
    nonDeployable: 0,
    nrg: 0,
    nrgReview: 0,
    potentialNrg: 0,
    insufficientNrg: 0,
    healthy: 0,
    replacementCapexTotal: 0,
    capexOldFleet: 0,
    capexNonDeployable: 0,
    capexNrg: 0,
    capexHealthy: 0,
    byClass: {},
    byNrgStatus: {},
    generatedAt: new Date().toISOString(),
  };
}

export async function getDashboardData(db: Database): Promise<DashboardData> {
  const run = await getLatestRun(db);
  const rows = run
    ? (await getRunRows(db, run.id)).map(({ asset, result }) => mapAssetRow(asset, result))
    : (await db.select().from(assets).orderBy(asc(assets.assetCode))).map((asset) =>
        mapAssetRow(asset, null),
      );

  const summary = (run?.summary as ImportSummary | null) ?? emptySummary();

  const regionMap = new Map<string, RegionStat>();
  for (const row of rows) {
    const region = row.region || "Unassigned";
    const entry = regionMap.get(region) ?? {
      region,
      total: 0,
      oldFleet: 0,
      nonDeployable: 0,
      nrg: 0,
      capex: 0,
    };
    entry.total += 1;
    entry.capex += row.replacementCapex ?? 0;
    if (row.oldFleet) entry.oldFleet += 1;
    if (row.nonDeployable) entry.nonDeployable += 1;
    if (row.nrg) entry.nrg += 1;
    regionMap.set(region, entry);
  }

  const modelMap = new Map<string, ModelStat>();
  for (const row of rows) {
    const entry = modelMap.get(row.model) ?? {
      model: row.model,
      total: 0,
      flagged: 0,
      capex: 0,
    };
    entry.total += 1;
    entry.capex += row.replacementCapex ?? 0;
    if (row.primaryClass !== "HEALTHY") entry.flagged += 1;
    modelMap.set(row.model, entry);
  }

  const priority = [...rows]
    .filter((row) => row.primaryClass !== "HEALTHY")
    .sort(
      (a, b) =>
        SEVERITY_WEIGHT[b.primaryClass] - SEVERITY_WEIGHT[a.primaryClass] ||
        (b.replacementCapex ?? 0) - (a.replacementCapex ?? 0),
    )
    .slice(0, 10);

  const recentRuns = await listRuns(db, 6);
  const pendingRows = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(evaluationRuns)
    .where(inArray(evaluationRuns.status, ["PENDING", "PREPARED", "REVIEWED"]));

  const dataGaps = {
    nrgInsufficient: rows.filter((row) => row.nrgStatus === "insufficient").length,
    nrgPotential: rows.filter((row) => row.nrgStatus === "potential").length,
    missingCapex: rows.filter((row) => row.replacementCapex == null).length,
  };

  return {
    run,
    summary,
    fleetCount: rows.length,
    rows,
    byRegion: [...regionMap.values()].sort((a, b) => b.total - a.total),
    byModel: [...modelMap.values()]
      .filter((entry) => entry.flagged > 0)
      .sort((a, b) => b.capex - a.capex)
      .slice(0, 10),
    priority,
    recentRuns,
    pendingApprovals: Number(pendingRows[0]?.count ?? 0),
    dataGaps,
  };
}

/* ------------------------------------------------------------------ */
/* Approval queue                                                      */
/* ------------------------------------------------------------------ */

export interface ApprovalQueueItem {
  run: typeof evaluationRuns.$inferSelect;
  filename: string | null;
  approvals: (typeof approvals.$inferSelect)[];
}

export async function getApprovalQueue(db: Database): Promise<ApprovalQueueItem[]> {
  const runRows = await db
    .select({ run: evaluationRuns, filename: uploads.filename })
    .from(evaluationRuns)
    .leftJoin(uploads, eq(evaluationRuns.uploadId, uploads.id))
    .where(inArray(evaluationRuns.status, ["PENDING", "PREPARED", "REVIEWED", "RETURNED"]))
    .orderBy(desc(evaluationRuns.createdAt))
    .limit(50);

  if (runRows.length === 0) return [];

  const approvalRows = await db
    .select()
    .from(approvals)
    .where(inArray(approvals.runId, runRows.map((row) => row.run.id)))
    .orderBy(asc(approvals.actedAt));

  return runRows.map((row) => ({
    run: row.run,
    filename: row.filename,
    approvals: approvalRows.filter((approval) => approval.runId === row.run.id),
  }));
}

/* ------------------------------------------------------------------ */
/* Model master stats                                                  */
/* ------------------------------------------------------------------ */

export interface ModelStatDetail {
  total: number;
  oldFleet: number;
  nonDeployable: number;
  nrg: number;
  capex: number;
}

export async function getModelStats(db: Database): Promise<Map<string, ModelStatDetail>> {
  const rows = await getAllAssetRows(db);
  const map = new Map<string, ModelStatDetail>();
  for (const row of rows) {
    const entry = map.get(row.model) ?? {
      total: 0,
      oldFleet: 0,
      nonDeployable: 0,
      nrg: 0,
      capex: 0,
    };
    entry.total += 1;
    if (row.oldFleet) entry.oldFleet += 1;
    if (row.nonDeployable) entry.nonDeployable += 1;
    if (row.nrg) entry.nrg += 1;
    entry.capex += row.replacementCapex ?? 0;
    map.set(row.model, entry);
  }
  return map;
}
