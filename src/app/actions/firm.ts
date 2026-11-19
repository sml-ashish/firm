"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { mutate } from "@/lib/firm/store";
import { saveCatalogueAttachments } from "@/lib/firm/uploads";
import { parseFirmWorkbook } from "@/lib/firm/intake";
import {
  CATEGORY_LABEL, CONFLICT_RULES, STATUS_MAP,
  claimApprovers, claimConflictRule, claimTargetStatus,
  conflictApprovers, conflictOutcomeStatus, dedupe, routeForCategory,
  type FinalCategory, type Role,
} from "@/lib/firm/workflow";
import type { BuQuote, Crane } from "@/lib/firm/types";

export type ActionState = { error?: string; ok?: string } | null;

const now = () => new Date().toISOString();
const entryId = (prefix: string) => `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

const ALLOWED: Record<string, Role[]> = {
  SUBMIT_SALES: ["SALES"],
  SUBMIT_MAINTENANCE: ["MAINTENANCE"],
  FINALISE_LIST: ["FINANCE", "GLOBAL_ADMIN"],
  UPLOAD_CATALOGUE: ["MARKETING", "GLOBAL_ADMIN"],
  CLOSE_CATALOGUE_WINDOW: ["MARKETING", "GLOBAL_ADMIN"],
  FLOAT_TO_BUS: ["STRATEGY", "GLOBAL_ADMIN"],
  SUBMIT_BU_QUOTE: ["BU", "STRATEGY", "GLOBAL_ADMIN"],
  AWARD_BU: ["STRATEGY", "GLOBAL_ADMIN"],
  NO_TAKER_TO_SALE: ["STRATEGY", "GLOBAL_ADMIN"],
  APPROVE_AWARD: ["STRATEGY", "CSO", "GLOBAL_ADMIN"],
  REJECT_AWARD: ["STRATEGY", "CSO", "GLOBAL_ADMIN"],
  SUBMIT_SALE_QUOTE: ["SCM", "GLOBAL_ADMIN"],
  SELECT_SALE_QUOTE: ["SCM", "GLOBAL_ADMIN"],
  VALIDATE_SALE_PRICE: ["FPNA", "GLOBAL_ADMIN"],
  APPROVE_SALE: ["CBO", "MD", "GLOBAL_ADMIN"],
  REJECT_SALE: ["CBO", "MD", "GLOBAL_ADMIN"],
  APPROVE_SCRAP: ["MD", "GLOBAL_ADMIN"],
  REJECT_SCRAP: ["MD", "GLOBAL_ADMIN"],
  APPROVE_CLAIM: ["CBO", "CSO", "SALES", "STRATEGY", "GLOBAL_ADMIN"],
  REJECT_CLAIM: ["CBO", "CSO", "SALES", "STRATEGY", "GLOBAL_ADMIN"],
  RESOLVE_CONFLICT: ["CBO", "CSO", "STRATEGY", "MD", "GLOBAL_ADMIN"],
  DEPLOY: ["STRATEGY", "GLOBAL_ADMIN"],
  RECORD_SO: ["SALES", "STRATEGY", "SCM", "GLOBAL_ADMIN"],
  REQUEST_CLAIM_BACK: ["SALES", "STRATEGY"],
  RECORD_RENTAL_SO: ["SALES", "STRATEGY", "GLOBAL_ADMIN"],
  NO_BUYER_TO_SCRAP: ["SCM", "GLOBAL_ADMIN"],
  SUBMIT_SCRAP_QUOTE: ["SCM", "GLOBAL_ADMIN"],
  SELECT_SCRAP_QUOTE: ["SCM", "GLOBAL_ADMIN"],
  VALIDATE_SCRAP_PRICE: ["FPNA", "GLOBAL_ADMIN"],
  RECORD_SCRAP_SO: ["SCM", "GLOBAL_ADMIN"],
};

/** One entry point for every crane action. Role and SAP rules are checked here. */
export async function craneAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const craneId = String(formData.get("craneId") ?? "").trim();
  const kind = String(formData.get("kind") ?? "").trim();
  const comment = String(formData.get("comment") ?? "").trim();
  const decision = String(formData.get("decision") ?? "").trim();

  if (!craneId || !kind) return { error: "Missing crane or action." };
  const allowed = ALLOWED[kind];
  if (!allowed || !allowed.includes(user.role as Role)) {
    return { error: `Your role (${user.role}) cannot perform this action.` };
  }
  const commentRequired = [
    "FINALISE_LIST",
    "APPROVE_AWARD", "REJECT_AWARD",
    "VALIDATE_SALE_PRICE",
    "APPROVE_SALE", "REJECT_SALE",
    "APPROVE_SCRAP", "REJECT_SCRAP",
    "APPROVE_CLAIM", "REJECT_CLAIM",
    "RESOLVE_CONFLICT", "VALIDATE_SCRAP_PRICE",
  ];
  if (commentRequired.includes(kind) && !comment) {
    return { error: "A comment is mandatory for every decision." };
  }

  let message = "Action recorded.";
  await mutate(async (state) => {
    const crane = state.cranes.find((c) => c.id === craneId || c.equipmentId === craneId);
    if (!crane) throw new Error("Crane not found.");
    const cycle = state.cycles.find((c) => c.id === crane.cycleId);
    if (cycle?.status === "CLOSED") throw new Error("This cycle is stopped. No changes are allowed.");
    if (["S16", "S17", "S18", "S19"].includes(crane.status)) {
      throw new Error("This crane is locked in SAP. No further changes are allowed.");
    }
    const at = now();
    const actor = user.name;

    if (kind === "SUBMIT_SALES") {
      if (crane.status !== "S01") throw new Error("Sales checks are only open at S01.");
      crane.sales = {
        marketable: String(formData.get("marketable") ?? "Marketable") as "Marketable" | "Not marketable",
        nrg: crane.sales.nrg,
        expectedMonths: Number(formData.get("expectedMonths") ?? 0) || null,
        remarks: comment || null,
        submittedBy: actor,
        submittedAt: at,
      };
      // NRG/RG is set by the system at upload (utilisation < 60% and yield < 1.8%).
      // Sales cannot change it; the flag is preserved for Finance dedup (§4).
      crane.finalCategory = null;
      crane.finalOverride = null;
      crane.audit.unshift({ id: entryId("a"), actor, actorRole: user.role as Role, action: "Sales check submitted", detail: `${crane.equipmentId} · marketable ${crane.sales.marketable} · NRG/RG ${crane.sales.nrg ? "NRG" : "RG"} (system, from upload)`, at });
      if (crane.maintenance.submittedBy) {
        crane.status = "S02";
        message = "Both checks are in. Crane moved to Finance review (S02).";
      } else {
        message = "Sales check submitted. Waiting for Maintenance check.";
      }
    } else if (kind === "SUBMIT_MAINTENANCE") {
      if (crane.status !== "S01") throw new Error("Maintenance checks are only open at S01.");
      const deployable = String(formData.get("deployable") ?? "true") === "true";
      crane.maintenance = {
        deployable,
        reason: deployable ? null : comment || "No reason supplied",
        submittedBy: actor,
        submittedAt: at,
      };
      crane.flags.nonDeployable = !deployable;
      crane.finalCategory = null;
      crane.finalOverride = null;
      crane.audit.unshift({ id: entryId("a"), actor, actorRole: user.role as Role, action: "Maintenance check submitted", detail: `${crane.equipmentId} · ${deployable ? "Deployable" : "Non-Deployable"}`, at });
      if (crane.sales.submittedBy) {
        crane.status = "S02";
        message = "Both checks are in. Crane moved to Finance review (S02).";
      } else {
        message = "Maintenance check submitted. Waiting for Sales check.";
      }
    } else if (kind === "FINALISE_LIST") {
      if (crane.status !== "S02") throw new Error("This crane is not under Finance review.");
      const overrideCategory = String(formData.get("finalOverrideCategory") ?? "").trim() as FinalCategory | "";
      if (overrideCategory && !["OLD_FLEET", "NRG", "NON_DEPLOYABLE", "NOT_IN_FIRM"].includes(overrideCategory)) {
        throw new Error("Select a valid Finance override category.");
      }
      if (overrideCategory) {
        const reason = String(formData.get("overrideReason") ?? "").trim();
        if (!reason) throw new Error("A written reason is mandatory for a Finance override.");
        crane.finalOverride = { category: overrideCategory, reason, by: actor, at };
      }
      const result = overrideCategory ? routeForCategory(overrideCategory) : dedupe(crane.flags);
      crane.finalCategory = result.category;
      crane.status = result.status;
      crane.approvals.push({ id: entryId("ap"), decision: "Final FIRM list after deduplication", approverRole: user.role as Role, approverName: actor, action: "APPROVED", comment, at });
      crane.audit.unshift({ id: entryId("a"), actor, actorRole: user.role as Role, action: "FIRM list finalised", detail: `${crane.equipmentId} → ${CATEGORY_LABEL[result.category]} / ${result.route}`, at });
      message = `Finalised as ${CATEGORY_LABEL[result.category]} (${result.status}).`;
    } else if (kind === "UPLOAD_CATALOGUE") {
      if (crane.status !== "S08") throw new Error("Catalogue can only be uploaded while the crane is in S08.");
      const inputs = [
        { label: "Photos", name: "photos" },
        { label: "Short video", name: "video" },
        { label: "Spec sheet", name: "specSheet" },
        { label: "Load chart", name: "loadChart" },
        { label: "Condition summary", name: "conditionSummary" },
      ];
      const fileEntries: { label: string; file: File }[] = [];
      const legacy: string[] = [];
      for (const { label, name } of inputs) {
        for (const value of formData.getAll(name)) {
          if (value instanceof File && value.size > 0) {
            fileEntries.push({ label, file: value });
          } else if (typeof value === "string" && value.trim()) {
            legacy.push(`${label}: ${value.trim()}`);
          }
        }
      }
      if (fileEntries.length === 0 && legacy.length === 0) {
        throw new Error("Attach at least one catalogue document before saving.");
      }
      const attachments = await saveCatalogueAttachments(crane.id, fileEntries);
      const labels = [
        ...legacy,
        ...attachments.map((item) => `${item.label}: ${item.filename}`),
      ];
      crane.catalogue = {
        uploaded: true,
        files: [...(crane.catalogue.files ?? []), ...labels],
        attachments: [...(crane.catalogue.attachments ?? []), ...attachments],
        uploadedBy: actor,
        at,
      };
      crane.audit.unshift({
        id: entryId("a"), actor, actorRole: user.role as Role,
        action: "Marketing catalogue documents uploaded",
        detail: `${crane.equipmentId} · ${labels.length} item(s)`, at,
      });
      message = `Catalogue saved with ${labels.length} document(s). The window stays open until you close it.`;
    } else if (kind === "CLOSE_CATALOGUE_WINDOW") {
      if (crane.status !== "S08") throw new Error("The catalogue window is not open for this crane.");
      crane.status = "S09";
      const missing = !crane.catalogue.uploaded;
      crane.audit.unshift({
        id: entryId("a"), actor, actorRole: user.role as Role,
        action: "Catalogue window closed",
        detail: missing
          ? `${crane.equipmentId} · catalogue missing — Global Administrator alerted`
          : `${crane.equipmentId} · catalogue ready — sent to SCM`,
        at,
      });
      message = missing
        ? "Catalogue window closed without a catalogue. Global Administrator alerted. Crane moved to S09."
        : "Catalogue window closed. Crane moved to S09 — Listed for Sale.";
    } else if (kind === "FLOAT_TO_BUS") {
      if (crane.status !== "S04") throw new Error("This crane is not ready to be floated to BUs.");
      crane.audit.unshift({
        id: entryId("a"), actor, actorRole: user.role as Role,
        action: "Floated to international BUs",
        detail: `${crane.equipmentId} · offered to all international BUs (20-day window)`,
        at,
      });
      message = "Crane floated to all international BUs. Waiting for quotes.";
    } else if (kind === "SUBMIT_BU_QUOTE") {
      if (!["S04", "S05"].includes(crane.status)) {
        throw new Error("BU quotes can only be submitted while the crane is offered to BUs.");
      }
      const bu = String(formData.get("bu") ?? "").trim();
      if (!bu) throw new Error("Select your BU.");
      const interested = String(formData.get("interested") ?? "false") === "true";
      const quote: BuQuote = {
        bu,
        interested,
        ratePerMonth: Number(formData.get("ratePerMonth") ?? 0) || null,
        durationMonths: Number(formData.get("durationMonths") ?? 0) || null,
        expectedYieldPct: Number(formData.get("expectedYieldPct") ?? 0) || null,
        earliestStart: String(formData.get("earliestStart") ?? "").trim() || null,
        customer: String(formData.get("customer") ?? "").trim() || null,
        country: String(formData.get("country") ?? "").trim() || null,
        revisedAt: at,
      };
      const existing = crane.buQuotes.findIndex((entry) => entry.bu === bu);
      if (existing >= 0) crane.buQuotes[existing] = quote;
      else crane.buQuotes.push(quote);
      crane.status = "S05";
      crane.audit.unshift({
        id: entryId("a"), actor, actorRole: user.role as Role,
        action: interested ? "BU quote submitted" : "BU marked not interested",
        detail: interested
          ? `${crane.equipmentId} · ${bu} · ${quote.ratePerMonth ?? "—"}/mo · ${quote.durationMonths ?? "—"}mo · ${quote.expectedYieldPct ?? "—"}% yield`
          : `${crane.equipmentId} · ${bu} · not interested`,
        at,
      });
      message = interested
        ? `Quote submitted for ${bu}. Crane moved to BU Bid Evaluation (S05).`
        : `${bu} marked not interested. Crane moved to BU Bid Evaluation (S05).`;
    } else if (kind === "AWARD_BU") {
      if (crane.status !== "S05") throw new Error("Awards can only be made during BU Bid Evaluation.");
      const bu = String(formData.get("bu") ?? "").trim();
      const reason = String(formData.get("reason") ?? "").trim();
      if (!bu) throw new Error("Select a BU to award.");
      if (!reason) throw new Error("A reason is mandatory for the award.");
      const quote = crane.buQuotes.find((entry) => entry.bu === bu && entry.interested);
      if (!quote) throw new Error("Select an interested BU quote.");
      const needsCso = quote.expectedYieldPct !== null && crane.yieldPct > 0 && quote.expectedYieldPct < crane.yieldPct;
      crane.award = {
        bu,
        reason,
        decidedBy: actor,
        decidedAt: at,
        csoRequired: needsCso,
        strategyHeadApprovedBy: null,
        strategyHeadApprovedAt: null,
        csoApprovedBy: null,
        csoApprovedAt: null,
        approvedBy: null,
        approvedAt: null,
      };
      crane.status = "S06";
      crane.audit.unshift({
        id: entryId("a"), actor, actorRole: user.role as Role,
        action: "BU awarded — approval pending",
        detail: `${crane.equipmentId} · ${bu} · ${reason}`,
        at,
      });
      message = `Awarded to ${bu}. Awaiting Strategy Head${needsCso ? " and CSO (yield below expected)" : ""} approval (S06).`;
    } else if (kind === "NO_TAKER_TO_SALE") {
      if (!["S04", "S05"].includes(crane.status)) {
        throw new Error("No-taker route is only available while BUs are bidding.");
      }
      crane.status = "S08";
      crane.audit.unshift({
        id: entryId("a"), actor, actorRole: user.role as Role,
        action: "No BU taker — sent to sale",
        detail: `${crane.equipmentId} · BU window closed with no acceptable quote`,
        at,
      });
      message = "BU window closed with no taker. Crane moved to Marketing catalogue (S08).";
    } else if (kind === "APPROVE_AWARD" || kind === "REJECT_AWARD") {
      const approve = kind === "APPROVE_AWARD";
      if (!crane.award) throw new Error("No award to decide on.");
      if (crane.status !== "S06") throw new Error("This award is not awaiting approval.");
      if (approve) {
        const isStrategy = user.role === "STRATEGY";
        const isCso = user.role === "CSO";
        if (!isStrategy && !isCso && user.role !== "GLOBAL_ADMIN") {
          throw new Error("Only the Strategy Head or CSO can approve this award.");
        }
        if (isStrategy || user.role === "GLOBAL_ADMIN") {
          crane.award.strategyHeadApprovedBy = actor;
          crane.award.strategyHeadApprovedAt = at;
        }
        if (isCso || user.role === "GLOBAL_ADMIN") {
          crane.award.csoApprovedBy = actor;
          crane.award.csoApprovedAt = at;
        }
        if (crane.award.csoRequired === undefined) {
          const awardedQuote = crane.buQuotes.find((entry) => entry.bu === crane.award?.bu);
          crane.award.csoRequired = !!awardedQuote?.expectedYieldPct && crane.yieldPct > 0
            && awardedQuote.expectedYieldPct < crane.yieldPct;
        }
        const headDone = !!crane.award.strategyHeadApprovedBy;
        const csoDone = !crane.award.csoRequired || !!crane.award.csoApprovedBy;
        if (headDone && csoDone) {
          crane.award.approvedBy = actor;
          crane.award.approvedAt = at;
          crane.status = "S07";
          message = "Award fully approved. Crane reserved (S07).";
        } else {
          const pending = [!headDone && "Strategy Head", !csoDone && "CSO"].filter(Boolean).join(" and ");
          message = `Your approval is recorded. Still awaiting ${pending} sign-off (S06).`;
        }
        crane.approvals.push({ id: entryId("ap"), decision: "Approve BU award", approverRole: user.role as Role, approverName: actor, action: "APPROVED", comment, at });
        crane.audit.unshift({ id: entryId("a"), actor, actorRole: user.role as Role, action: "BU award approved", detail: `${crane.equipmentId} · ${crane.award.bu} · ${message}`, at });
      } else {
        crane.award.strategyHeadApprovedBy = null;
        crane.award.strategyHeadApprovedAt = null;
        crane.award.csoApprovedBy = null;
        crane.award.csoApprovedAt = null;
        crane.award.approvedBy = null;
        crane.award.approvedAt = null;
        crane.status = "S05";
        crane.approvals.push({ id: entryId("ap"), decision: "Reject BU award", approverRole: user.role as Role, approverName: actor, action: "REJECTED", comment, at });
        crane.audit.unshift({ id: entryId("a"), actor, actorRole: user.role as Role, action: "BU award rejected", detail: `${crane.equipmentId} · ${crane.award.bu} · ${comment}`, at });
        message = "Award rejected. Back to bid evaluation (S05).";
      }
    } else if (kind === "SUBMIT_SALE_QUOTE") {
      if (crane.status !== "S09") throw new Error("Sale quotations can only be gathered while listed for sale (S09).");
      const buyer = String(formData.get("buyer") ?? "").trim();
      const market = String(formData.get("market") ?? "").trim();
      const value = Number(formData.get("value") ?? 0);
      const date = String(formData.get("date") ?? "").trim();
      if (!buyer) throw new Error("Enter the buyer.");
      if (!["Domestic", "International"].includes(market)) throw new Error("Select the market.");
      if (!(value > 0)) throw new Error("Enter a valid quotation value.");
      if (!date) throw new Error("Enter the quotation date.");
      crane.saleQuotes.push({
        buyer,
        market: market as "Domestic" | "International",
        value,
        date,
        fpnaValidated: false,
        validatedBy: null,
        validatedAt: null,
      });
      crane.audit.unshift({ id: entryId("a"), actor, actorRole: user.role as Role, action: "Sale quotation recorded", detail: `${crane.equipmentId} · ${buyer} · ${market} · ₹${value.toLocaleString("en-IN")} · ${date}`, at });
      message = `Quotation from ${buyer} recorded. Send one for FP&A price validation when ready.`;
    } else if (kind === "SELECT_SALE_QUOTE") {
      if (crane.status !== "S09") throw new Error("Only a crane listed for sale can be sent for price validation.");
      const index = Number(formData.get("quoteIndex") ?? -1);
      const quote = crane.saleQuotes[index];
      if (!quote) throw new Error("Select a recorded quotation.");
      crane.selectedSaleQuoteIndex = index;
      crane.status = "S10";
      crane.audit.unshift({ id: entryId("a"), actor, actorRole: user.role as Role, action: "Sale quotation sent for price validation", detail: `${crane.equipmentId} · ${quote.buyer} · ₹${quote.value.toLocaleString("en-IN")}`, at });
      message = `${quote.buyer}'s quotation sent to FP&A for price validation (S10).`;
    } else if (kind === "VALIDATE_SALE_PRICE") {
      if (crane.status !== "S10") throw new Error("Price validation is only available while sale approval is pending (S10).");
      const index = crane.selectedSaleQuoteIndex ?? -1;
      const quote = crane.saleQuotes[index];
      if (!quote) throw new Error("No quotation was sent for price validation.");
      quote.fpnaValidated = true;
      quote.validatedBy = actor;
      quote.validatedAt = at;
      crane.approvals.push({ id: entryId("ap"), decision: "Validate sale price", approverRole: user.role as Role, approverName: actor, action: "APPROVED", comment, at });
      crane.audit.unshift({ id: entryId("a"), actor, actorRole: user.role as Role, action: "Sale price validated by FP&A", detail: `${crane.equipmentId} · ${quote.buyer} · ₹${quote.value.toLocaleString("en-IN")} · ${comment}`, at });
      message = `Price validated for ${quote.buyer}. Awaiting management approval.`;
    } else if (kind === "APPROVE_SALE" || kind === "REJECT_SALE") {
      const approve = kind === "APPROVE_SALE";
      if (crane.status !== "S10") throw new Error("Sale approval is only available at S10.");
      const index = crane.selectedSaleQuoteIndex ?? -1;
      const quote = crane.saleQuotes[index];
      if (!quote || !quote.fpnaValidated) {
        throw new Error("FP&A must validate the quotation price before a management decision.");
      }
      if (approve) {
        const soNumber = String(formData.get("soNumber") ?? "").trim();
        if (!soNumber) throw new Error("Enter the SAP sale SO number before approving.");
        crane.status = "S18";
        crane.sap.soNumber = soNumber;
      } else {
        crane.status = "S09";
        if (quote) {
          quote.fpnaValidated = false;
          quote.validatedBy = null;
          quote.validatedAt = null;
        }
        crane.selectedSaleQuoteIndex = null;
      }
      crane.approvals.push({ id: entryId("ap"), decision: "Approve sale", approverRole: user.role as Role, approverName: actor, action: approve ? "APPROVED" : "REJECTED", comment, at });
      crane.audit.unshift({ id: entryId("a"), actor, actorRole: user.role as Role, action: approve ? "Sale approved · SO recorded" : "Sale rejected", detail: `${crane.equipmentId}${quote ? ` · ${quote.buyer}` : ""}${approve ? ` · SO ${crane.sap.soNumber ?? "pending"}` : ""}`, at });
      message = approve ? "Sale approved. Crane locked in SAP (S18)." : "Sale rejected. Back to listed for sale (S09).";
    } else if (kind === "APPROVE_SCRAP" || kind === "REJECT_SCRAP") {
      if (crane.status !== "S11") throw new Error("Scrap approval is only available at S11.");
      const approve = kind === "APPROVE_SCRAP";
      crane.status = approve ? "S12" : "S20";
      crane.approvals.push({ id: entryId("ap"), decision: "Approve scrap sale", approverRole: user.role as Role, approverName: actor, action: approve ? "APPROVED" : "REJECTED", comment, at });
      crane.audit.unshift({ id: entryId("a"), actor, actorRole: user.role as Role, action: approve ? "Scrap sale approved" : "Scrap not approved", detail: `${crane.equipmentId} · ${comment}`, at });
      message = approve ? "Scrap sale approved (S12)." : "Scrap declined. Crane carried forward (S20).";
    } else if (kind === "APPROVE_CLAIM" || kind === "REJECT_CLAIM") {
      if (crane.status !== "S13") throw new Error("Claim-back approval is only available at S13.");
      const approve = kind === "APPROVE_CLAIM";
      if (!crane.claimBack) throw new Error("No claim-back to decide on.");
      if (crane.claimBack.status !== "PENDING") throw new Error("This claim-back has already been decided.");
      if (!claimApprovers(crane.claimBack.team).includes(user.role)) {
        throw new Error(`Your role (${user.role}) cannot decide this claim-back.`);
      }
      crane.claimBack.status = approve ? "APPROVED" : "REJECTED";
      crane.claimBack.decidedBy = actor;
      crane.claimBack.decidedAt = at;
      crane.status = approve
        ? claimTargetStatus(crane.claimBack.team)
        : (crane.claimBack.originStatus && crane.claimBack.originStatus !== "S13"
            ? crane.claimBack.originStatus
            : claimTargetStatus(crane.claimBack.team));
      crane.approvals.push({ id: entryId("ap"), decision: "Approve claim-back", approverRole: user.role as Role, approverName: actor, action: approve ? "APPROVED" : "REJECTED", comment, at });
      crane.audit.unshift({ id: entryId("a"), actor, actorRole: user.role as Role, action: approve ? "Claim-back approved" : "Claim-back rejected", detail: `${crane.equipmentId} · ${crane.claimBack.customer}`, at });
      message = approve
        ? `Claim-back approved (${crane.status}).`
        : `Claim-back rejected. Returned to ${crane.status}.`;
    } else if (kind === "RESOLVE_CONFLICT") {
      if (crane.status !== "S14") throw new Error("Conflict resolution is only available at S14.");
      if (!crane.conflict) throw new Error("No conflict to resolve.");
      if (crane.conflict.status !== "OPEN") throw new Error("This conflict has already been resolved.");
      if (!conflictApprovers(crane.conflict.ruleId).includes(user.role)) {
        throw new Error(`Your role (${user.role}) cannot decide this conflict.`);
      }
      if (!decision) throw new Error("Select the winning option.");

      const joint = crane.conflict.ruleId === "DOMESTIC_VS_BU" && user.role !== "GLOBAL_ADMIN";
      let finalWinner = decision;
      let resolved = true;

      if (joint && user.role === "MD") {
        if (!crane.conflict.escalatedToMd) {
          throw new Error("The MD/CEO can decide only after CBO and CSO disagree.");
        }
      } else if (joint) {
        if (user.role === "CBO") crane.conflict.cboVote = decision;
        if (user.role === "CSO") crane.conflict.csoVote = decision;
        resolved = false;
        if (crane.conflict.cboVote && crane.conflict.csoVote) {
          if (crane.conflict.cboVote === crane.conflict.csoVote) {
            finalWinner = crane.conflict.cboVote;
            resolved = true;
          } else {
            crane.conflict.escalatedToMd = true;
            message = "CBO and CSO disagree. Escalated to MD/CEO for the final call.";
          }
        } else {
          message = `Your vote is recorded. Awaiting ${user.role === "CBO" ? "CSO" : "CBO"} sign-off.`;
        }
      }

      if (!resolved) {
        crane.conflict.winner = null;
        crane.conflict.reason = comment;
        crane.conflict.decidedByUser = actor;
        crane.conflict.decidedAt = at;
        crane.approvals.push({ id: entryId("ap"), decision: "Record conflict vote", approverRole: user.role as Role, approverName: actor, action: "APPROVED", comment, at });
        crane.audit.unshift({ id: entryId("a"), actor, actorRole: user.role as Role, action: "Conflict vote recorded", detail: `${crane.equipmentId} · ${decision} · ${message}`, at });
      } else {
        crane.conflict.status = "RESOLVED";
        crane.conflict.winner = finalWinner;
        crane.conflict.reason = comment;
        crane.conflict.decidedByUser = actor;
        crane.conflict.decidedAt = at;
        crane.status = conflictOutcomeStatus(crane.conflict.ruleId, finalWinner, {
          originStatus: crane.claimBack?.originStatus,
          hasAward: !!crane.award,
        });
        crane.approvals.push({ id: entryId("ap"), decision: "Resolve conflict", approverRole: user.role as Role, approverName: actor, action: "APPROVED", comment, at });
        crane.audit.unshift({ id: entryId("a"), actor, actorRole: user.role as Role, action: "Conflict resolved", detail: `${crane.equipmentId} · winner ${finalWinner} · ${comment}`, at });
        message = `Conflict resolved in favour of ${finalWinner}.`;
      }
    } else if (kind === "DEPLOY") {
      if (crane.status !== "S07") throw new Error("Deployment is only available from S07.");
      if (crane.sap.soEnd && crane.sap.soEnd > now().slice(0, 10)) {
        throw new Error(`SAP hard stop: execution allowed only from ${crane.sap.soEnd}.`);
      }
      const assetTransferNo = String(formData.get("assetTransferNo") ?? "").trim();
      if (!assetTransferNo) throw new Error("Enter the SAP asset transfer document number.");
      crane.sap.assetTransferNo = assetTransferNo;
      crane.status = "S16";
      crane.audit.unshift({ id: entryId("a"), actor, actorRole: user.role as Role, action: "International transfer recorded", detail: `${crane.equipmentId} · ${crane.sap.assetTransferNo}`, at });
      message = "Asset transfer recorded. Crane locked (S16).";
    } else if (kind === "RECORD_SO") {
      crane.sap.soNumber = String(formData.get("soNumber") ?? "").trim() || crane.sap.soNumber;
      crane.sap.soStart = String(formData.get("soStart") ?? "").trim() || crane.sap.soStart;
      crane.sap.soEnd = String(formData.get("soEnd") ?? "").trim() || crane.sap.soEnd;
      crane.audit.unshift({ id: entryId("a"), actor, actorRole: user.role as Role, action: "SAP SO details recorded", detail: `${crane.equipmentId} · ${crane.sap.soNumber} · execution from ${crane.sap.soEnd ?? "immediately"}`, at });
      message = `SO recorded. Execution allowed from ${crane.sap.soEnd ?? "immediately"}.`;
    }
    if (!STATUS_MAP[crane.status]) throw new Error("Invalid status produced.");
  });

  revalidatePath("/");
  revalidatePath("/cranes");
  revalidatePath("/approvals");
  revalidatePath("/cycles");
  return { ok: message };
}

