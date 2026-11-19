/**
 * Mock fixtures for the FIRM frontend.
 *
 * The fixtures are built from the *real* classification engine so the demo data
 * obeys the same precedence rules as production: Non-Deployable > NRG >
 * NRG Review > Old Fleet > Healthy. Nothing here is hand-waved - every reason,
 * observed value and threshold is produced by `classifyAsset`.
 *
 * Enable with NEXT_PUBLIC_USE_MOCK=true. Sign-in still uses the seeded accounts
 * in the database, so run `npm run seed:demo` once before using mock mode.
 */

import { auditLog } from "@/db/schema";
import type {
  Approval,
  Asset,
  EvaluationResult,
  EvaluationRun,
  PerformanceRow,
  RetentionRow,
  Upload,
} from "@/db/schema";
import {
  classifyAsset,
  type Classification,
  type PerformanceYear,
  type RetentionInput,
} from "@/lib/classify";
import type { ImportSummary } from "@/lib/import";
import { POLICY_DEFAULTS, type Policy } from "@/lib/policy";
import type { AssetRow } from "@/lib/queries";

export type AuditLogRow = typeof auditLog.$inferSelect;

export const MOCK_POLICY: Policy = POLICY_DEFAULTS;
export const MOCK_EVALUATION_DATE = "2026-09-30";
const EVAL_DATE = new Date(`${MOCK_EVALUATION_DATE}T00:00:00Z`);
const FY_LABELS = ["2023-24", "2024-25", "2025-26"] as const;

/* ------------------------------------------------------------------ */
/* Users                                                               */
/* ------------------------------------------------------------------ */

export interface MockUser {
  id: number;
  name: string;
  email: string;
  role: string;
  designation: string | null;
}

export const MOCK_USERS: MockUser[] = [
  { id: 1, name: "System Administrator", email: "admin@firm.local", role: "ADMIN", designation: "System Administrator" },
  { id: 2, name: "Satish Irale", email: "satish.irale@firm.local", role: "PREPARER", designation: "AVP - SCM" },
  { id: 3, name: "Prajwal Kumar", email: "prajwal.kumar@firm.local", role: "REVIEWER", designation: "CBO" },
  { id: 4, name: "Abhijeet Sawarkar", email: "abhijeet.sawarkar@firm.local", role: "REVIEWER", designation: "VP" },
  { id: 5, name: "R. Manoj", email: "r.manoj@firm.local", role: "REVIEWER", designation: "VP" },
  { id: 6, name: "Gaurang Desai", email: "gaurang.desai@firm.local", role: "APPROVER", designation: "CEO" },
  { id: 7, name: "Rishi Sanghvi", email: "rishi.sanghvi@firm.local", role: "APPROVER", designation: "MD" },
];

/* ------------------------------------------------------------------ */
/* Asset seeds                                                         */
/* ------------------------------------------------------------------ */

interface Seed {
  code: string;
  description: string;
  oem: string;
  model: string;
  category: string;
  capacityMt: number;
  yom: number;
  capex: number;
  repairQuote: number;
  region: string;
  location: string;
  currentStatus: string;
  oemSupport: string;
  spares: string;
  compliance: string;
  certs?: [string, string, string, string];
  utilisation: number[];
  yieldPct: number[];
  retention?: RetentionInput;
}

const DEFAULT_CERTS: [string, string, string, string] = [
  "2027-06-30",
  "2027-03-31",
  "2027-01-31",
  "2027-08-31",
];

