import { and, asc, eq, sql } from "drizzle-orm";
import type { Database } from "@/db";
import {
  assets as assetsTable,
  evaluationResults,
  evaluationRuns,
  performance as performanceTable,
  retention as retentionTable,
  uploads as uploadsTable,
} from "@/db/schema";
import {
  classifyAsset,
  toDateOnly,
  type AssetInput,
  type Classification,
  type PerformanceYear,
  type RetentionInput,
} from "./classify";
import { getPolicy } from "./policy-store";
import type { Policy } from "./policy";
import { logAudit } from "./audit";
import type { ParsedAsset, ParsedWorkbook } from "./excel";

/* ------------------------------------------------------------------ */
/* Preview (no writes)                                                 */
/* ------------------------------------------------------------------ */

export interface PreviewRow {
  assetCode: string;
  description: string | null;
  model: string;
  yom: number;
  ageYears: number;
  ageThreshold: number | null;
  location: string | null;
  region: string | null;
  replacementCapex: number | null;
  oldFleet: boolean;
  nonDeployable: boolean;
  nrg: boolean;
  nrgStatus: string;
  primaryClass: string;
  utilisationAvgPct: number | null;
  monthlyYieldAvgPct: number | null;
  criticalCount: number;
  warningCount: number;
}

export interface ImportSummary {
  total: number;
  oldFleet: number;
  nonDeployable: number;
  nrg: number;
  nrgReview: number;
  potentialNrg: number;
  insufficientNrg: number;
  healthy: number;
  replacementCapexTotal: number;
  capexOldFleet: number;
  capexNonDeployable: number;
  capexNrg: number;
  capexHealthy: number;
  byClass: Record<string, number>;
  byNrgStatus: Record<string, number>;
  generatedAt: string;
}

export interface PreviewResult {
  rows: PreviewRow[];
  summary: ImportSummary;
}

export function previewWorkbook(
  parsed: ParsedWorkbook,
  policy: Policy,
  evaluationDate: Date,
): PreviewResult {
  const perfByAsset = new Map<string, PerformanceYear[]>();
  for (const row of parsed.performance) {
    const list = perfByAsset.get(row.assetCode) ?? [];
    list.push(row);
    perfByAsset.set(row.assetCode, list);
  }
  const retByAsset = new Map<string, RetentionInput>();
  const evalIso = evaluationDate.toISOString().slice(0, 10);
  for (const row of [...parsed.retention].sort((a, b) =>
    a.evaluationDate.localeCompare(b.evaluationDate),
  )) {
    if (row.evaluationDate <= evalIso) {
      retByAsset.set(row.assetCode, row);
    }
  }

  const rows: PreviewRow[] = parsed.assets.map((asset) => {
    const classification = classifyAsset(
      asset,
      perfByAsset.get(asset.assetCode) ?? [],
      retByAsset.get(asset.assetCode) ?? null,
      policy,
      evaluationDate,
    );
    return toPreviewRow(asset, classification);
  });

  return { rows, summary: summarise(rows.map((row) => ({ row }))) };
}

function toPreviewRow(asset: ParsedAsset, classification: Classification): PreviewRow {
  return {
    assetCode: asset.assetCode,
    description: asset.description,
    model: asset.model,
    yom: asset.yom,
    ageYears: classification.ageYears,
    ageThreshold: classification.ageThreshold,
    location: asset.location,
    region: asset.region,
    replacementCapex: asset.replacementCapex ?? null,
    oldFleet: classification.oldFleet,
    nonDeployable: classification.nonDeployable,
    nrg: classification.nrg,
    nrgStatus: classification.nrgStatus,
    primaryClass: classification.primaryClass,
    utilisationAvgPct: classification.metrics.utilisationAvgPct,
    monthlyYieldAvgPct: classification.metrics.monthlyYieldAvgPct,
    criticalCount: classification.reasons.filter((r) => r.severity === "critical").length,
    warningCount: classification.reasons.filter((r) => r.severity === "warning").length,
  };
}