/** Sales: apply one review to several S01 cranes in a single action. */
export async function bulkSalesReviewAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  if (user.role !== "SALES") {
    return { error: "Only the Sales team can review cranes in bulk." };
  }

  let ids: string[] = [];
  try {
    const raw: unknown = JSON.parse(String(formData.get("craneIds") ?? "[]"));
    if (Array.isArray(raw)) ids = raw.filter((value): value is string => typeof value === "string");
  } catch {
    return { error: "Invalid crane selection." };
  }
  if (ids.length === 0) return { error: "Select at least one crane." };
  if (ids.length > 200) return { error: "Select at most 200 cranes at a time." };

  const marketable = String(formData.get("marketable") ?? "").trim();
  if (!["Marketable", "Not marketable"].includes(marketable)) {
    return { error: "Select a marketability value." };
  }
  const expectedMonths = Number(formData.get("expectedMonths") ?? 0) || null;
  const comment = String(formData.get("comment") ?? "").trim();

  let reviewed = 0;
  await mutate((state) => {
    const targets = ids.map((id) =>
      state.cranes.find((crane) => crane.id === id || crane.equipmentId === id),
    );
    if (targets.some((crane) => !crane)) throw new Error("One or more cranes were not found.");
    if (targets.some((crane) => (crane as Crane).status !== "S01")) {
      throw new Error("Only cranes at S01 (Pending Validation) can be reviewed in bulk.");
    }

    const at = now();
    const actor = user.name;
    for (const crane of targets as Crane[]) {
      // NRG/RG is the system classification from upload and cannot be changed.
      crane.sales = {
        marketable: marketable as "Marketable" | "Not marketable",
        nrg: crane.sales.nrg,
        expectedMonths,
        remarks: comment || null,
        submittedBy: actor,
        submittedAt: at,
      };
      crane.finalCategory = null;
      crane.finalOverride = null;
      crane.audit.unshift({
        id: entryId("a"), actor, actorRole: user.role as Role,
        action: "Sales check submitted (bulk)",
        detail: `${crane.equipmentId} · marketable ${marketable} · NRG/RG ${crane.sales.nrg ? "NRG" : "RG"} (system, from upload)`,
        at,
      });
      if (crane.maintenance.submittedBy) crane.status = "S02";
      reviewed += 1;
    }
  });

  revalidatePath("/");
  revalidatePath("/cranes");
  revalidatePath("/approvals");
  return { ok: `${reviewed} crane${reviewed === 1 ? "" : "s"} reviewed by Sales.` };
}