const SEEDS: Seed[] = [
  {
    code: "SM-1001",
    description: "100 T hydraulic mobile telescopic crane",
    oem: "Demag",
    model: "AC 100",
    category: "Hydraulic mobile telescopic",
    capacityMt: 100,
    yom: 2003,
    capex: 6_50_00_000,
    repairQuote: 2_10_00_000,
    region: "West",
    location: "Pune",
    currentStatus: "Deployed",
    oemSupport: "discontinued",
    spares: "available",
    compliance: "compliant",
    utilisation: [64, 61, 58],
    yieldPct: [2.4, 2.1, 1.9],
  },
  {
    code: "SM-1002",
    description: "150 T hydraulic mobile telescopic crane",
    oem: "Tadano",
    model: "F150",
    category: "Hydraulic mobile telescopic",
    capacityMt: 150,
    yom: 2009,
    capex: 1_80_00_000,
    repairQuote: 22_00_000,
    region: "North",
    location: "Delhi NCR",
    currentStatus: "Idle",
    oemSupport: "supported",
    spares: "available",
    compliance: "compliant",
    utilisation: [48, 44, 39],
    yieldPct: [1.9, 1.7, 1.5],
  },
  {
    code: "SM-1003",
    description: "80 T crawler crane",
    oem: "XCMG",
    model: "QUY80",
    category: "Crawler",
    capacityMt: 80,
    yom: 2014,
    capex: 2_40_00_000,
    repairQuote: 28_00_000,
    region: "South",
    location: "Chennai",
    currentStatus: "Deployed",
    oemSupport: "supported",
    spares: "available",
    compliance: "compliant",
    utilisation: [38, 41, 35],
    yieldPct: [0.42, 0.38, 0.31],
    retention: {
      rentabilityCommittable: false,
      npv5yr: 1_90_00_000,
      salePrice: 2_60_00_000,
      capitalReleaseReturnPct: 14.2,
      craneReturnPct: 9.1,
      recommendation: "Sell",
      justification:
        "The business team cannot underwrite five-year rentability and the NPV of future cash flows is below the achievable sale price. Capital released earns a better return elsewhere in the fleet.",
    },
  },
  {
    code: "SM-1004",
    description: "150 T crawler crane",
    oem: "Sany",
    model: "SCC1500C",
    category: "Crawler",
    capacityMt: 150,
    yom: 2015,
    capex: 5_20_00_000,
    repairQuote: 55_00_000,
    region: "East",
    location: "Kolkata",
    currentStatus: "Deployed",
    oemSupport: "supported",
    spares: "available",
    compliance: "compliant",
    utilisation: [44, 39, 41],
    yieldPct: [0.61, 0.55, 0.49],
  },
  {
    code: "SM-1005",
    description: "180 T lattice-boom crawler crane",
    oem: "Liebherr",
    model: "LR 1800",
    category: "Lattice-boom crawler",
    capacityMt: 180,
    yom: 2004,
    capex: 12_50_00_000,
    repairQuote: 1_40_00_000,
    region: "West",
    location: "Mumbai",
    currentStatus: "Deployed",
    oemSupport: "supported",
    spares: "available",
    compliance: "compliant",
    utilisation: [71, 68, 73],
    yieldPct: [2.8, 2.6, 2.9],
  },
  {
    code: "SM-1006",
    description: "250 T crawler crane",
    oem: "Sany",
    model: "SCC2500C",
    category: "Crawler",
    capacityMt: 250,
    yom: 2012,
    capex: 9_80_00_000,
    repairQuote: 85_00_000,
    region: "North",
    location: "Gurugram",
    currentStatus: "Deployed",
    oemSupport: "supported",
    spares: "available",
    compliance: "compliant",
    utilisation: [76, 74, 78],
    yieldPct: [3.4, 3.2, 3.6],
  },
  {
    code: "SM-1007",
    description: "300 T all-terrain crane",
    oem: "Grove",
    model: "GMK 6300",
    category: "All-terrain",
    capacityMt: 300,
    yom: 2018,
    capex: 14_00_00_000,
    repairQuote: 1_05_00_000,
    region: "South",
    location: "Bengaluru",
    currentStatus: "Deployed",
    oemSupport: "supported",
    spares: "available",
    compliance: "compliant",
    utilisation: [82, 80, 84],
    yieldPct: [4.1, 3.9, 4.4],
  },
  {
    code: "SM-1008",
    description: "1,200 T crawler crane",
    oem: "XCMG",
    model: "XGC12000",
    category: "Crawler",
    capacityMt: 1200,
    yom: 2011,
    capex: 18_00_00_000,
    repairQuote: 1_60_00_000,
    region: "West",
    location: "Surat",
    currentStatus: "Deployed",
    oemSupport: "supported",
    spares: "available",
    compliance: "compliant",
    utilisation: [69, 72, 70],
    yieldPct: [3.1, 3.3, 3.0],
  },
  {
    code: "SM-1009",
    description: "750 T lattice-boom crawler crane",
    oem: "Liebherr",
    model: "LR1750",
    category: "Lattice-boom crawler",
    capacityMt: 750,
    yom: 2002,
    capex: 15_50_00_000,
    repairQuote: 1_90_00_000,
    region: "North",
    location: "Noida",
    currentStatus: "Idle",
    oemSupport: "discontinued",
    spares: "available",
    compliance: "compliant",
    utilisation: [52, 47, 43],
    yieldPct: [2.2, 1.9, 1.7],
  },
  {
    code: "SM-1010",
    description: "800 T crawler crane",
    oem: "Sany",
    model: "SCC8000A",
    category: "Crawler",
    capacityMt: 800,
    yom: 2008,
    capex: 22_00_00_000,
    repairQuote: 2_40_00_000,
    region: "East",
    location: "Bhubaneswar",
    currentStatus: "Deployed",
    oemSupport: "supported",
    spares: "unavailable",
    compliance: "compliant",
    utilisation: [66, 63],
    yieldPct: [2.7, 2.5],
  },
  {
    code: "SM-1011",
    description: "200 T lattice-boom crawler crane",
    oem: "Demag",
    model: "DEMAG TC2800",
    category: "Lattice-boom crawler",
    capacityMt: 200,
    yom: 2016,
    capex: 8_00_00_000,
    repairQuote: 62_00_000,
    region: "South",
    location: "Hyderabad",
    currentStatus: "Deployed",
    oemSupport: "supported",
    spares: "available",
    compliance: "compliant",
    utilisation: [74, 71, 76],
    yieldPct: [3.6, 3.4, 3.8],
  },
  {
    code: "SM-1012",
    description: "250 T all-terrain crane",
    oem: "Liebherr",
    model: "LTM 1250-6.1",
    category: "All-terrain",
    capacityMt: 250,
    yom: 2010,
    capex: 11_20_00_000,
    repairQuote: 1_20_00_000,
    region: "West",
    location: "Ahmedabad",
    currentStatus: "Breakdown",
    oemSupport: "supported",
    spares: "available",
    compliance: "compliant",
    certs: ["2026-03-31", "2027-05-31", "2027-02-28", "2027-09-30"],
    utilisation: [58, 54, 49],
    yieldPct: [2.5, 2.3, 2.0],
  },
];

