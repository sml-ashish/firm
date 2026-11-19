/**
 * Deterministic demo data for the FIRM workflow.
 *
 * Every crane is built through `dedupe` so its flags, finalCategory and route
 * agree with the business rules. SAP dates follow the "no new SO or deployment
 * before the current SO ends" rule.
 */

import type {
  ApprovalEntry,
  AuditEntry,
  Crane,
  Cycle,
  MaintenanceCheck,
  SapData,
  SalesCheck,
} from "./types";
import { dedupe, type Flags, type StatusCode } from "./workflow";

const EVAL_YEAR = 2026;
const FUTURE_SO_END = "2027-03-31";
const PAST_SO_END = "2026-09-30";

const C02 = "C02";
const C01 = "C01";

export const CYCLES: Cycle[] = [
  {
    id: C02,
    name: "FIRM Cycle 2026-02",
    openedAt: "2026-10-01T09:00:00Z",
    openedBy: "Priya Nair",
    evaluationDate: "2026-11-15",
    startDate: "2026-10-01",
    endDate: null,
    status: "OPEN",
  },
  {
    id: C01,
    name: "FIRM Cycle 2026-08",
    openedAt: "2026-07-01T09:00:00Z",
    openedBy: "Priya Nair",
    evaluationDate: "2026-08-31",
    startDate: "2026-07-01",
    endDate: "2026-08-31",
    status: "CLOSED",
  },
];

const importAt = (cycleId: string) =>
  cycleId === C01 ? "2026-07-05T09:30:00Z" : "2026-10-05T09:30:00Z";

const order = (status: StatusCode) => Number(status.slice(1));

const EMPTY_SALES: SalesCheck = {
  marketable: null,
  nrg: null,
  expectedMonths: null,
  remarks: null,
  submittedBy: null,
  submittedAt: null,
};

const EMPTY_MAINTENANCE: MaintenanceCheck = {
  deployable: null,
  reason: null,
  submittedBy: null,
  submittedAt: null,
};

function defaultSap(status: StatusCode, eq: number): SapData {
  if (["S16", "S17", "S18", "S19"].includes(status)) {
    const soStart =
      status === "S16"
        ? "2026-04-01"
        : status === "S17"
          ? "2026-05-01"
          : status === "S18"
            ? "2026-06-01"
            : "2026-07-01";
    return {
      currentStatus: status === "S18" || status === "S19" ? "Sold" : "On rent",
      soNumber: status === "S19" ? `SCRAP-SO-26-${eq}` : `SO-26-${eq}`,
      soStart,
      soEnd: PAST_SO_END,
      assetTransferNo: status === "S16" ? `AT-26-${eq}` : null,
    };
  }
  // Open cranes either have no SO, or one whose end date is still in the future.
  if (eq % 2 === 0) {
    return {
      currentStatus: "On rent",
      soNumber: `SO-27-${eq}`,
      soStart: "2026-10-01",
      soEnd: FUTURE_SO_END,
      assetTransferNo: null,
    };
  }
  return {
    currentStatus: "Idle",
    soNumber: null,
    soStart: null,
    soEnd: null,
    assetTransferNo: null,
  };
}

function approval(
  eq: number,
  n: number,
  entry: Omit<ApprovalEntry, "id">,
): ApprovalEntry {
  return { id: `cr-${eq}-APP-${n}`, ...entry };
}

function audit(
  eq: number,
  n: number,
  entry: Omit<AuditEntry, "id">,
): AuditEntry {
  return { id: `cr-${eq}-AUD-${n}`, ...entry };
}

interface Seed {
  eq: number;
  desc: string;
  yom: number;
  yieldPct: number;
  utilisationPct: number;
  status: StatusCode;
  cycleId: string;
  /** Only nrg / nonDeployable are supplied; oldFleet is always derived from YOM. */
  flags?: Partial<Flags>;
  /** An alternative decision with a written reason; original flags stay visible. */
  override?: Crane["finalOverride"];
  /** Explicit rich data layered on top of the status-derived defaults. */
  extra?: Partial<Crane>;
  approvals?: ApprovalEntry[];
  auditExtra?: AuditEntry[];
}