/** Maintenance: apply the same deployability review to several S01 cranes. */
export async function bulkMaintenanceReviewAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  if (user.role !== "MAINTENANCE") {
    return { error: "Only the Maintenance team can review cranes in bulk." };
  }

  let ids: string[] = [];
  try {
    const raw: unknown = JSON.parse(String(formData.get("craneIds") ?? "[]"));
    if (Array.isArray(raw)) ids = raw.filter((value): value is string => typeof value === "string");
  } catch {
    return { error: "Invalid crane selection." };
  }
  if (ids.length === 0) return { error: "Select at least one crane." };
  if (ids.length > 200) return { error: "Select at most 200 cranes at a time." };

  const rawDeployable = String(formData.get("deployable") ?? "");
  if (!["true", "false"].includes(rawDeployable)) {
    return { error: "Select Deployable or Non-Deployable." };
  }
  const deployable = rawDeployable === "true";
  const reason = String(formData.get("reason") ?? "").trim();
  if (!deployable && !reason) {
    return { error: "A reason is mandatory when a crane is marked Non-Deployable." };
  }

  let reviewed = 0;
  await mutate((state) => {
    const targets = ids.map((id) =>
      state.cranes.find((crane) => crane.id === id || crane.equipmentId === id),
    );
    if (targets.some((crane) => !crane)) throw new Error("One or more cranes were not found.");
    if (targets.some((crane) => (crane as Crane).status !== "S01")) {
      throw new Error("Only cranes at S01 (Pending Validation) can be reviewed in bulk.");
    }

    const at = now();
    const actor = user.name;
    for (const crane of targets as Crane[]) {
      crane.maintenance = {
        deployable,
        reason: deployable ? null : reason,
        submittedBy: actor,
        submittedAt: at,
      };
      crane.flags.nonDeployable = !deployable;
      crane.finalCategory = null;
      crane.finalOverride = null;
      crane.audit.unshift({
        id: entryId("a"), actor, actorRole: user.role as Role,
        action: "Maintenance check submitted (bulk)",
        detail: `${crane.equipmentId} · ${deployable ? "Deployable" : `Non-Deployable · ${reason}`}`,
        at,
      });
      if (crane.sales.submittedBy) crane.status = "S02";
      reviewed += 1;
    }
  });

  revalidatePath("/");
  revalidatePath("/cranes");
  revalidatePath("/approvals");
  return { ok: `${reviewed} crane${reviewed === 1 ? "" : "s"} reviewed by Maintenance.` };
}