/* ------------------------------------------------------------------ */
/* Derived DB-shaped rows                                              */
/* ------------------------------------------------------------------ */

const toDate = (value: string) => new Date(`${value}T00:00:00Z`);

export const MOCK_ASSETS: Asset[] = SEEDS.map((seed, index) => ({
  id: index + 1,
  assetCode: seed.code,
  description: seed.description,
  oem: seed.oem,
  model: seed.model,
  category: seed.category,
  capacityMt: seed.capacityMt.toFixed(2),
  yom: seed.yom,
  capitalisationDate: `${seed.yom}-06-15`,
  originalCapex: seed.capex.toFixed(2),
  grossBlock: seed.capex.toFixed(2),
  netBookValue: Math.round(seed.capex * 0.18).toFixed(2),
  replacementCapex: seed.capex.toFixed(2),
  location: seed.location,
  region: seed.region,
  currentStatus: seed.currentStatus,
  oemSupport: seed.oemSupport,
  sparesAvailability: seed.spares,
  complianceStatus: seed.compliance,
  repairQuote: seed.repairQuote.toFixed(2),
  certFitnessExpiry: (seed.certs ?? DEFAULT_CERTS)[0],
  certLiftingExpiry: (seed.certs ?? DEFAULT_CERTS)[1],
  certTpiExpiry: (seed.certs ?? DEFAULT_CERTS)[2],
  certPesoExpiry: (seed.certs ?? DEFAULT_CERTS)[3],
  notes:
    seed.code === "SM-1011"
      ? "Model name in the workbook does not match the approved master."
      : null,
  uploadId: 7,
  updatedAt: toDate("2026-10-02"),
}));

