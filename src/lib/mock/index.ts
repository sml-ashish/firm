/**
 * Mock implementation of the FIRM data facade.
 * Mirrors the shape of `@/lib/queries` so pages can switch between mock and
 * live data with NEXT_PUBLIC_USE_MOCK.
 */

import { sanitizePolicy, type Policy } from "@/lib/policy";
import {
  filterAndSortAssets,
  type ApprovalQueueItem,
  type AssetDetail,
  type AssetFilters,
  type AssetListResult,
  type AssetRow,
  type DashboardData,
  type ModelStat,
  type ModelStatDetail,
  type RegionStat,
  type RunDetail,
  type RunListItem,
} from "@/lib/queries";
import type { ImportSummary } from "@/lib/import";
import {
  MOCK_APPROVALS,
  MOCK_ASSET_ROWS,
  MOCK_ASSETS,
  MOCK_AUDIT,
  MOCK_CLASSIFICATIONS,
  MOCK_EVALUATION_DATE,
  MOCK_PERFORMANCE,
  MOCK_POLICY,
  MOCK_RETENTION,
  MOCK_RUNS,
  MOCK_UPLOADS,
  MOCK_USERS,
  buildResults,
  buildSummary,
  toAssetRow,
} from "./data";

export type { MockUser } from "./data";

const SEVERITY_WEIGHT: Record<string, number> = {
  NON_DEPLOYABLE: 5,
  NRG: 4,
  NRG_REVIEW: 3,
  OLD_FLEET: 2,
  HEALTHY: 1,
};

const LATEST_RUN_ID = MOCK_RUNS[0].id;

function summaryFor(): ImportSummary {
  return buildSummary(MOCK_ASSET_ROWS);
}

export async function getPolicy(): Promise<Policy> {
  return sanitizePolicy(MOCK_POLICY);
}

export async function getUsers() {
  return MOCK_USERS;
}

export async function getRuns(limit = 50): Promise<RunListItem[]> {
  return MOCK_RUNS.slice(0, limit).map((run) => {
    const upload = MOCK_UPLOADS.find((entry) => entry.id === run.uploadId) ?? null;
    return {
      id: run.id,
      evaluationDate: run.evaluationDate,
      createdAt: run.createdAt,
      status: run.status,
      filename: upload?.filename ?? null,
      uploadId: run.uploadId,
      summary: summaryFor(),
    };
  });
}

export async function getRunDetail(runId: number): Promise<RunDetail | null> {
  const run = MOCK_RUNS.find((entry) => entry.id === runId);
  if (!run) return null;

  const upload = MOCK_UPLOADS.find((entry) => entry.id === run.uploadId) ?? null;
  const results = buildResults(run.id);

  return {
    run,
    upload,
    creatorName: "Satish Irale",
    policy: sanitizePolicy(run.policy as Partial<Policy>),
    rows: MOCK_ASSETS.map((asset, index) => ({
      asset,
      result: results[index] ?? null,
    })),
    approvals: MOCK_APPROVALS.filter((approval) => approval.runId === run.id).sort(
      (a, b) => a.actedAt.getTime() - b.actedAt.getTime(),
    ),
    audit: MOCK_AUDIT,
  };
}

export async function getAssets(filters: AssetFilters = {}): Promise<AssetListResult> {
  const allRows = MOCK_ASSET_ROWS;
  const regions = [
    ...new Set(allRows.map((row) => row.region).filter((value): value is string => !!value)),
  ].sort();
  const models = [...new Set(allRows.map((row) => row.model))].sort();
  const filtered = filterAndSortAssets(allRows, filters);

  const pageSize = Math.min(100, Math.max(5, filters.pageSize ?? 25));
  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const page = Math.min(pages, Math.max(1, filters.page ?? 1));

  return {
    rows: filtered.slice((page - 1) * pageSize, page * pageSize),
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

export async function getAssetDetail(code: string): Promise<AssetDetail | null> {
  const asset = MOCK_ASSETS.find((entry) => entry.assetCode === code);
  if (!asset) return null;

  const run = MOCK_RUNS[0];
  const results = buildResults(run.id);
  const result = results.find((entry) => entry.assetId === asset.id) ?? null;

  return {
    asset,
    row: toAssetRow(asset, result),
    result,
    runId: run.id,
    runStatus: run.status,
    runEvaluationDate: run.evaluationDate,
    performance: MOCK_PERFORMANCE.filter((row) => row.assetId === asset.id),
    retention: MOCK_RETENTION.filter((row) => row.assetId === asset.id).sort((a, b) =>
      b.evaluationDate.localeCompare(a.evaluationDate),
    ),
    approvals: MOCK_APPROVALS.filter((approval) => approval.runId === run.id),
    policy: sanitizePolicy(run.policy as Partial<Policy>),
  };
}

export async function getApprovalQueue(): Promise<ApprovalQueueItem[]> {
  const open = MOCK_RUNS.filter((run) =>
    ["PENDING", "PREPARED", "REVIEWED", "RETURNED"].includes(run.status),
  );
  return open.map((run) => ({
    run,
    filename: MOCK_UPLOADS.find((entry) => entry.id === run.uploadId)?.filename ?? null,
    approvals: MOCK_APPROVALS.filter((approval) => approval.runId === run.id).sort(
      (a, b) => a.actedAt.getTime() - b.actedAt.getTime(),
    ),
  }));
}

export async function getModelStats(): Promise<Map<string, ModelStatDetail>> {
  const map = new Map<string, ModelStatDetail>();
  for (const row of MOCK_ASSET_ROWS) {
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

export async function getDashboard(): Promise<DashboardData> {
  const rows: AssetRow[] = MOCK_ASSET_ROWS;
  const run = MOCK_RUNS[0];

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
    const entry = modelMap.get(row.model) ?? { model: row.model, total: 0, flagged: 0, capex: 0 };
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

  return {
    run,
    summary: summaryFor(),
    fleetCount: rows.length,
    rows,
    byRegion: [...regionMap.values()].sort((a, b) => b.total - a.total),
    byModel: [...modelMap.values()]
      .filter((entry) => entry.flagged > 0)
      .sort((a, b) => b.capex - a.capex)
      .slice(0, 10),
    priority,
    recentRuns: await getRuns(6),
    pendingApprovals: MOCK_RUNS.filter((entry) =>
      ["PENDING", "PREPARED", "REVIEWED"].includes(entry.status),
    ).length,
    dataGaps: {
      nrgInsufficient: rows.filter((row) => row.nrgStatus === "insufficient").length,
      nrgPotential: rows.filter((row) => row.nrgStatus === "potential").length,
      missingCapex: rows.filter((row) => row.replacementCapex == null).length,
    },
  };
}

/** Exposed for the mock-mode banner / diagnostics. */
export const MOCK_META = {
  evaluationDate: MOCK_EVALUATION_DATE,
  latestRunId: LATEST_RUN_ID,
  classes: MOCK_CLASSIFICATIONS.map((entry) => entry.primaryClass),
};