/** Finance: finalise and route every S02 crane in the open cycle at once. */
export async function finaliseAllAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  if (!["FINANCE", "GLOBAL_ADMIN"].includes(user.role)) {
    return { error: "Only Finance can finalise the FIRM list." };
  }
  const comment = String(formData.get("comment") ?? "").trim();
  if (!comment) return { error: "A comment is mandatory for every approval decision." };

  let count = 0;
  await mutate((state) => {
    const cycle = state.cycles.find((entry) => entry.status === "OPEN");
    if (!cycle) throw new Error("No open cycle available. Start or reopen a cycle before finalising.");
    const at = now();
    const actor = user.name;
    for (const crane of state.cranes) {
      if (crane.cycleId !== cycle.id || crane.status !== "S02") continue;
      const result = dedupe(crane.flags);
      crane.finalCategory = result.category;
      crane.status = result.status;
      crane.approvals.push({
        id: entryId("ap"),
        decision: "Final FIRM list after deduplication (bulk)",
        approverRole: user.role as Role,
        approverName: actor,
        action: "APPROVED",
        comment,
        at,
      });
      crane.audit.unshift({
        id: entryId("a"),
        actor,
        actorRole: user.role as Role,
        action: "FIRM list finalised (bulk)",
        detail: `${crane.equipmentId} → ${CATEGORY_LABEL[result.category]} / ${result.route}`,
        at,
      });
      count += 1;
    }
  });

  revalidatePath("/");
  revalidatePath("/cranes");
  revalidatePath("/approvals");
  revalidatePath("/cycles");
  return { ok: `${count} crane${count === 1 ? "" : "s"} finalised and routed.` };
}