function summarise(
  entries: { row: PreviewRow; replacementCapex?: number | null }[],
): ImportSummary {
  const summary: ImportSummary = {
    total: entries.length,
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

  for (const { row } of entries) {
    const capex = row.replacementCapex ?? 0;
    summary.replacementCapexTotal += capex;
    if (row.oldFleet) {
      summary.oldFleet += 1;
      summary.capexOldFleet += capex;
    }
    if (row.nonDeployable) {
      summary.nonDeployable += 1;
      summary.capexNonDeployable += capex;
    }
    if (row.nrg) {
      summary.nrg += 1;
      summary.capexNrg += capex;
    }
    if (row.primaryClass === "HEALTHY") {
      summary.healthy += 1;
      summary.capexHealthy += capex;
    }
    if (row.primaryClass === "NRG_REVIEW") summary.nrgReview += 1;
    if (row.nrgStatus === "potential") summary.potentialNrg += 1;
    if (row.nrgStatus === "insufficient") summary.insufficientNrg += 1;
    summary.byClass[row.primaryClass] = (summary.byClass[row.primaryClass] ?? 0) + 1;
    summary.byNrgStatus[row.nrgStatus] = (summary.byNrgStatus[row.nrgStatus] ?? 0) + 1;
  }

  return summary;
}

/* ------------------------------------------------------------------ */
/* Commit                                                              */
/* ------------------------------------------------------------------ */

const numeric = (value: number | null | undefined) =>
  value == null ? null : String(value);

const chunk = <T>(items: T[], size: number): T[][] => {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size));
  return chunks;
};

export interface CommitResult {
  runId: number;
  uploadId: number;
  summary: ImportSummary;
}