let performanceId = 1;
export const MOCK_PERFORMANCE: PerformanceRow[] = SEEDS.flatMap((seed, index) =>
  seed.utilisation.map((utilisation, yearIndex) => {
    const available = 300;
    const deployed = Math.round((utilisation / 100) * available);
    const revenue = Math.round((seed.yieldPct[yearIndex] / 100) * seed.capex * 12);
    return {
      id: performanceId++,
      assetId: index + 1,
      fy: FY_LABELS[yearIndex],
      availableDays: available,
      deployedDays: deployed,
      rentalRevenue: revenue.toFixed(2),
      operatingCost: Math.round(revenue * 0.55).toFixed(2),
      capitalEmployed: seed.capex.toFixed(2),
    };
  }),
);

let retentionId = 1;
export const MOCK_RETENTION: RetentionRow[] = SEEDS.flatMap((seed, index) => {
  if (!seed.retention) return [];
  const retention = seed.retention;
  return [
    {
      id: retentionId++,
      assetId: index + 1,
      evaluationDate: MOCK_EVALUATION_DATE,
      rentabilityCommittable: retention.rentabilityCommittable ?? null,
      npv5yr: retention.npv5yr?.toFixed(2) ?? null,
      salePrice: retention.salePrice?.toFixed(2) ?? null,
      capitalReleaseReturnPct: retention.capitalReleaseReturnPct?.toFixed(2) ?? null,
      craneReturnPct: retention.craneReturnPct?.toFixed(2) ?? null,
      recommendation: retention.recommendation ?? null,
      justification: retention.justification ?? null,
    },
  ];
});

function performanceFor(assetId: number): PerformanceYear[] {
  return MOCK_PERFORMANCE.filter((row) => row.assetId === assetId).map((row) => ({
    fy: row.fy,
    availableDays: row.availableDays,
    deployedDays: row.deployedDays,
    rentalRevenue: row.rentalRevenue == null ? null : Number(row.rentalRevenue),
    operatingCost: row.operatingCost == null ? null : Number(row.operatingCost),
    capitalEmployed: row.capitalEmployed == null ? null : Number(row.capitalEmployed),
  }));
}

function retentionFor(assetId: number): RetentionInput | null {
  const row = MOCK_RETENTION.find((entry) => entry.assetId === assetId);
  if (!row) return null;
  return {
    rentabilityCommittable: row.rentabilityCommittable,
    npv5yr: row.npv5yr == null ? null : Number(row.npv5yr),
    salePrice: row.salePrice == null ? null : Number(row.salePrice),
    capitalReleaseReturnPct:
      row.capitalReleaseReturnPct == null ? null : Number(row.capitalReleaseReturnPct),
    craneReturnPct: row.craneReturnPct == null ? null : Number(row.craneReturnPct),
    recommendation: row.recommendation,
    justification: row.justification,
  };
}