export type ValidateState = {
  preview?: {
    rows: { equipmentId: string; description: string; yom: number; yieldPct: number; utilisationPct: number; age: number; oldFleet: boolean; nrg: boolean; soNumber: string | null; soEnd: string | null }[];
    issues: { severity: string; row: number | null; field: string | null; message: string }[];
    errorCount: number;
    warningCount: number;
  };
  error?: string;
} | null;

/** Parse and validate without writing anything. */
export async function validateFleetAction(_prev: ValidateState, formData: FormData): Promise<ValidateState> {
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "Choose an Excel workbook first." };
  const parsed = parseFirmWorkbook(Buffer.from(await file.arrayBuffer()));
  return {
    preview: {
      rows: parsed.rows.map((row) => ({
        equipmentId: row.equipmentId,
        description: row.description,
        yom: row.yom,
        yieldPct: row.yieldPct,
        utilisationPct: row.utilisationPct,
        age: row.age,
        oldFleet: row.oldFleet,
        nrg: row.nrg,
        soNumber: row.soNumber,
        soEnd: row.soEnd,
      })),
      issues: parsed.issues,
      errorCount: parsed.errorCount,
      warningCount: parsed.warningCount,
    },
  };
}

/** Commit a validated workbook into the current open cycle. */
export async function uploadFleetAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  if (!["FPNA", "GLOBAL_ADMIN"].includes(user.role)) {
    return { error: "Only FP&A can start a cycle and upload the fleet." };
  }
  const cycleId = String(formData.get("cycleId") ?? "").trim();
  if (!cycleId) return { error: "Select a cycle to upload into first." };
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "Choose an Excel workbook." };

  const buffer = Buffer.from(await file.arrayBuffer());
  const parsed = parseFirmWorkbook(buffer);
  if (parsed.errorCount > 0 || parsed.rows.length === 0) {
    return { error: `${parsed.errorCount} error(s) found. Fix the workbook and validate again before committing.` };
  }

  let added = 0;
  await mutate((state) => {
    const cycle = state.cycles.find((entry) => entry.id === cycleId);
    if (!cycle) throw new Error("Cycle not found.");
    if (cycle.status !== "OPEN") throw new Error("This cycle is stopped. No changes are allowed.");
    const at = now();
    if (!cycle.startDate) cycle.startDate = at.slice(0, 10);
    for (const row of parsed.rows) {
      if (state.cranes.some((c) => c.equipmentId === row.equipmentId)) continue;
      const crane: Crane = {
        id: row.equipmentId,
        equipmentId: row.equipmentId,
        description: row.description,
        yom: row.yom,
        yieldPct: row.yieldPct,
        utilisationPct: row.utilisationPct,
        age: row.age,
        oldFleet: row.oldFleet,
        cycleId: cycle.id,
        status: "S01",
        flags: { oldFleet: row.oldFleet, nrg: row.nrg, nonDeployable: false },
        finalCategory: null,
        finalOverride: null,
        sap: {
          currentStatus: (row.sapStatus as "On rent" | "Idle" | "Sold") ?? "Idle",
          soNumber: row.soNumber ?? null,
          soStart: row.soStart ?? null,
          soEnd: row.soEnd ?? null,
          assetTransferNo: null,
        },
        sales: { marketable: null, nrg: row.nrg, expectedMonths: null, remarks: null, submittedBy: null, submittedAt: null },
        maintenance: { deployable: null, reason: null, submittedBy: null, submittedAt: null },
        buQuotes: [],
        award: null,
        catalogue: { uploaded: false, files: [], uploadedBy: null, at: null },
        saleQuotes: [],
        claimBack: null,
        conflict: null,
        approvals: [],
        audit: [{ id: entryId("a"), actor: user.name, actorRole: user.role as Role, action: "Fleet uploaded", detail: `${row.equipmentId} · age ${row.age} · Old Fleet ${row.oldFleet} · NRG/RG ${row.nrg ? "NRG" : "RG"} (util ${row.utilisationPct}%, yield ${row.yieldPct}%) · SO ${row.soNumber ?? "none"}`, at }],
      };
      state.cranes.push(crane);
      added += 1;
    }
  });

  revalidatePath("/");
  revalidatePath("/cranes");
  revalidatePath("/cycles");
  return { ok: `${added} crane(s) added to the cycle. Sales and Maintenance checks are now open in parallel.` };
}