export async function commitImport(
  db: Database,
  input: {
    parsed: ParsedWorkbook;
    filename: string;
    evaluationDate: Date;
    actor: { id: number; name: string };
  },
): Promise<CommitResult> {
  const evaluationDateIso =
    toDateOnly(input.evaluationDate)?.toISOString().slice(0, 10) ??
    new Date().toISOString().slice(0, 10);
  const { parsed } = input;

  const upload = await db
    .insert(uploadsTable)
    .values({
      filename: input.filename,
      evaluationDate: evaluationDateIso,
      uploadedBy: input.actor.id,
      status: "PROCESSED",
      summary: {
        assets: parsed.stats.assetCount,
        performanceRows: parsed.stats.performanceRows,
        retentionRows: parsed.stats.retentionRows,
        warnings: parsed.stats.warningCount,
        errors: parsed.stats.errorCount,
      },
      errors: parsed.issues.filter((issue) => issue.severity === "error"),
    })
    .returning({ id: uploadsTable.id });

  const uploadId = upload[0].id;
  const assetIds = new Map<string, number>();

  for (const batch of chunk(parsed.assets, 150)) {
    const inserted = await db
      .insert(assetsTable)
      .values(
        batch.map((asset) => ({
          assetCode: asset.assetCode,
          description: asset.description,
          oem: asset.oem,
          model: asset.model,
          category: asset.category,
          capacityMt: numeric(asset.capacityMt),
          yom: asset.yom,
          capitalisationDate: asset.capitalisationDate,
          originalCapex: numeric(asset.originalCapex),
          grossBlock: numeric(asset.grossBlock),
          netBookValue: numeric(asset.netBookValue),
          replacementCapex: numeric(asset.replacementCapex),
          location: asset.location,
          region: asset.region,
          currentStatus: asset.currentStatus,
          oemSupport: asset.oemSupport,
          sparesAvailability: asset.sparesAvailability,
          complianceStatus: asset.complianceStatus,
          repairQuote: numeric(asset.repairQuote),
          certFitnessExpiry: asset.certFitnessExpiry,
          certLiftingExpiry: asset.certLiftingExpiry,
          certTpiExpiry: asset.certTpiExpiry,
          certPesoExpiry: asset.certPesoExpiry,
          notes: asset.notes,
          uploadId,
          updatedAt: new Date(),
        })),
      )
      .onConflictDoUpdate({
        target: assetsTable.assetCode,
        set: {
          description: sql`excluded.description`,
          oem: sql`excluded.oem`,
          model: sql`excluded.model`,
          category: sql`excluded.category`,
          capacityMt: sql`excluded.capacity_mt`,
          yom: sql`excluded.yom`,
          capitalisationDate: sql`excluded.capitalisation_date`,
          originalCapex: sql`excluded.original_capex`,
          grossBlock: sql`excluded.gross_block`,
          netBookValue: sql`excluded.net_book_value`,
          replacementCapex: sql`excluded.replacement_capex`,
          location: sql`excluded.location`,
          region: sql`excluded.region`,
          currentStatus: sql`excluded.current_status`,
          oemSupport: sql`excluded.oem_support`,
          sparesAvailability: sql`excluded.spares_availability`,
          complianceStatus: sql`excluded.compliance_status`,
          repairQuote: sql`excluded.repair_quote`,
          certFitnessExpiry: sql`excluded.cert_fitness_expiry`,
          certLiftingExpiry: sql`excluded.cert_lifting_expiry`,
          certTpiExpiry: sql`excluded.cert_tpi_expiry`,
          certPesoExpiry: sql`excluded.cert_peso_expiry`,
          notes: sql`excluded.notes`,
          uploadId: sql`excluded.upload_id`,
          updatedAt: sql`excluded.updated_at`,
        },
      })
      .returning({ id: assetsTable.id, assetCode: assetsTable.assetCode });

    for (const row of inserted) assetIds.set(row.assetCode, row.id);
  }

  const performanceValues = parsed.performance
    .map((row) => {
      const assetId = assetIds.get(row.assetCode);
      if (!assetId) return null;
      return {
        assetId,
        fy: row.fy,
        availableDays: row.availableDays ?? null,
        deployedDays: row.deployedDays ?? null,
        rentalRevenue: numeric(row.rentalRevenue),
        operatingCost: numeric(row.operatingCost),
        capitalEmployed: numeric(row.capitalEmployed),
      };
    })
    .filter((row): row is NonNullable<typeof row> => row != null);

  for (const batch of chunk(performanceValues, 300)) {
    await db
      .insert(performanceTable)
      .values(batch)
      .onConflictDoUpdate({
        target: [performanceTable.assetId, performanceTable.fy],
        set: {
          availableDays: sql`excluded.available_days`,
          deployedDays: sql`excluded.deployed_days`,
          rentalRevenue: sql`excluded.rental_revenue`,
          operatingCost: sql`excluded.operating_cost`,
          capitalEmployed: sql`excluded.capital_employed`,
        },
      });
  }

  const retentionValues = parsed.retention
    .map((row) => {
      const assetId = assetIds.get(row.assetCode);
      if (!assetId) return null;
      return {
        assetId,
        evaluationDate: row.evaluationDate,
        rentabilityCommittable: row.rentabilityCommittable ?? null,
        npv5yr: numeric(row.npv5yr),
        salePrice: numeric(row.salePrice),
        capitalReleaseReturnPct: numeric(row.capitalReleaseReturnPct),
        craneReturnPct: numeric(row.craneReturnPct),
        recommendation: row.recommendation ?? null,
        justification: row.justification ?? null,
      };
    })
    .filter((row): row is NonNullable<typeof row> => row != null);

  for (const batch of chunk(retentionValues, 300)) {
    await db
      .insert(retentionTable)
      .values(batch)
      .onConflictDoUpdate({
        target: [retentionTable.assetId, retentionTable.evaluationDate],
        set: {
          rentabilityCommittable: sql`excluded.rentability_committable`,
          npv5yr: sql`excluded.npv_5yr`,
          salePrice: sql`excluded.sale_price`,
          capitalReleaseReturnPct: sql`excluded.capital_release_return_pct`,
          craneReturnPct: sql`excluded.crane_return_pct`,
          recommendation: sql`excluded.recommendation`,
          justification: sql`excluded.justification`,
        },
      });
  }

  const run = await createEvaluationRun(db, {
    uploadId,
    evaluationDate: evaluationDateIso,
    actorId: input.actor.id,
  });

  await logAudit(db, {
    actorId: input.actor.id,
    actorName: input.actor.name,
    action: "IMPORT_COMMITTED",
    entity: "upload",
    entityId: uploadId,
    details: {
      filename: input.filename,
      evaluationDate: evaluationDateIso,
      runId: run.runId,
      assets: parsed.stats.assetCount,
      warnings: parsed.stats.warningCount,
    },
  });

  return { runId: run.runId, uploadId, summary: run.summary };
}

/* ------------------------------------------------------------------ */
/* Evaluation run                                                      */
/* ------------------------------------------------------------------ */

