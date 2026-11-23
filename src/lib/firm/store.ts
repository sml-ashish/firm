import "server-only";

import * as fs from "node:fs/promises";
import path from "node:path";

import { buildFixtures } from "./fixtures";
import { isNrg } from "./workflow";
import type { Crane, Cycle } from "./types";

export interface FirmState {
  cycles: Cycle[];
  cranes: Crane[];
}

const DATA_DIR = path.join(process.cwd(), ".data");
const DATA_FILE = path.join(DATA_DIR, "firm-workflow.json");
const TMP_FILE = path.join(DATA_DIR, "firm-workflow.json.tmp");

/** Parsed JSON kept in memory after the first successful read. */
let cache: FirmState | null = null;

/** Module-level chain: every read/mutation is queued behind the previous one. */
let chain: Promise<void> = Promise.resolve();

function enqueue<T>(task: () => Promise<T>): Promise<T> {
  const run = chain.then(task, task);
  chain = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

function clone(state: FirmState): FirmState {
  return structuredClone(state);
}

async function writeFileAtomic(state: FirmState): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(TMP_FILE, JSON.stringify(state, null, 2), "utf8");
  await fs.rename(TMP_FILE, DATA_FILE);
}

async function load(): Promise<FirmState> {
  if (cache) return cache;

  let state: FirmState;
  try {
    const raw = await fs.readFile(DATA_FILE, "utf8");
    const parsed = JSON.parse(raw) as FirmState;
    if (!parsed || !Array.isArray(parsed.cycles) || !Array.isArray(parsed.cranes)) {
      throw new Error("Invalid FIRM state file");
    }
    state = parsed;
  } catch {
    // Missing or corrupt file — start from an empty workflow.
    state = buildFixtures();
    await writeFileAtomic(state);
  }

  // Apply the system NRG/RG rule (utilisation < 60% and yield < 1.8%) to cranes
  // that were uploaded before the rule existed, so existing data is consistent.
  let nrgChanged = false;
  for (const crane of state.cranes) {
    const expected = isNrg(crane.yieldPct, crane.utilisationPct);
    if (crane.flags.nrg === expected && crane.sales.nrg === expected) continue;
    const previous = crane.flags.nrg ? "NRG" : "RG";
    crane.flags.nrg = expected;
    crane.sales.nrg = expected;
    crane.audit.unshift({
      id: `nrg-backfill-${crane.id}`,
      actor: "System",
      actorRole: "GLOBAL_ADMIN",
      action: "NRG / RG classification applied",
      detail: `${crane.equipmentId} · utilisation ${crane.utilisationPct}%, yield ${crane.yieldPct}% · ${previous} → ${expected ? "NRG" : "RG"}`,
      at: new Date().toISOString(),
    });
    nrgChanged = true;
  }
  // Older awards predate the explicit Strategy sign-off field. Strategy's recorded
  // award decision is that sign-off; only the CSO decision remains at S06.
  let awardChanged = false;
  for (const crane of state.cranes) {
    const award = crane.award;
    if (!award) continue;
    if (!award.strategyHeadApprovedBy && award.decidedBy) {
      award.strategyHeadApprovedBy = award.decidedBy;
      award.strategyHeadApprovedAt = award.decidedAt ?? new Date().toISOString();
      awardChanged = true;
    }
    if (crane.status === "S06" && award.csoApprovedBy && !award.approvedBy) {
      award.approvedBy = award.csoApprovedBy;
      award.approvedAt = award.csoApprovedAt ?? new Date().toISOString();
      crane.status = "S07";
      awardChanged = true;
    }
    // Older single-button awards were recorded as "approval pending" even though
    // Strategy had already made the award. Treat those as direct final awards.
    const legacyDirectAward = crane.status === "S06" && !award.csoApprovedBy
      && crane.audit.some((entry) => entry.action === "BU awarded — approval pending");
    if (legacyDirectAward) {
      award.csoRequired = false;
      award.approvedBy = award.strategyHeadApprovedBy ?? award.decidedBy ?? "Strategy Team";
      award.approvedAt = award.strategyHeadApprovedAt ?? award.decidedAt ?? new Date().toISOString();
      crane.status = "S07";
      crane.audit.unshift({
        id: `award-direct-backfill-${crane.id}`,
        actor: "System",
        actorRole: "GLOBAL_ADMIN",
        action: "Legacy Strategy award finalised directly",
        detail: `${crane.equipmentId} · ${award.bu} · Strategy award moved to reserved (S07)`,
        at: new Date().toISOString(),
      });
      awardChanged = true;
    }
  }
  // Section 6.1: a rental that wins a sale conflict has 15 days to complete its
  // side of the deal. If the clock runs out, the crane reopens at S09 with the
  // held quotation ready to revive (FP&A must check the price again).
  let windowChanged = false;
  const today = new Date().toISOString().slice(0, 10);
  for (const crane of state.cranes) {
    const domestic = crane.status === "S15" && crane.conflict?.ruleId === "SALE_VS_DOMESTIC";
    const international = crane.status === "S07" && crane.conflict?.ruleId === "SALE_VS_INTERNATIONAL";
    if (!domestic && !international) continue;
    const due = domestic ? crane.claimBack?.rentalSoDueAt : crane.claimBack?.reservationDueAt;
    if (!due || due > today) continue;
    const index = crane.selectedSaleQuoteIndex ?? -1;
    const quote = crane.saleQuotes[index];
    if (quote) {
      quote.fpnaValidated = false;
      quote.validatedBy = null;
      quote.validatedAt = null;
    }
    if (crane.claimBack?.status === "APPROVED") crane.claimBack.status = "EXPIRED";
    crane.status = "S09";
    if (domestic) crane.claimBack!.rentalSoDueAt = null;
    else crane.claimBack!.reservationDueAt = null;
    crane.audit.unshift({
      id: `rental-window-expired-${crane.id}-${due}`,
      actor: "System",
      actorRole: "GLOBAL_ADMIN",
      action: international
        ? "BU reservation window expired — sale window reopened"
        : "Rental SO window expired — sale window reopened",
      detail: international
        ? `${crane.equipmentId} · not reserved/deployed by ${due} · back to S09 · ${quote ? `${quote.buyer} quotation held for revival` : "attach a fresh quotation"}`
        : `${crane.equipmentId} · no rental SO by ${due} · back to S09 · ${quote ? `${quote.buyer} quotation held for revival` : "attach a fresh quotation"}`,
      at: new Date().toISOString(),
    });
    windowChanged = true;
  }
  if (nrgChanged || awardChanged || windowChanged) await writeFileAtomic(state);

  cache = state;
  return state;
}

export async function getState(): Promise<FirmState> {
  return enqueue(async () => clone(await load()));
}

export async function mutate(
  fn: (state: FirmState) => void | Promise<void>,
): Promise<void> {
  return enqueue(async () => {
    const current = await load();
    const draft = clone(current);
    await fn(draft);
    await writeFileAtomic(draft);
    cache = draft;
  });
}

export async function resetState(): Promise<void> {
  return enqueue(async () => {
    const fresh = buildFixtures();
    await writeFileAtomic(fresh);
    cache = fresh;
  });
}