export async function updateCycleAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  if (!["FPNA", "GLOBAL_ADMIN"].includes(user.role)) {
    return { error: "Only FP&A can update cycle details." };
  }
  const cycleId = String(formData.get("cycleId") ?? "").trim();
  if (!cycleId) return { error: "Missing cycle." };

  const rawStart = String(formData.get("startDate") ?? "").trim();
  const rawEnd = String(formData.get("endDate") ?? "").trim();
  const rawStatus = String(formData.get("status") ?? "").trim();
  const startDate = rawStart || null;
  const endDate = rawEnd || null;

  if (startDate && !/^\d{4}-\d{2}-\d{2}$/.test(startDate)) {
    return { error: "Start date must be a valid date (YYYY-MM-DD)." };
  }
  if (endDate && !/^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
    return { error: "End date must be a valid date (YYYY-MM-DD)." };
  }
  if (startDate && endDate && endDate < startDate) {
    return { error: "End date cannot be before start date." };
  }
  if (rawStatus && rawStatus !== "OPEN" && rawStatus !== "CLOSED") {
    return { error: "Invalid cycle status." };
  }

  await mutate((state) => {
    const cycle = state.cycles.find((entry) => entry.id === cycleId);
    if (!cycle) throw new Error("Cycle not found.");
    if ("startDate" in Object.fromEntries(formData.entries()) || rawStart !== "") cycle.startDate = startDate;
    // Always apply provided date fields from the form (including clearing with empty).
    cycle.startDate = startDate;
    cycle.endDate = endDate;
    if (rawStatus) cycle.status = rawStatus as "OPEN" | "CLOSED";
  });

  revalidatePath("/");
  revalidatePath("/cranes");
  revalidatePath("/cycles");
  revalidatePath(`/cycles/${cycleId}`);
  return { ok: rawStatus === "CLOSED" ? "Cycle stopped. No further changes are allowed." : "Cycle updated." };
}