function makeCrane(seed: Seed): Crane {
  const id = `cr-${seed.eq}`;
  const age = EVAL_YEAR - seed.yom;
  const oldFleet = age >= 15;
  const flags: Flags = {
    oldFleet,
    nrg: seed.flags?.nrg ?? false,
    nonDeployable: seed.flags?.nonDeployable ?? false,
  };
  const result = dedupe(flags);
  const pastS01 = order(seed.status) > 1;

  const sales: SalesCheck = pastS01
    ? {
        marketable: flags.nonDeployable ? "Not marketable" : "Marketable",
        nrg: flags.nrg,
        expectedMonths: flags.nrg ? 18 : 12,
        remarks: flags.nonDeployable
          ? "Structural defect found; not marketable for rental."
          : flags.nrg
            ? "Idle locally; good demand from international BUs."
            : "Steady domestic demand for this class.",
        submittedBy: "Rohan Deshpande",
        submittedAt: "2026-10-06T11:00:00Z",
      }
    : EMPTY_SALES;

  const maintenance: MaintenanceCheck = pastS01
    ? {
        deployable: !flags.nonDeployable,
        reason: flags.nonDeployable
          ? "Boom inspection failed; lifting certificate not renewed."
          : null,
        submittedBy: "Anil Pawar",
        submittedAt: "2026-10-06T14:00:00Z",
      }
    : EMPTY_MAINTENANCE;

  const hasBuQuotes = ["S05", "S06", "S07"].includes(seed.status);
  const hasAward = ["S06", "S07", "S16"].includes(seed.status);
  const hasCatalogue = order(seed.status) >= 8;
  const hasSaleQuotes = ["S09", "S10", "S14"].includes(seed.status);
  const hasClaimBack = ["S13", "S15"].includes(seed.status);
  const hasConflict = seed.status === "S14";

  const base: Crane = {
    id,
    equipmentId: `EQ-${seed.eq}`,
    description: seed.desc,
    yom: seed.yom,
    yieldPct: seed.yieldPct,
    utilisationPct: seed.utilisationPct,
    age,
    oldFleet,
    cycleId: seed.cycleId,
    status: seed.status,
    flags,
    finalCategory: result.category,
    finalOverride: seed.override ?? null,
    sap: defaultSap(seed.status, seed.eq),
    sales,
    maintenance,
    buQuotes: hasBuQuotes
      ? [
          {
            bu: "Middle East",
            interested: true,
            ratePerMonth: 1_850_000,
            durationMonths: 12,
            expectedYieldPct: 3.2,
            earliestStart: "2027-04-15",
            customer: "ADNOC",
            country: "UAE",
            revisedAt: "2026-10-20T10:00:00Z",
          },
          {
            bu: "South East Asia",
            interested: true,
            ratePerMonth: 1_720_000,
            durationMonths: 9,
            expectedYieldPct: 2.9,
            earliestStart: "2027-05-01",
            customer: "Petronas",
            country: "Malaysia",
            revisedAt: "2026-10-21T10:00:00Z",
          },
        ]
      : [],
    award: hasAward
      ? {
          bu: "Middle East",
          reason: "Highest indicative yield and earliest deployment slot.",
          decidedBy: "Vikram Shetty",
          decidedAt: "2026-10-22T12:00:00Z",
          approvedBy: seed.status === "S06" ? null : "Strategy Head",
          approvedAt: seed.status === "S06" ? null : "2026-10-23T09:00:00Z",
        }
      : null,
    catalogue: hasCatalogue
      ? {
          uploaded: true,
          files: [`EQ-${seed.eq}-datasheet.pdf`, `EQ-${seed.eq}-site-photos.zip`],
          uploadedBy: "Meera Iyer",
          at: "2026-10-25T10:00:00Z",
        }
      : { uploaded: false, files: [], uploadedBy: null, at: null },
    saleQuotes: hasSaleQuotes
      ? [
          {
            buyer: "Larsen & Toubro",
            market: "Domestic",
            value: 42_000_000,
            date: "2026-10-28",
            fpnaValidated: true,
            validatedBy: "Priya Nair",
          },
          {
            buyer: "Al-Farouk Trading",
            market: "International",
            value: 39_500_000,
            date: "2026-10-27",
            fpnaValidated: true,
            validatedBy: "Priya Nair",
          },
        ]
      : [],
    claimBack: hasClaimBack
      ? {
          team: "Domestic Sales",
          customer: "Reliance Infrastructure",
          rate: 1_950_000,
          durationMonths: 8,
          expectedSoDate: "2027-04-30",
          reason: "Firm rental enquiry for the Surat metro package.",
          status: seed.status === "S13" ? "PENDING" : "APPROVED",
          createdBy: "Rohan Deshpande",
          createdAt: "2026-11-01T10:00:00Z",
          decidedBy: seed.status === "S13" ? null : "CBO",
          decidedAt: seed.status === "S13" ? null : "2026-11-08T12:00:00Z",
        }
      : null,
    conflict: hasConflict
      ? {
          ruleId: "SALE_VS_DOMESTIC",
          title: "Sale quotation vs domestic rental",
          decidedBy: "CBO",
          status: "OPEN",
          winner: null,
          reason: null,
          decidedByUser: null,
          decidedAt: null,
        }
      : null,
    approvals: seed.approvals ?? [],
    audit: [
      audit(seed.eq, 1, {
        actor: "Priya Nair",
        actorRole: "FPNA",
        action: "CRANE_IMPORTED",
        detail: `Uploaded ${seed.desc} (YOM ${seed.yom}). Dedup route: ${result.route}.`,
        at: importAt(seed.cycleId),
      }),
      ...(seed.auditExtra ?? []),
    ],
  };

  return { ...base, ...(seed.extra ?? {}) };
}