export const MOCK_CLASSIFICATIONS: Classification[] = MOCK_ASSETS.map((asset) =>
  classifyAsset(
    {
      assetCode: asset.assetCode,
      model: asset.model,
      yom: asset.yom,
      replacementCapex: asset.replacementCapex == null ? null : Number(asset.replacementCapex),
      repairQuote: asset.repairQuote == null ? null : Number(asset.repairQuote),
      oemSupport: asset.oemSupport,
      sparesAvailability: asset.sparesAvailability,
      complianceStatus: asset.complianceStatus,
      certFitnessExpiry: asset.certFitnessExpiry,
      certLiftingExpiry: asset.certLiftingExpiry,
      certTpiExpiry: asset.certTpiExpiry,
      certPesoExpiry: asset.certPesoExpiry,
    },
    performanceFor(asset.id),
    retentionFor(asset.id),
    MOCK_POLICY,
    EVAL_DATE,
  ),
);

/* ------------------------------------------------------------------ */
/* Runs, uploads, approvals, audit                                     */
/* ------------------------------------------------------------------ */

interface RunSeed {
  id: number;
  status: string;
  evaluationDate: string;
  createdAt: string;
  uploadId: number;
  filename: string;
  uploadedAt: string;
}

const RUN_SEEDS: RunSeed[] = [
  {
    id: 42,
    status: "REVIEWED",
    evaluationDate: "2026-09-30",
    createdAt: "2026-10-02T09:15:00Z",
    uploadId: 7,
    filename: "FIRM_Fleet_Master_FY2025-26.xlsx",
    uploadedAt: "2026-10-02T09:10:00Z",
  },
  {
    id: 41,
    status: "APPROVED",
    evaluationDate: "2026-07-31",
    createdAt: "2026-08-03T10:20:00Z",
    uploadId: 6,
    filename: "FIRM_Fleet_Master_Jul2026.xlsx",
    uploadedAt: "2026-08-03T10:15:00Z",
  },
  {
    id: 40,
    status: "RETURNED",
    evaluationDate: "2026-06-30",
    createdAt: "2026-07-02T08:40:00Z",
    uploadId: 5,
    filename: "FIRM_Fleet_Master_Jun2026.xlsx",
    uploadedAt: "2026-07-02T08:35:00Z",
  },
  {
    id: 39,
    status: "APPROVED",
    evaluationDate: "2026-05-31",
    createdAt: "2026-06-02T11:05:00Z",
    uploadId: 4,
    filename: "FIRM_Fleet_Master_May2026.xlsx",
    uploadedAt: "2026-06-02T11:00:00Z",
  },
  {
    id: 38,
    status: "APPROVED",
    evaluationDate: "2026-04-30",
    createdAt: "2026-05-04T09:30:00Z",
    uploadId: 3,
    filename: "FIRM_Fleet_Master_Apr2026.xlsx",
    uploadedAt: "2026-05-04T09:25:00Z",
  },
];

function buildResults(runId: number): EvaluationResult[] {
  return MOCK_ASSETS.map((asset, index) => {
    const classification = MOCK_CLASSIFICATIONS[index];
    return {
      id: runId * 100 + index + 1,
      runId,
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
    };
  });
}

export function buildSummary(rows: AssetRow[]): ImportSummary {
  const summary: ImportSummary = {
    total: rows.length,
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
    generatedAt: `${MOCK_EVALUATION_DATE}T09:15:00Z`,
  };

  for (const row of rows) {
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
    if (row.primaryClass === "NRG_REVIEW") summary.nrgReview += 1;
    if (row.nrgStatus === "potential") summary.potentialNrg += 1;
    if (row.nrgStatus === "insufficient") summary.insufficientNrg += 1;
    if (row.primaryClass === "HEALTHY") {
      summary.healthy += 1;
      summary.capexHealthy += capex;
    }
    summary.byClass[row.primaryClass] = (summary.byClass[row.primaryClass] ?? 0) + 1;
    summary.byNrgStatus[row.nrgStatus] = (summary.byNrgStatus[row.nrgStatus] ?? 0) + 1;
  }

  return summary;
}