export async function createEvaluationRun(
  db: Database,
  input: { uploadId?: number | null; evaluationDate: string; actorId?: number | null },
): Promise<{ runId: number; summary: ImportSummary }> {
  const policy = await getPolicy(db);
  const evaluationDate = new Date(`${input.evaluationDate}T00:00:00.000Z`);

  const [assetRows, perfRows, retRows] = await Promise.all([
    db.select().from(assetsTable).orderBy(asc(assetsTable.assetCode)),
    db.select().from(performanceTable),
    db.select().from(retentionTable).orderBy(asc(retentionTable.evaluationDate)),
  ]);

  const perfByAsset = new Map<number, PerformanceYear[]>();
  for (const row of perfRows) {
    const list = perfByAsset.get(row.assetId) ?? [];
    list.push({
      fy: row.fy,
      availableDays: row.availableDays,
      deployedDays: row.deployedDays,
      rentalRevenue: toNum(row.rentalRevenue),
      operatingCost: toNum(row.operatingCost),
      capitalEmployed: toNum(row.capitalEmployed),
    });
    perfByAsset.set(row.assetId, list);
  }

  const retByAsset = new Map<number, RetentionInput>();
  for (const row of retRows) {
    if (row.evaluationDate <= input.evaluationDate) {
      retByAsset.set(row.assetId, {
        rentabilityCommittable: row.rentabilityCommittable,
        npv5yr: toNum(row.npv5yr),
        salePrice: toNum(row.salePrice),
        capitalReleaseReturnPct: toNum(row.capitalReleaseReturnPct),
        craneReturnPct: toNum(row.craneReturnPct),
        recommendation: row.recommendation,
        justification: row.justification,
      });
    }
  }

  const computed = assetRows.map((asset) => {
    const input2: AssetInput = {
      assetCode: asset.assetCode,
      model: asset.model,
      yom: asset.yom,
      replacementCapex: toNum(asset.replacementCapex),
      repairQuote: toNum(asset.repairQuote),
      oemSupport: asset.oemSupport,
      sparesAvailability: asset.sparesAvailability,
      complianceStatus: asset.complianceStatus,
      certFitnessExpiry: asset.certFitnessExpiry,
      certLiftingExpiry: asset.certLiftingExpiry,
      certTpiExpiry: asset.certTpiExpiry,
      certPesoExpiry: asset.certPesoExpiry,
    };
    return {
      asset,
      classification: classifyAsset(
        input2,
        perfByAsset.get(asset.id) ?? [],
        retByAsset.get(asset.id) ?? null,
        policy,
        evaluationDate,
      ),
    };
  });

  const previewRows = computed.map(({ asset, classification }) => ({
    row: {
      assetCode: asset.assetCode,
      description: asset.description,
      model: asset.model,
      yom: asset.yom,
      ageYears: classification.ageYears,
      ageThreshold: classification.ageThreshold,
      location: asset.location,
      region: asset.region,
      replacementCapex: toNum(asset.replacementCapex),
      oldFleet: classification.oldFleet,
      nonDeployable: classification.nonDeployable,
      nrg: classification.nrg,
      nrgStatus: classification.nrgStatus,
      primaryClass: classification.primaryClass,
      utilisationAvgPct: classification.metrics.utilisationAvgPct,
      monthlyYieldAvgPct: classification.metrics.monthlyYieldAvgPct,
      criticalCount: classification.reasons.filter((r) => r.severity === "critical").length,
      warningCount: classification.reasons.filter((r) => r.severity === "warning").length,
    } satisfies PreviewRow,
  }));
  const summary = summarise(previewRows);

  const [run] = await db
    .insert(evaluationRuns)
    .values({
      uploadId: input.uploadId ?? null,
      evaluationDate: input.evaluationDate,
      createdBy: input.actorId ?? null,
      status: "PENDING",
      summary,
      policy,
    })
    .returning({ id: evaluationRuns.id });

  const resultRows = computed.map(({ asset, classification }) => ({
    runId: run.id,
    assetId: asset.id,
    assetCode: asset.assetCode,
    oldFleet: classification.oldFleet,
    nonDeployable: classification.nonDeployable,
    nrg: classification.nrg,
    nrgStatus: classification.nrgStatus,
    ageYears: classification.ageYears,
    ageThreshold: classification.ageThreshold,
    primaryClass: classification.primaryClass,
    reasons: classification.reasons,
    metrics: classification.metrics,
  }));

  for (const batch of chunk(resultRows, 200)) {
    await db.insert(evaluationResults).values(batch);
  }

  return { runId: run.id, summary };
}

function toNum(value: unknown): number | null {
  if (value == null || value === "") return null;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

export async function getRetentionForAsset(
  db: Database,
  assetId: number,
  evaluationDate: string,
) {
  const rows = await db
    .select()
    .from(retentionTable)
    .where(
      and(
        eq(retentionTable.assetId, assetId),
        sql`${retentionTable.evaluationDate} <= ${evaluationDate}`,
      ),
    )
    .orderBy(asc(retentionTable.evaluationDate));
  return rows.at(-1) ?? null;
}