/** FP&A opens a FIRM cycle with its start and end dates before uploading any fleet. */
export async function createCycleAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  if (!["FPNA", "GLOBAL_ADMIN"].includes(user.role)) {
    return { error: "Only FP&A can create a FIRM cycle." };
  }
  const name = String(formData.get("name") ?? "").trim();
  const startDate = String(formData.get("startDate") ?? "").trim();
  const endDate = String(formData.get("endDate") ?? "").trim();
  const datePattern = /^\d{4}-\d{2}-\d{2}$/;

  if (!name) return { error: "Enter a name for the cycle." };
  if (!datePattern.test(startDate)) return { error: "Start date is required (YYYY-MM-DD)." };
  if (!datePattern.test(endDate)) return { error: "End date is required (YYYY-MM-DD)." };
  if (endDate < startDate) return { error: "End date cannot be before start date." };

  await mutate((state) => {
    const openedAt = now();
    state.cycles.push({
      id: `C-${Date.now()}`,
      name,
      openedAt,
      openedBy: user.name,
      evaluationDate: endDate,
      startDate,
      endDate,
      status: "OPEN",
    });
  });

  revalidatePath("/");
  revalidatePath("/cranes");
  revalidatePath("/cycles");
  revalidatePath("/import");
  return { ok: `Cycle "${name}" created. You can now upload cranes into it.` };
}