export function toAssetRow(asset: Asset, result: EvaluationResult | null): AssetRow {
  const metrics = (result?.metrics ?? null) as AssetRow["metrics"];
  const reasons = (result?.reasons ?? []) as { severity: string }[];
  return {
    id: asset.id,
    code: asset.assetCode,
    description: asset.description,
    model: asset.model,
    oem: asset.oem,
    category: asset.category,
    capacityMt: asset.capacityMt == null ? null : Number(asset.capacityMt),
    yom: asset.yom,
    ageYears: result?.ageYears ?? EVAL_DATE.getUTCFullYear() - asset.yom,
    ageThreshold: result?.ageThreshold ?? null,
    region: asset.region,
    location: asset.location,
    currentStatus: asset.currentStatus,
    replacementCapex: asset.replacementCapex == null ? null : Number(asset.replacementCapex),
    utilisationAvgPct: metrics?.utilisationAvgPct ?? null,
    monthlyYieldAvgPct: metrics?.monthlyYieldAvgPct ?? null,
    oldFleet: result?.oldFleet ?? false,
    nonDeployable: result?.nonDeployable ?? false,
    nrg: result?.nrg ?? false,
    nrgStatus: result?.nrgStatus ?? "insufficient",
    primaryClass: result?.primaryClass ?? "HEALTHY",
    criticalCount: reasons.filter((reason) => reason.severity === "critical").length,
    warningCount: reasons.filter((reason) => reason.severity === "warning").length,
    metrics,
  };
}

export const MOCK_ASSET_ROWS: AssetRow[] = MOCK_ASSETS.map((asset, index) =>
  toAssetRow(asset, buildResults(42)[index]),
);

export const MOCK_RUNS: EvaluationRun[] = RUN_SEEDS.map((seed) => ({
  id: seed.id,
  uploadId: seed.uploadId,
  evaluationDate: seed.evaluationDate,
  createdBy: 2,
  createdAt: new Date(seed.createdAt),
  status: seed.status,
  summary: buildSummary(MOCK_ASSET_ROWS),
  policy: MOCK_POLICY,
}));

export const MOCK_UPLOADS: Upload[] = RUN_SEEDS.map((seed) => ({
  id: seed.uploadId,
  filename: seed.filename,
  evaluationDate: seed.evaluationDate,
  uploadedBy: 2,
  uploadedAt: new Date(seed.uploadedAt),
  status: "PROCESSED",
  summary: { ...buildSummary(MOCK_ASSET_ROWS), warnings: 3 },
  errors: [],
}));

