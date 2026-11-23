import "server-only";

import { getState } from "./store";
import {
  STATUS_MAP, claimApprovers, conflictApprovers,
  type StatusCode,
} from "./workflow";
import type {
  ApprovalItem,
  Crane,
  CraneFilters,
  CraneListResult,
  Cycle,
  DashboardData,
  FirmUser,
} from "./types";

export type {
  ApprovalItem,
  Crane,
  CraneFilters,
  CraneListResult,
  Cycle,
  DashboardData,
  FirmUser,
} from "./types";

export async function getCycles(): Promise<Cycle[]> {
  const state = await getState();
  return [...state.cycles].sort((a, b) => b.openedAt.localeCompare(a.openedAt));
}

export async function getCurrentCycle(): Promise<Cycle | null> {
  const cycles = await getCycles();
  return cycles.find((cycle) => cycle.status === "OPEN") ?? cycles[0] ?? null;
}

/** Roles that only work on cranes routed to them after Finance deduplication. */
const SALE_STATUSES = ["S08", "S09", "S10", "S11", "S12", "S18", "S19", "S20"];
/** Cranes that have reached SCM after the Marketing catalogue window closed. */
const SCM_STATUSES = ["S09", "S10", "S11", "S12", "S18", "S19", "S20"];
/**
 * Strategy's international-rental bin. It keeps visibility of its Old Fleet/NRG
 * cranes after they enter the catalogue/sale route (S08 → S09 → S10) so Strategy
 * can raise the international claim-back, and while the CSO decides the
 * resulting conflict (S14). Non-Strategy categories are still filtered out below.
 */
const STRATEGY_STATUSES = [
  "S04", "S05", "S06", "S07",
  "S08", "S09", "S10",
  "S13", "S14", "S16",
];
const INTERNATIONAL_CATEGORIES = ["OLD_FLEET", "NRG"];

export function roleAllowsCrane(
  role: string | undefined,
  crane: Crane,
  buCode?: string | null,
): boolean {
  if (!role) return true;
  if (role === "STRATEGY") {
    return INTERNATIONAL_CATEGORIES.includes(crane.finalCategory ?? "") &&
      STRATEGY_STATUSES.includes(crane.status);
  }
  if (role === "BU") {
    if (!["S04", "S05"].includes(crane.status)) return false;
    const invited = crane.invitedBus ?? [];
    // Legacy cranes with no selection stay open to every BU. A BU login only
    // sees cranes floated to it; the generic BU account has no code and keeps
    // the all-BUs view used by administration.
    if (invited.length === 0 || !buCode) return true;
    return invited.includes(buCode);
  }
  if (role === "MARKETING") {
    // Marketing only handles cranes inside the catalogue/sale window, never fleet still at L1.
    return SALE_STATUSES.includes(crane.status) &&
      (crane.finalCategory === "NON_DEPLOYABLE" ||
        INTERNATIONAL_CATEGORIES.includes(crane.finalCategory ?? ""));
  }
  if (role === "SCM") {
    // SCM also follows a sale that lost a rental conflict — domestic at S15 or
    // international at S07 — so it can tell the buyer and revive the held
    // quotation if the winning rental misses its 15-day deadline.
    if (crane.status === "S15") return crane.saleQuotes.length > 0;
    if (crane.status === "S07") {
      return crane.conflict?.ruleId === "SALE_VS_INTERNATIONAL" && crane.saleQuotes.length > 0;
    }
    return SCM_STATUSES.includes(crane.status);
  }
  if (role === "CSO") {
    // CSO signs off low-yield awards, international claim-backs and CSO-owned conflicts.
    if (crane.status === "S06") {
      const awarded = crane.buQuotes.find((quote) => quote.bu === crane.award?.bu);
      const lowYield = crane.award?.csoRequired ??
        (!!awarded?.expectedYieldPct && crane.yieldPct > 0 && awarded.expectedYieldPct < crane.yieldPct);
      return lowYield;
    }
    if (crane.status === "S13") return claimApprovers(crane.claimBack?.team).includes("CSO");
    if (crane.status === "S14") return conflictApprovers(crane.conflict?.ruleId).includes("CSO");
    return false;
  }
  if (role === "CBO") {
    // CBO decides claim-backs and domestic conflicts; sale approval belongs to MD.
    if (crane.status === "S13") return claimApprovers(crane.claimBack?.team).includes("CBO");
    if (crane.status === "S14") return conflictApprovers(crane.conflict?.ruleId).includes("CBO");
    return false;
  }
  return true;
}

export async function getCranes(filters: CraneFilters = {}): Promise<CraneListResult> {
  const state = await getState();
  const q = filters.q?.trim().toLowerCase();
  const rows = state.cranes.filter((crane) => {
    if (!roleAllowsCrane(filters.role, crane, filters.buCode)) return false;
    if (q && !`${crane.equipmentId} ${crane.description} ${crane.finalCategory ?? ""}`
      .toLowerCase().includes(q)) return false;
    if (filters.status && filters.status !== "ALL" && crane.status !== filters.status) return false;
    if (filters.layer && filters.layer !== "ALL" && STATUS_MAP[crane.status].layer !== filters.layer) return false;
    if (filters.category && filters.category !== "ALL" && crane.finalCategory !== filters.category) return false;
    if (filters.type && filters.type !== "ALL" && STATUS_MAP[crane.status].type !== filters.type) return false;
    if (filters.cycleId && crane.cycleId !== filters.cycleId) return false;
    return true;
  }).sort((a, b) => a.equipmentId.localeCompare(b.equipmentId));

  const byStatus: { code: StatusCode; count: number }[] = Object.keys(STATUS_MAP)
    .map((code) => ({ code: code as StatusCode, count: rows.filter((r) => r.status === code).length }))
    .filter((entry) => entry.count > 0);

  const byCategory = (["OLD_FLEET", "NRG", "NON_DEPLOYABLE", "NOT_IN_FIRM"] as const)
    .map((category) => ({ category, count: rows.filter((r) => r.finalCategory === category).length }))
    .filter((entry) => entry.count > 0);

  return {
    rows,
    total: rows.length,
    byStatus,
    byCategory,
    counts: {
      all: rows.length,
      active: rows.filter((r) => STATUS_MAP[r.status].type === "Active").length,
      approval: rows.filter((r) => STATUS_MAP[r.status].type === "Approval").length,
      conflict: rows.filter((r) => r.status === "S14").length,
      locked: rows.filter((r) => STATUS_MAP[r.status].type === "Locked").length,
      closed: rows.filter((r) => STATUS_MAP[r.status].type === "Closed").length,
    },
  };
}