const SEEDS: Seed[] = [
  /* ---------------- Open cycle — C02 ---------------- */
  {
    eq: 1001,
    desc: "160 MT Crawler Lattice Boom Crane",
    yom: 2005,
    yieldPct: 2.8,
    utilisationPct: 62,
    status: "S01",
    cycleId: C02,
  },
  {
    eq: 1002,
    desc: "80 MT Hydraulic Mobile Crane",
    yom: 2014,
    yieldPct: 1.6,
    utilisationPct: 38,
    status: "S01",
    cycleId: C02,
    flags: { nonDeployable: true },
  },
  {
    eq: 1003,
    desc: "250 MT Crawler Lattice Boom Crane",
    yom: 2008,
    yieldPct: 2.1,
    utilisationPct: 44,
    status: "S02",
    cycleId: C02,
    flags: { nrg: true },
    auditExtra: [
      audit(1003, 2, {
        actor: "Neha Kulkarni",
        actorRole: "SALES",
        action: "SALES_CHECK_SUBMITTED",
        detail: "Flagged NRG: only 44% utilisation over the last three years.",
        at: "2026-10-07T09:20:00Z",
      }),
    ],
  },
  {
    eq: 1004,
    desc: "300 MT All Terrain Crane",
    yom: 2016,
    yieldPct: 1.4,
    utilisationPct: 35,
    status: "S02",
    cycleId: C02,
    flags: { nrg: true },
  },
  {
    eq: 1005,
    desc: "100 MT Hydraulic Mobile Crane",
    yom: 2023,
    yieldPct: 4.5,
    utilisationPct: 88,
    status: "S03",
    cycleId: C02,
    auditExtra: [
      audit(1005, 2, {
        actor: "Finance Desk",
        actorRole: "FINANCE",
        action: "EXCLUDED_FROM_FIRM",
        detail: "No flag after dedup; crane stays in the active fleet.",
        at: "2026-10-09T10:00:00Z",
      }),
    ],
  },
  {
    eq: 1006,
    desc: "750 MT Lattice Boom Crawler Crane",
    yom: 2003,
    yieldPct: 2.6,
    utilisationPct: 57,
    status: "S04",
    cycleId: C02,
  },
  {
    eq: 1007,
    desc: "220 MT Crawler Lattice Boom Crane",
    yom: 2011,
    yieldPct: 2.4,
    utilisationPct: 53,
    status: "S04",
    cycleId: C02,
    auditExtra: [
      audit(1007, 2, {
        actor: "Vikram Shetty",
        actorRole: "STRATEGY",
        action: "FLOATED_TO_BUS",
        detail: "Old fleet crane circulated to all international BUs.",
        at: "2026-10-14T10:30:00Z",
      }),
    ],
  },
  {
    eq: 1008,
    desc: "400 MT Lattice Boom Crawler Crane",
    yom: 2007,
    yieldPct: 3.1,
    utilisationPct: 66,
    status: "S05",
    cycleId: C02,
    override: {
      category: "NON_DEPLOYABLE",
      reason:
        "Boom crack found at site inspection; rerouted from international rental to sale while flags remain Old Fleet.",
      by: "Neha Kulkarni",
      at: "2026-10-19T11:45:00Z",
    },
  },
  {
    eq: 1009,
    desc: "150 MT All Terrain Crane",
    yom: 2018,
    yieldPct: 1.9,
    utilisationPct: 41,
    status: "S05",
    cycleId: C02,
    flags: { nrg: true },
  },
  {
    eq: 1010,
    desc: "600 MT Crawler Lattice Boom Crane",
    yom: 2002,
    yieldPct: 2.7,
    utilisationPct: 59,
    status: "S06",
    cycleId: C02,
    approvals: [
      approval(1010, 1, {
        decision: "Final FIRM list after deduplication",
        approverRole: "FINANCE",
        approverName: "Finance Head",
        action: "APPROVED",
        comment: "Old Fleet classification reconciled with the asset register.",
        at: "2026-10-12T10:00:00Z",
      }),
    ],
  },
  {
    eq: 1011,
    desc: "250 MT Crawler Lattice Boom Crane",
    yom: 2006,
    yieldPct: 3.3,
    utilisationPct: 71,
    status: "S07",
    cycleId: C02,
    approvals: [
      approval(1011, 1, {
        decision: "Award crane to a BU for international rental",
        approverRole: "STRATEGY",
        approverName: "Strategy Head",
        action: "APPROVED",
        comment: "Middle East quote accepted; 12-month deployment at ADNOC.",
        at: "2026-10-23T09:00:00Z",
      }),
    ],
  },
  {
    eq: 1012,
    desc: "100 MT Hydraulic Mobile Crane",
    yom: 2013,
    yieldPct: 1.2,
    utilisationPct: 30,
    status: "S08",
    cycleId: C02,
    flags: { nonDeployable: true },
  },
  {
    eq: 1013,
    desc: "350 MT Crawler Lattice Boom Crane",
    yom: 2010,
    yieldPct: 2.2,
    utilisationPct: 49,
    status: "S08",
    cycleId: C02,
  },
  {
    eq: 1014,
    desc: "500 MT Lattice Boom Crawler Crane",
    yom: 2004,
    yieldPct: 2.9,
    utilisationPct: 63,
    status: "S09",
    cycleId: C02,
  },
  {
    eq: 1015,
    desc: "200 MT All Terrain Crane",
    yom: 2009,
    yieldPct: 3.0,
    utilisationPct: 67,
    status: "S10",
    cycleId: C02,
    override: {
      category: "NOT_IN_FIRM",
      reason:
        "Five-year rental renewal with ONGC signed after upload; crane retained in the active fleet instead of sale.",
      by: "Prajwal Kumar",
      at: "2026-11-04T15:10:00Z",
    },
    approvals: [
      approval(1015, 1, {
        decision: "Sale price validation",
        approverRole: "FPNA",
        approverName: "Priya Nair",
        action: "APPROVED",
        comment: "Domestic quote of ₹4.2 Cr validated against the last three tenders.",
        at: "2026-10-29T10:00:00Z",
      }),
    ],
  },
  {
    eq: 1016,
    desc: "1,200 MT Crawler Lattice Boom Crane",
    yom: 1998,
    yieldPct: 1.5,
    utilisationPct: 34,
    status: "S11",
    cycleId: C02,
    flags: { nonDeployable: true },
    approvals: [
      approval(1016, 1, {
        decision: "Approve scrap sale",
        approverRole: "MD",
        approverName: "Rishi Sanghvi",
        action: "APPROVED",
        comment: "No acceptable buyer in the sale window; scrap value accepted.",
        at: "2026-11-03T12:00:00Z",
      }),
    ],
  },
  {
    eq: 1017,
    desc: "80 MT Hydraulic Mobile Crane",
    yom: 2001,
    yieldPct: 1.8,
    utilisationPct: 40,
    status: "S12",
    cycleId: C02,
  },
  {
    eq: 1018,
    desc: "180 MT Crawler Lattice Boom Crane",
    yom: 2015,
    yieldPct: 1.7,
    utilisationPct: 39,
    status: "S13",
    cycleId: C02,
    flags: { nrg: true },
    approvals: [
      approval(1018, 1, {
        decision: "Approve claim-back",
        approverRole: "CBO",
        approverName: "Prajwal Kumar",
        action: "APPROVED",
        comment: "Rental opportunity details verified; claim-back permitted.",
        at: "2026-11-09T10:00:00Z",
      }),
    ],
  },
  {
    eq: 1019,
    desc: "300 MT Crawler Lattice Boom Crane",
    yom: 2005,
    yieldPct: 3.4,
    utilisationPct: 72,
    status: "S14",
    cycleId: C02,
    extra: {
      conflict: {
        ruleId: "SALE_VS_DOMESTIC",
        title: "Sale quotation vs domestic rental",
        decidedBy: "CBO",
        status: "RESOLVED",
        winner: "Domestic rental",
        reason:
          "Domestic rental yields 22% more than the validated sale price; sale halted and buyer informed.",
        decidedByUser: "Prajwal Kumar",
        decidedAt: "2026-11-10T12:00:00Z",
      },
    },
    approvals: [
      approval(1019, 1, {
        decision: "Exception: domestic rental over a sale quotation",
        approverRole: "CBO",
        approverName: "Prajwal Kumar",
        action: "APPROVED",
        comment: "Rental wins; Sales to create the SO within 15 days.",
        at: "2026-11-10T12:05:00Z",
      }),
    ],
    auditExtra: [
      audit(1019, 2, {
        actor: "Prajwal Kumar",
        actorRole: "CBO",
        action: "CONFLICT_RESOLVED",
        detail: "Sale quotation vs domestic rental — decided in favour of domestic rental.",
        at: "2026-11-10T12:05:00Z",
      }),
    ],
  },
  {
    eq: 1020,
    desc: "250 MT All Terrain Crane",
    yom: 2007,
    yieldPct: 3.6,
    utilisationPct: 75,
    status: "S14",
    cycleId: C02,
    extra: {
      conflict: {
        ruleId: "SALE_VS_INTERNATIONAL",
        title: "Sale quotation vs international rental",
        decidedBy: "CSO",
        status: "OPEN",
        winner: null,
        reason: null,
        decidedByUser: null,
        decidedAt: null,
      },
    },
    auditExtra: [
      audit(1020, 2, {
        actor: "Vikram Shetty",
        actorRole: "STRATEGY",
        action: "CONFLICT_RAISED",
        detail: "International BU offer competes with an approved sale quotation; awaiting CSO.",
        at: "2026-11-11T08:45:00Z",
      }),
    ],
  },
  {
    eq: 1021,
    desc: "150 MT Crawler Lattice Boom Crane",
    yom: 2017,
    yieldPct: 1.3,
    utilisationPct: 32,
    status: "S15",
    cycleId: C02,
    flags: { nrg: true },
  },
  {
    eq: 1022,
    desc: "650 MT Lattice Boom Crawler Crane",
    yom: 2000,
    yieldPct: 1.2,
    utilisationPct: 31,
    status: "S20",
    cycleId: C02,
    approvals: [
      approval(1022, 1, {
        decision: "Approve scrap sale",
        approverRole: "MD",
        approverName: "Rishi Sanghvi",
        action: "REJECTED",
        comment: "Still deployable for heavy lifts; return to the next cycle instead of scrap.",
        at: "2026-11-12T16:00:00Z",
      }),
    ],
  },

  /* ---------------- Closed cycle — C01 (locked outcomes) ---------------- */
  {
    eq: 1023,
    desc: "750 MT Lattice Boom Crawler Crane",
    yom: 1999,
    yieldPct: 2.5,
    utilisationPct: 55,
    status: "S16",
    cycleId: C01,
    approvals: [
      approval(1023, 1, {
        decision: "Award crane to a BU for international rental",
        approverRole: "STRATEGY",
        approverName: "Strategy Head",
        action: "APPROVED",
        comment: "Transferred to Middle East BU; asset transfer document recorded.",
        at: "2026-08-20T10:00:00Z",
      }),
    ],
  },
  {
    eq: 1024,
    desc: "400 MT Crawler Lattice Boom Crane",
    yom: 2014,
    yieldPct: 2.0,
    utilisationPct: 43,
    status: "S17",
    cycleId: C01,
    flags: { nrg: true },
  },
  {
    eq: 1025,
    desc: "250 MT Crawler Lattice Boom Crane",
    yom: 2008,
    yieldPct: 2.7,
    utilisationPct: 61,
    status: "S18",
    cycleId: C01,
    approvals: [
      approval(1025, 1, {
        decision: "Sale",
        approverRole: "CBO",
        approverName: "Prajwal Kumar",
        action: "APPROVED",
        comment: "Sale to Larsen & Toubro completed in SAP.",
        at: "2026-08-25T12:00:00Z",
      }),
    ],
  },
  {
    eq: 1026,
    desc: "350 MT Crawler Lattice Boom Crane",
    yom: 2003,
    yieldPct: 1.4,
    utilisationPct: 36,
    status: "S19",
    cycleId: C01,
    flags: { nonDeployable: true },
    approvals: [
      approval(1026, 1, {
        decision: "Scrap sale",
        approverRole: "MD",
        approverName: "Rishi Sanghvi",
        action: "APPROVED",
        comment: "Scrap sale SO raised; crane removed from the active register.",
        at: "2026-08-28T12:00:00Z",
      }),
    ],
  },
];

export function buildFixtures(): { cycles: Cycle[]; cranes: Crane[] } {
  return {
    cycles: structuredClone(CYCLES),
    cranes: SEEDS.map(makeCrane),
  };
}