const APPROVAL_SEEDS: Array<Omit<Approval, "id">> = [
  {
    runId: 42,
    stage: "PREPARED",
    actorId: 2,
    actorName: "Satish Irale",
    designation: "AVP - SCM",
    action: "PREPARE",
    comment:
      "Imported the FY2025-26 fleet master and reconciled all 12 assets against the approved model master.",
    actedAt: new Date("2026-10-02T11:30:00Z"),
  },
  {
    runId: 42,
    stage: "REVIEWED",
    actorId: 3,
    actorName: "Prajwal Kumar",
    designation: "CBO",
    action: "REVIEW",
    comment:
      "Classification matches the source workbook. Two certificate dates are still blank and are flagged as warnings.",
    actedAt: new Date("2026-10-03T10:15:00Z"),
  },
  {
    runId: 41,
    stage: "PREPARED",
    actorId: 2,
    actorName: "Satish Irale",
    designation: "AVP - SCM",
    action: "PREPARE",
    comment: "July 2026 fleet master imported and checked.",
    actedAt: new Date("2026-08-03T09:00:00Z"),
  },
  {
    runId: 41,
    stage: "REVIEWED",
    actorId: 4,
    actorName: "Abhijeet Sawarkar",
    designation: "VP",
    action: "REVIEW",
    comment: "Reviewed the flagged fleet and confirmed the reasons against source records.",
    actedAt: new Date("2026-08-04T10:00:00Z"),
  },
  {
    runId: 41,
    stage: "APPROVED",
    actorId: 6,
    actorName: "Gaurang Desai",
    designation: "CEO",
    action: "APPROVE",
    comment: "Approved as the current fleet position.",
    actedAt: new Date("2026-08-05T12:00:00Z"),
  },
  {
    runId: 40,
    stage: "PREPARED",
    actorId: 2,
    actorName: "Satish Irale",
    designation: "AVP - SCM",
    action: "PREPARE",
    comment: "June 2026 fleet master imported.",
    actedAt: new Date("2026-07-02T08:50:00Z"),
  },
  {
    runId: 40,
    stage: "REVIEWED",
    actorId: 3,
    actorName: "Prajwal Kumar",
    designation: "CBO",
    action: "RETURN",
    comment:
      "Three assets have missing replacement capex and two certificate expiry dates are blank. Correct the workbook and re-import.",
    actedAt: new Date("2026-07-03T09:20:00Z"),
  },
  {
    runId: 39,
    stage: "PREPARED",
    actorId: 2,
    actorName: "Satish Irale",
    designation: "AVP - SCM",
    action: "PREPARE",
    comment: "May 2026 fleet master imported.",
    actedAt: new Date("2026-06-02T11:20:00Z"),
  },
  {
    runId: 39,
    stage: "REVIEWED",
    actorId: 5,
    actorName: "R. Manoj",
    designation: "VP",
    action: "REVIEW",
    comment: "Classification and data coverage reviewed.",
    actedAt: new Date("2026-06-03T09:40:00Z"),
  },
  {
    runId: 39,
    stage: "APPROVED",
    actorId: 7,
    actorName: "Rishi Sanghvi",
    designation: "MD",
    action: "APPROVE",
    comment: "Approved.",
    actedAt: new Date("2026-06-04T15:10:00Z"),
  },
  {
    runId: 38,
    stage: "PREPARED",
    actorId: 2,
    actorName: "Satish Irale",
    designation: "AVP - SCM",
    action: "PREPARE",
    comment: "April 2026 fleet master imported.",
    actedAt: new Date("2026-05-04T09:50:00Z"),
  },
  {
    runId: 38,
    stage: "REVIEWED",
    actorId: 3,
    actorName: "Prajwal Kumar",
    designation: "CBO",
    action: "REVIEW",
    comment: "Reviewed and forwarded.",
    actedAt: new Date("2026-05-05T10:05:00Z"),
  },
  {
    runId: 38,
    stage: "APPROVED",
    actorId: 6,
    actorName: "Gaurang Desai",
    designation: "CEO",
    action: "APPROVE",
    comment: "Approved.",
    actedAt: new Date("2026-05-06T11:30:00Z"),
  },
];

export const MOCK_APPROVALS: Approval[] = APPROVAL_SEEDS.map((seed, index) => ({
  ...seed,
  id: index + 1,
}));

export const MOCK_AUDIT: AuditLogRow[] = [
  {
    id: 1,
    actorId: 2,
    actorName: "Satish Irale",
    action: "UPLOAD_COMMITTED",
    entity: "upload",
    entityId: "7",
    details: { filename: "FIRM_Fleet_Master_FY2025-26.xlsx", warnings: 3 },
    createdAt: new Date("2026-10-02T09:10:00Z"),
  },
  {
    id: 2,
    actorId: 2,
    actorName: "Satish Irale",
    action: "CLASSIFICATION_RUN_CREATED",
    entity: "upload",
    entityId: "7",
    details: { runId: 42, evaluationDate: MOCK_EVALUATION_DATE },
    createdAt: new Date("2026-10-02T09:15:00Z"),
  },
  {
    id: 3,
    actorId: 3,
    actorName: "Prajwal Kumar",
    action: "RUN_REVIEW",
    entity: "upload",
    entityId: "7",
    details: { from: "PREPARED", to: "REVIEWED" },
    createdAt: new Date("2026-10-03T10:15:00Z"),
  },
];

export { buildResults };