export async function getCrane(id: string): Promise<Crane | null> {
  const state = await getState();
  return state.cranes.find((crane) => crane.id === id || crane.equipmentId === id) ?? null;
}

export async function getDashboard(): Promise<DashboardData> {
  const state = await getState();
  const cycle = state.cycles.find((entry) => entry.status === "OPEN") ?? state.cycles[0] ?? null;
  const cranes = state.cranes;
  const byStatus = (Object.keys(STATUS_MAP) as StatusCode[])
    .map((code) => ({ code, count: cranes.filter((crane) => crane.status === code).length }))
    .filter((entry) => entry.count > 0);
  const layerMap = new Map<string, number>();
  for (const crane of cranes) {
    const layer = STATUS_MAP[crane.status].layer;
    layerMap.set(layer, (layerMap.get(layer) ?? 0) + 1);
  }
  const reminders = cranes
    .filter((crane) => ["S01", "S06", "S10", "S11", "S13", "S14"].includes(crane.status))
    .slice(0, 8)
    .map((crane) => ({
      crane,
      reason: STATUS_MAP[crane.status].hint,
      sinceDays: 1 + (crane.id.charCodeAt(crane.id.length - 1) % 5),
    }));

  return {
    cycle,
    cranes,
    total: cranes.length,
    byStatus,
    byLayer: [...layerMap.entries()].map(([layer, count]) => ({ layer, count })).sort(),
    approvals: cranes.filter((crane) => STATUS_MAP[crane.status].type === "Approval").length,
    conflicts: cranes.filter((crane) => crane.status === "S14").length,
    locked: cranes.filter((crane) => STATUS_MAP[crane.status].type === "Locked").length,
    reminders,
  };
}

/** Approvals currently waiting on a given role. */
export async function getApprovalQueue(role: string): Promise<ApprovalItem[]> {
  const state = await getState();
  const admin = "GLOBAL_ADMIN";
  const roleMap: Partial<Record<string, { roles: string[]; decision: string; note: string }>> = {
    S01: { roles: ["SALES", "MAINTENANCE", admin], decision: "Submit parallel check", note: "Sales and Maintenance review the full fleet side by side" },
    S02: { roles: ["FINANCE", admin], decision: "Finalise FIRM list after deduplication", note: "Finance Head sign-off required" },
    S06: { roles: ["CSO", admin], decision: "Decide Strategy's BU award request", note: "Only the CSO decides; Strategy's award decision is already recorded" },
    S07: { roles: ["STRATEGY", admin], decision: "Record international transfer", note: "Deployment waits for the current SO to end" },
    S10: { roles: ["MD", admin], decision: "Approve sale", note: "FP&A has validated the price" },
    S11: { roles: ["MD", admin], decision: "Approve scrap sale", note: "No acceptable buyer in the sale window" },
    S13: { roles: ["CBO", "CSO", "SALES", "STRATEGY", admin], decision: "Approve claim-back", note: "Real opportunity details required" },
    S14: { roles: ["CBO", "CSO", "STRATEGY", "MD", admin], decision: "Resolve conflict", note: "Decision due within 3 working days" },
  };
  return state.cranes
    .map((crane) => {
      const rule = roleMap[crane.status];
      if (!rule) return null;
      const approvers = crane.status === "S14"
        ? conflictApprovers(crane.conflict?.ruleId)
        : rule.roles;
      if (!approvers.includes(role)) return null;
      // The MD only steps in as the CEO tie-break after CBO and CSO disagree.
      if (crane.status === "S14" && role === "MD" &&
          crane.conflict?.ruleId === "DOMESTIC_VS_BU" && !crane.conflict.escalatedToMd) {
        return null;
      }
      if (!roleAllowsCrane(role, crane)) return null;
      if (crane.status === "S10") {
        const quote = crane.saleQuotes[crane.selectedSaleQuoteIndex ?? -1];
        if (!quote?.fpnaValidated) return null;
      }
      return {
        crane,
        decision: rule.decision,
        approverRole: role as ApprovalItem["approverRole"],
        note: rule.note,
      };
    })
    .filter((item): item is ApprovalItem => item !== null);
}

/** Users are seeded into the DB; auth continues to use those rows. */
export async function getUsers(): Promise<FirmUser[]> {
  const { getDb } = await import("@/db");
  const { asc } = await import("drizzle-orm");
  const { users } = await import("@/db/schema");
  const db = await getDb();
  return db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      role: users.role,
      designation: users.designation,
    })
    .from(users)
    .orderBy(asc(users.name)) as Promise<FirmUser[]>;
}
