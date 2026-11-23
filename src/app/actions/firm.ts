"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { mutate } from "@/lib/firm/store";
import { saveCatalogueAttachments } from "@/lib/firm/uploads";
import { parseFirmWorkbook } from "@/lib/firm/intake";
import {
  CATEGORY_LABEL, CONFLICT_RULES, STATUS_MAP,
  claimApprovers, claimConflictRule, claimTargetStatus,
  RENTAL_SO_WINDOW_DAYS, addDays, conflictApprovers, conflictOutcomeStatus,
  dedupe, routeForCategory, saleQuoteStillValid,
  type FinalCategory, type Role,
} from "@/lib/firm/workflow";
import type { BuQuote, Crane } from "@/lib/firm/types";
import {
  INTERNATIONAL_BUS, buCodeForUser, buLabel, parseInvitedBus, type BuCode,
} from "@/lib/firm/bu";

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
  AWARD_BU_DIRECT: ["STRATEGY", "GLOBAL_ADMIN"],
  AWARD_BU: ["STRATEGY", "GLOBAL_ADMIN"],
  NO_TAKER_TO_SALE: ["STRATEGY", "GLOBAL_ADMIN"],
  APPROVE_AWARD: ["CSO", "GLOBAL_ADMIN"],
  REJECT_AWARD: ["CSO", "GLOBAL_ADMIN"],
  SUBMIT_SALE_QUOTE: ["SCM", "GLOBAL_ADMIN"],
  SELECT_SALE_QUOTE: ["SCM", "GLOBAL_ADMIN"],
  VALIDATE_SALE_PRICE: ["FPNA", "GLOBAL_ADMIN"],
  APPROVE_SALE: ["MD", "GLOBAL_ADMIN"],
  REJECT_SALE: ["MD", "GLOBAL_ADMIN"],
  APPROVE_SCRAP: ["MD", "GLOBAL_ADMIN"],
  REJECT_SCRAP: ["MD", "GLOBAL_ADMIN"],
  APPROVE_CLAIM: ["CBO", "CSO", "SALES", "STRATEGY", "GLOBAL_ADMIN"],
  REJECT_CLAIM: ["CBO", "CSO", "SALES", "STRATEGY", "GLOBAL_ADMIN"],
  RESOLVE_CONFLICT: ["CBO", "CSO", "STRATEGY", "MD", "GLOBAL_ADMIN"],
  DEPLOY: ["STRATEGY", "GLOBAL_ADMIN"],
  RECORD_SO: ["SALES", "STRATEGY", "SCM", "GLOBAL_ADMIN"],
  REQUEST_CLAIM_BACK: ["SALES", "STRATEGY"],
  RECORD_RENTAL_SO: ["SALES", "STRATEGY", "GLOBAL_ADMIN"],
  NOTIFY_SALE_BUYER: ["SCM", "GLOBAL_ADMIN"],
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
    "RESOLVE_CONFLICT", "VALIDATE_SCRAP_PRICE", "NOTIFY_SALE_BUYER",
  ];
  if (commentRequired.includes(kind) && !comment) {
    return { error: "A comment is mandatory for every decision." };
  }

  let message = "Action recorded.";
  try {
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
        const marketable = String(formData.get("marketable") ?? "Marketable") as "Marketable" | "Not marketable";
        const expectedMonths = Number(formData.get("expectedMonths") ?? 0) || null;
        if (marketable === "Marketable" && !(expectedMonths && expectedMonths > 0)) {
          throw new Error("Expected deployment duration is mandatory for a marketable crane.");
        }
        crane.sales = {
          marketable,
          nrg: crane.sales.nrg,
          expectedMonths,
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
          if (marketable === "Not marketable") {
            crane.status = "S02";
            message = "Both checks are in. Non-marketable crane moved to Finance dedup (S02).";
          } else {
            message = "Sales check submitted. Marketable cranes stay at S01 — only non-marketable cranes go to Finance dedup.";
          }
        } else {
          message = "Sales check submitted. Waiting for Maintenance check.";
        }
      } else if (kind === "SUBMIT_MAINTENANCE") {
        if (crane.status !== "S01") throw new Error("Maintenance checks are only open at S01.");
        const deployable = String(formData.get("deployable") ?? "true") === "true";
        const reason = String(formData.get("reason") ?? "").trim();
        if (!deployable && !reason) throw new Error("A reason is mandatory when a crane is marked Non-Deployable.");
        crane.maintenance = {
          deployable,
          reason: deployable ? null : reason,
          submittedBy: actor,
          submittedAt: at,
        };
        crane.flags.nonDeployable = !deployable;
        crane.finalCategory = null;
        crane.finalOverride = null;
        crane.audit.unshift({ id: entryId("a"), actor, actorRole: user.role as Role, action: "Maintenance check submitted", detail: `${crane.equipmentId} · ${deployable ? "Deployable" : `Non-Deployable · ${reason}`}`, at });
        if (crane.sales.submittedBy) {
          if (crane.sales.marketable === "Not marketable") {
            crane.status = "S02";
            message = "Both checks are in. Non-marketable crane moved to Finance dedup (S02).";
          } else {
            message = "Maintenance check submitted. Marketable cranes stay at S01 — only non-marketable cranes go to Finance dedup.";
          }
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
        if (!["S04", "S05"].includes(crane.status)) {
          throw new Error("This crane is not ready to be floated to BUs.");
        }
        const invited = parseInvitedBus(formData.get("invitedBus"));
        if (!invited || invited.length === 0) {
          throw new Error("Select at least one BU to float this crane to.");
        }
        const refloat = crane.status === "S05";
        crane.invitedBus = invited;
        crane.audit.unshift({
          id: entryId("a"), actor, actorRole: user.role as Role,
          action: refloat ? "BU window reopened — floated again" : "Floated to international BUs",
          detail: `${crane.equipmentId} · offered to ${invited.map(buLabel).join(", ")}${invited.length === INTERNATIONAL_BUS.length ? " (all BUs)" : ""} (20-day window)${refloat ? " · quotes reopened" : ""}`,
          at,
        });
        message = `Crane floated to ${invited.map(buLabel).join(", ")}. Waiting for quotes.`;
      } else if (kind === "SUBMIT_BU_QUOTE") {
        if (!["S04", "S05"].includes(crane.status)) {
          throw new Error("BU quotes can only be submitted while the crane is offered to BUs.");
        }
        if (crane.award) {
          throw new Error("This quote is locked — Strategy has already awarded the crane or sent it for CSO approval.");
        }
        const sessionBu = buCodeForUser(user);
        const submittedBu = String(formData.get("bu") ?? "").trim().toUpperCase();
        const bu = sessionBu ?? submittedBu;
        if (!bu || !INTERNATIONAL_BUS.includes(bu as BuCode)) {
          throw new Error("Select a valid international BU.");
        }
        if (user.role === "BU" && sessionBu && submittedBu && submittedBu !== sessionBu) {
          throw new Error("You can only submit a quote for your own BU.");
        }
        const invited = crane.invitedBus ?? [];
        if (invited.length > 0 && !invited.includes(bu)) {
          throw new Error(`This crane was not floated to ${bu}.`);
        }
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
        if (crane.csoRejectedBu === bu) crane.csoRejectedBu = null;
        crane.status = "S05";
        crane.audit.unshift({
          id: entryId("a"), actor, actorRole: user.role as Role,
          action: interested ? "BU quote submitted" : "BU marked not interested",
          detail: interested
            ? `${crane.equipmentId} · ${buLabel(bu)} · ${quote.ratePerMonth ?? "—"}/mo · ${quote.durationMonths ?? "—"}mo · ${quote.expectedYieldPct ?? "—"}% yield`
            : `${crane.equipmentId} · ${buLabel(bu)} · not interested`,
          at,
        });
        message = interested
          ? `Quote submitted for ${buLabel(bu)}. Crane moved to BU Bid Evaluation (S05).`
          : `${buLabel(bu)} marked not interested. Crane moved to BU Bid Evaluation (S05).`;
      } else if (kind === "AWARD_BU_DIRECT") {
        // Strategy signs off on its own behalf and reserves the crane immediately.
        if (crane.status !== "S05") throw new Error("Awards can only be made during BU Bid Evaluation.");
        const bu = String(formData.get("bu") ?? "").trim();
        const reason = String(formData.get("reason") ?? "").trim();
        if (!bu) throw new Error("Select a BU to award.");
        if (!reason) throw new Error("A reason is mandatory for the award.");
        const quote = crane.buQuotes.find((entry) => entry.bu === bu && entry.interested);
        if (!quote) throw new Error("Select an interested BU quote.");
        crane.award = {
          bu,
          reason,
          decidedBy: actor,
          decidedAt: at,
          csoRequired: false,
          strategyHeadApprovedBy: actor,
          strategyHeadApprovedAt: at,
          csoApprovedBy: null,
          csoApprovedAt: null,
          approvedBy: actor,
          approvedAt: at,
        };
        crane.status = "S07";
        crane.approvals.push({
          id: entryId("ap"), decision: "Award BU directly (Strategy)",
          approverRole: user.role as Role, approverName: actor,
          action: "APPROVED", comment: reason, at,
        });
        crane.audit.unshift({
          id: entryId("a"), actor, actorRole: user.role as Role,
          action: "BU awarded directly by Strategy",
          detail: `${crane.equipmentId} · ${buLabel(bu)} · ${reason} · reserved (S07)`,
          at,
        });
        message = `Awarded directly to ${buLabel(bu)}. Crane reserved (S07).`;
      } else if (kind === "AWARD_BU") {
        // Strategy routes the award to the CSO; its decision is the Strategy sign-off.
        if (crane.status !== "S05") throw new Error("Awards can only be made during BU Bid Evaluation.");
        const bu = String(formData.get("bu") ?? "").trim();
        const reason = String(formData.get("reason") ?? "").trim();
        if (!bu) throw new Error("Select a BU to award.");
        if (!reason) throw new Error("A reason is mandatory for the award.");
        const quote = crane.buQuotes.find((entry) => entry.bu === bu && entry.interested);
        if (!quote) throw new Error("Select an interested BU quote.");
        crane.award = {
          bu,
          reason,
          decidedBy: actor,
          decidedAt: at,
          csoRequired: true,
          // Strategy's decision to send the award is its own sign-off; only CSO decides now.
          strategyHeadApprovedBy: actor,
          strategyHeadApprovedAt: at,
          csoApprovedBy: null,
          csoApprovedAt: null,
          approvedBy: null,
          approvedAt: null,
        };
        crane.status = "S06";
        crane.audit.unshift({
          id: entryId("a"), actor, actorRole: user.role as Role,
          action: "BU award sent to CSO — approval pending",
          detail: `${crane.equipmentId} · ${buLabel(bu)} · ${reason}`,
          at,
        });
        message = `Award sent to CSO for ${buLabel(bu)}. Awaiting CSO approval (S06).`;
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
          // Strategy's award request is already its sign-off; the CSO is the only S06 decision-maker.
          if (user.role !== "CSO" && user.role !== "GLOBAL_ADMIN") {
            throw new Error("Only the CSO can approve this award.");
          }
          crane.award.csoRequired = true;
          if (!crane.award.strategyHeadApprovedBy) {
            crane.award.strategyHeadApprovedBy = crane.award.decidedBy || actor;
            crane.award.strategyHeadApprovedAt = crane.award.decidedAt || at;
          }
          crane.award.csoApprovedBy = actor;
          crane.award.csoApprovedAt = at;
          crane.award.approvedBy = actor;
          crane.award.approvedAt = at;
          crane.status = "S07";
          message = "CSO approved the award. Crane reserved (S07).";
          crane.approvals.push({ id: entryId("ap"), decision: "Approve BU award", approverRole: user.role as Role, approverName: actor, action: "APPROVED", comment, at });
          crane.audit.unshift({ id: entryId("a"), actor, actorRole: user.role as Role, action: "BU award approved", detail: `${crane.equipmentId} · ${buLabel(crane.award.bu)} · ${message}`, at });
        } else {
          const rejectedBu = buLabel(crane.award.bu);
          crane.csoRejectedBu = crane.award.bu;
          crane.award = null;
          crane.status = "S05";
          crane.approvals.push({ id: entryId("ap"), decision: "Reject BU award", approverRole: user.role as Role, approverName: actor, action: "REJECTED", comment, at });
          crane.audit.unshift({ id: entryId("a"), actor, actorRole: user.role as Role, action: "BU award rejected", detail: `${crane.equipmentId} · ${rejectedBu} · ${comment} · back to bid evaluation (S05)`, at });
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
        if (!saleQuoteStillValid(quote.date, at.slice(0, 10))) {
          throw new Error(`This quotation dated ${quote.date} is no longer valid. Attach a fresh quotation.`);
        }
        const revived = index === crane.selectedSaleQuoteIndex;
        if (revived) {
          quote.fpnaValidated = false;
          quote.validatedBy = null;
          quote.validatedAt = null;
        }
        crane.selectedSaleQuoteIndex = index;
        crane.status = "S10";
        crane.saleWindowStartedAt = at;
        if (crane.conflict) crane.conflict.saleWindowRestartedAt = null;
        const rejected = crane.saleQuotes.filter((entry, entryIndex) => {
          if (entryIndex === index || entry.rejectedBy) return false;
          entry.rejectedBy = actor;
          entry.rejectedAt = at;
          return true;
        });
        crane.audit.unshift({ id: entryId("a"), actor, actorRole: user.role as Role, action: revived ? "Old sale quotation revived" : "Sale quotation sent for price validation", detail: `${crane.equipmentId} · ${quote.buyer} · ₹${quote.value.toLocaleString("en-IN")}${rejected.length ? ` · ${rejected.length} other quotation${rejected.length === 1 ? "" : "s"} rejected by SCM` : ""}`, at });
        message = `${revived ? "Old quotation revived and " : ""}${quote.buyer}'s quotation sent to FP&A for price validation (S10).${rejected.length ? ` ${rejected.length} other quotation${rejected.length === 1 ? "" : "s"} rejected by SCM.` : ""}`;
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
          // Reopening the sale window puts every quotation back in play.
          for (const entry of crane.saleQuotes) {
            entry.rejectedBy = null;
            entry.rejectedAt = null;
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
        if (approve && crane.status === "S15") {
          crane.claimBack.rentalSoDueAt = addDays(at.slice(0, 10), RENTAL_SO_WINDOW_DAYS);
        }
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
          const ruleId = crane.conflict.ruleId;
          const saleConflict = ruleId === "SALE_VS_DOMESTIC" || ruleId === "SALE_VS_INTERNATIONAL";
          const claimWins = finalWinner === "Domestic" ||
            (ruleId === "SALE_VS_INTERNATIONAL" && finalWinner === "International");
          const domesticBuWin = ruleId === "DOMESTIC_VS_BU" && finalWinner === "Domestic";
          const internationalBuWin = ruleId === "DOMESTIC_VS_BU" && finalWinner === "International";

          crane.conflict.status = "RESOLVED";
          crane.conflict.winner = finalWinner;
          crane.conflict.reason = comment;
          crane.conflict.decidedByUser = actor;
          crane.conflict.decidedAt = at;
          crane.status = conflictOutcomeStatus(ruleId, finalWinner, {
            originStatus: crane.claimBack?.originStatus,
            hasAward: !!crane.award,
          });
          if (crane.claimBack?.status === "PENDING") {
            crane.claimBack.status = claimWins ? "APPROVED" : "REJECTED";
            crane.claimBack.decidedBy = actor;
            crane.claimBack.decidedAt = at;
          }
          const internationalRentalWins = ruleId === "SALE_VS_INTERNATIONAL" && claimWins;
          if (domesticBuWin) {
            // Domestic wins: every BU quote is closed and every BU is told.
            for (const quote of crane.buQuotes) {
              quote.closedAt = at;
              quote.closedReason = `Domestic rental won the conflict: ${comment}`;
            }
            crane.conflict.buQuotesClosedAt = at;
            crane.conflict.busNotifiedAt = at;
            // The BU route is over, so any pending award is void as well.
            crane.award = null;
            crane.csoRejectedBu = null;
          }
          if (claimWins && crane.status === "S15" && crane.claimBack) {
            crane.claimBack.rentalSoDueAt = addDays(at.slice(0, 10), RENTAL_SO_WINDOW_DAYS);
          }
          if (internationalRentalWins && crane.claimBack) {
            // Strategy has 15 days to reserve the crane and record the SAP asset
            // transfer; otherwise the crane returns to the sale window at S09.
            crane.claimBack.reservationDueAt = addDays(at.slice(0, 10), RENTAL_SO_WINDOW_DAYS);
          }
          if (saleConflict && !claimWins) {
            // Sale wins: the paused S10 clock starts again from this decision.
            crane.saleWindowStartedAt = at;
            crane.conflict.saleWindowRestartedAt = at;
            if (crane.claimBack) {
              crane.claimBack.rentalSoDueAt = null;
              crane.claimBack.reservationDueAt = null;
            }
          }
          crane.approvals.push({ id: entryId("ap"), decision: "Resolve conflict", approverRole: user.role as Role, approverName: actor, action: "APPROVED", comment, at });
          crane.audit.unshift({ id: entryId("a"), actor, actorRole: user.role as Role, action: "Conflict resolved", detail: `${crane.equipmentId} · winner ${finalWinner} · ${comment}${saleConflict && !claimWins ? " · claim-back rejected · S10 window clock restarted" : ""}${internationalRentalWins ? " · sale paused · SCM to notify buyer · Strategy to reserve and deploy (S07 → S16) within 15 days" : ""}${claimWins && !internationalRentalWins && saleConflict ? " · sale paused · SCM to notify buyer" : ""}${domesticBuWin ? ` · ${crane.buQuotes.length} BU quote(s) closed and all BUs notified` : ""}${internationalBuWin ? ` · domestic claim rejected · back to ${crane.status} · Strategy continues the BU award` : ""}`, at });
          message = saleConflict && !claimWins
            ? "Claim-back rejected. Sale approval resumes at S10 and the window clock has restarted."
            : internationalRentalWins
              ? "International rental wins. Sale approval is stopped; SCM must tell the buyer, then Strategy reserves the crane (S07) and deploys via SAP asset transfer (S16) within 15 days."
              : saleConflict && claimWins
                ? "Rental wins. Sale approval is stopped; SCM must tell the buyer and Sales has 15 days for the rental SO (S15)."
                : domesticBuWin
                  ? `Domestic wins. All ${crane.buQuotes.length} BU quote(s) are closed and every BU has been told. Crane moved to S15 for the rental SO (S17).`
                  : internationalBuWin
                    ? `Domestic claim rejected. Crane returned to ${crane.status} so Strategy can continue the BU award.`
                    : `Conflict resolved in favour of ${finalWinner}.`;
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
        if (crane.claimBack?.reservationDueAt) crane.claimBack.reservationDueAt = null;
        crane.audit.unshift({ id: entryId("a"), actor, actorRole: user.role as Role, action: "Sent to SAP — international transfer recorded", detail: `${crane.equipmentId} · asset transfer ${crane.sap.assetTransferNo} · locked (S16)`, at });
        message = `Sent to SAP · asset transfer ${crane.sap.assetTransferNo} recorded. Crane locked (S16).`;
      } else if (kind === "RECORD_SO") {
        crane.sap.soNumber = String(formData.get("soNumber") ?? "").trim() || crane.sap.soNumber;
        crane.sap.soStart = String(formData.get("soStart") ?? "").trim() || crane.sap.soStart;
        crane.sap.soEnd = String(formData.get("soEnd") ?? "").trim() || crane.sap.soEnd;
        crane.audit.unshift({ id: entryId("a"), actor, actorRole: user.role as Role, action: "SAP SO details recorded", detail: `${crane.equipmentId} · ${crane.sap.soNumber} · execution from ${crane.sap.soEnd ?? "immediately"}`, at });
        message = `SO recorded. Execution allowed from ${crane.sap.soEnd ?? "immediately"}.`;
      } else if (kind === "REQUEST_CLAIM_BACK") {
        const eligible = ["S04", "S05", "S06", "S07", "S08", "S09", "S10", "S11", "S12"];
        if (!eligible.includes(crane.status)) {
          throw new Error("A claim-back cannot be raised from this status.");
        }
        const team = user.role === "SALES" ? "Domestic" : "International";
        if (crane.flags.nonDeployable && !crane.maintenance.deployable) {
          throw new Error("Maintenance must mark this crane Deployable before it can be claimed back for rental.");
        }
        const customer = String(formData.get("customer") ?? "").trim();
        const rate = Number(formData.get("rate") ?? 0);
        const durationMonths = Number(formData.get("durationMonths") ?? 0);
        const expectedSoDate = String(formData.get("expectedSoDate") ?? "").trim();
        const reason = String(formData.get("reason") ?? "").trim();
        if (!customer || !(rate > 0) || !(durationMonths > 0) || !expectedSoDate || !reason) {
          throw new Error("Customer, rate, duration, expected SO date and reason are all mandatory.");
        }
        const selectedSaleQuote = crane.saleQuotes[crane.selectedSaleQuoteIndex ?? -1] ?? null;
        // A quotation only saved by SCM at S09 is not yet a live sale approval.
        // The sale-vs-rental conflicts start only after SCM sends it to FP&A (S10).
        const liveSaleQuote = crane.status === "S10" && !!selectedSaleQuote && !selectedSaleQuote.rejectedBy;
        const ruleId = claimConflictRule({
          team,
          hasSaleQuote: liveSaleQuote,
          hasBuQuote: crane.buQuotes.length > 0,
          hasAward: !!crane.award,
        });
        crane.claimBack = {
          team, customer, rate, durationMonths, expectedSoDate, reason,
          originStatus: crane.status,
          status: "PENDING",
          createdBy: actor,
          createdAt: at,
          decidedBy: null,
          decidedAt: null,
        };
        const originStatus = crane.status;
        if (ruleId) {
          const rule = CONFLICT_RULES.find((entry) => entry.id === ruleId);
          crane.conflict = {
            ruleId,
            title: rule?.title ?? "Conflict – decision pending",
            decidedBy: rule?.decidedBy ?? "Approver",
            status: "OPEN",
            winner: null,
            reason: null,
            decidedByUser: null,
            decidedAt: null,
            cboVote: null,
            csoVote: null,
            escalatedToMd: false,
            salePausedAt: ruleId === "SALE_VS_DOMESTIC" || ruleId === "SALE_VS_INTERNATIONAL" ? at : null,
            buyerNotifiedAt: null,
            buyerNotifiedBy: null,
          };
          crane.status = "S14";
          message = `Claim-back raised a conflict (${ruleId}). Crane paused at S14.`;
        } else {
          crane.status = "S13";
          message = `Claim-back sent for approval (S13). Origin ${originStatus} is preserved.`;
        }
        crane.audit.unshift({ id: entryId("a"), actor, actorRole: user.role as Role, action: "Claim-back requested", detail: `${crane.equipmentId} · ${team} · ${customer} · from ${originStatus} → ${crane.status}`, at });
      } else if (kind === "RECORD_RENTAL_SO") {
        if (crane.status !== "S15") throw new Error("A rental SO can only be recorded after an approved claim-back (S15).");
        if (crane.conflict?.ruleId === "SALE_VS_DOMESTIC" && !crane.conflict.buyerNotifiedAt) {
          throw new Error("SCM must tell the sale buyer that the rental won before the rental SO is recorded.");
        }
        const soNumber = String(formData.get("soNumber") ?? "").trim();
        if (!soNumber) throw new Error("Enter the SAP rental SO number.");
        crane.sap.soNumber = soNumber;
        crane.sap.soStart = String(formData.get("soStart") ?? "").trim() || crane.sap.soStart;
        crane.sap.soEnd = String(formData.get("soEnd") ?? "").trim() || crane.sap.soEnd;
        crane.status = "S17";
        if (crane.claimBack) crane.claimBack.rentalSoDueAt = null;
        crane.audit.unshift({ id: entryId("a"), actor, actorRole: user.role as Role, action: "Domestic rental SO recorded", detail: `${crane.equipmentId} · SO ${soNumber} · locked (S17)`, at });
        message = `Rental SO ${soNumber} recorded. Crane locked in SAP (S17).`;
      } else if (kind === "NOTIFY_SALE_BUYER") {
        const ruleId = crane.conflict?.ruleId;
        const domesticWin = ruleId === "SALE_VS_DOMESTIC" && crane.status === "S15" && crane.conflict?.winner === "Domestic";
        const internationalWin = ruleId === "SALE_VS_INTERNATIONAL" && crane.status === "S07" && crane.conflict?.winner === "International";
        if (!domesticWin && !internationalWin) {
          throw new Error("Buyer notice is only required after a rental wins a sale conflict.");
        }
        if (!crane.conflict || !crane.conflict.winner || crane.conflict.winner === "Sale") {
          throw new Error("This conflict did not end in a rental win.");
        }
        crane.conflict.buyerNotifiedAt = at;
        crane.conflict.buyerNotifiedBy = actor;
        const index = crane.selectedSaleQuoteIndex ?? -1;
        const buyer = crane.saleQuotes[index]?.buyer ?? "sale buyer";
        crane.audit.unshift({ id: entryId("a"), actor, actorRole: user.role as Role, action: "Sale buyer notified of rental win", detail: `${crane.equipmentId} · ${buyer} · ${comment}`, at });
        message = `${buyer} notified that the rental won. The sale approval stays stopped.`;
      } else if (kind === "NO_BUYER_TO_SCRAP") {
        if (crane.status !== "S09") throw new Error("Scrap approval can only be requested from the sale window (S09).");
        crane.status = "S11";
        crane.audit.unshift({ id: entryId("a"), actor, actorRole: user.role as Role, action: "No buyer — scrap approval requested", detail: `${crane.equipmentId} · sale window closed with no acceptable quotation`, at });
        message = "No acceptable buyer. Crane moved to MD scrap approval (S11).";
      } else if (kind === "SUBMIT_SCRAP_QUOTE") {
        if (crane.status !== "S12") throw new Error("Scrap quotations can only be gathered during scrap sale (S12).");
        if (crane.selectedScrapQuoteIndex !== null && crane.selectedScrapQuoteIndex !== undefined) {
          throw new Error("A scrap quotation has already been sent for validation. No further quotations can be added.");
        }
        const buyer = String(formData.get("buyer") ?? "").trim();
        const value = Number(formData.get("value") ?? 0);
        const date = String(formData.get("date") ?? "").trim();
        if (!buyer || !(value > 0) || !date) throw new Error("Enter the scrap buyer, a valid price and the quotation date.");
        crane.scrapQuotes = crane.scrapQuotes ?? [];
        crane.scrapQuotes.push({ buyer, value, date, fpnaValidated: false, validatedBy: null, validatedAt: null });
        crane.audit.unshift({ id: entryId("a"), actor, actorRole: user.role as Role, action: "Scrap quotation recorded", detail: `${crane.equipmentId} · ${buyer} · ₹${value.toLocaleString("en-IN")}`, at });
        message = `Scrap quotation from ${buyer} recorded.`;
      } else if (kind === "SELECT_SCRAP_QUOTE") {
        if (crane.status !== "S12") throw new Error("Select a scrap quotation only while the scrap sale is in progress (S12).");
        if (crane.selectedScrapQuoteIndex !== null && crane.selectedScrapQuoteIndex !== undefined) {
          throw new Error("A scrap quotation has already been sent for validation.");
        }
        const index = Number(formData.get("quoteIndex") ?? -1);
        if (!crane.scrapQuotes?.[index]) throw new Error("Select a recorded scrap quotation.");
        const chosen = crane.scrapQuotes[index];
        crane.selectedScrapQuoteIndex = index;
        const rejected = crane.scrapQuotes.filter((entry, entryIndex) => {
          if (entryIndex === index) return false;
          entry.rejectedBy = actor;
          entry.rejectedAt = at;
          return true;
        });
        crane.audit.unshift({ id: entryId("a"), actor, actorRole: user.role as Role, action: "Scrap quotation sent for price validation", detail: `${crane.equipmentId} · ${chosen.buyer}${rejected.length ? ` · ${rejected.length} other quotation${rejected.length === 1 ? "" : "s"} rejected by SCM` : ""}`, at });
        message = `${chosen.buyer}'s scrap quotation sent to FP&A.${rejected.length ? ` ${rejected.length} other quotation${rejected.length === 1 ? "" : "s"} rejected by SCM.` : ""}`;
      } else if (kind === "VALIDATE_SCRAP_PRICE") {
        if (crane.status !== "S12") throw new Error("Scrap price validation is only available at S12.");
        const quote = crane.scrapQuotes?.[crane.selectedScrapQuoteIndex ?? -1];
        if (!quote) throw new Error("No scrap quotation was sent for validation.");
        quote.fpnaValidated = true;
        quote.validatedBy = actor;
        quote.validatedAt = at;
        crane.approvals.push({ id: entryId("ap"), decision: "Validate scrap price", approverRole: user.role as Role, approverName: actor, action: "APPROVED", comment, at });
        crane.audit.unshift({ id: entryId("a"), actor, actorRole: user.role as Role, action: "Scrap price validated by FP&A", detail: `${crane.equipmentId} · ${quote.buyer} · ₹${quote.value.toLocaleString("en-IN")} · ${comment}`, at });
        message = `Scrap price validated for ${quote.buyer}. SCM can now create the scrap SO.`;
      } else if (kind === "RECORD_SCRAP_SO") {
        if (crane.status !== "S12") throw new Error("A scrap SO can only be recorded at S12.");
        const quote = crane.scrapQuotes?.[crane.selectedScrapQuoteIndex ?? -1];
        if (!quote?.fpnaValidated) throw new Error("FP&A must validate the scrap price first.");
        const soNumber = String(formData.get("soNumber") ?? "").trim();
        if (!soNumber) throw new Error("Enter the SAP scrap sale SO number.");
        crane.sap.soNumber = soNumber;
        crane.sap.soStart = String(formData.get("soStart") ?? "").trim() || crane.sap.soStart;
        crane.sap.soEnd = String(formData.get("soEnd") ?? "").trim() || crane.sap.soEnd;
        crane.status = "S19";
        crane.audit.unshift({ id: entryId("a"), actor, actorRole: user.role as Role, action: "Scrap sale SO recorded", detail: `${crane.equipmentId} · SO ${soNumber} · locked (S19)`, at });
        message = `Scrap sale SO ${soNumber} recorded. Crane locked in SAP (S19).`;
      }
      if (!STATUS_MAP[crane.status]) throw new Error("Invalid status produced.");
    });
  } catch (error) {
    return { error: error instanceof Error ? error.message : "The action could not be completed." };
  }

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
  if (marketable === "Marketable" && !(expectedMonths && expectedMonths > 0)) {
    return { error: "Expected deployment duration is mandatory for a marketable crane." };
  }
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
      // Only non-marketable cranes enter Finance dedup. Marketable cranes stay at S01.
      if (crane.maintenance.submittedBy && marketable === "Not marketable") crane.status = "S02";
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
      // Maintenance decides deployability either way; only non-marketable cranes move on.
      if (crane.sales.submittedBy && crane.sales.marketable === "Not marketable") crane.status = "S02";
      reviewed += 1;
    }
  });

  revalidatePath("/");
  revalidatePath("/cranes");
  revalidatePath("/approvals");
  return { ok: `${reviewed} crane${reviewed === 1 ? "" : "s"} reviewed by Maintenance.` };
}

/** Strategy: close the BU route for several cranes and send them to Marketing catalogue (S08). */
export async function bulkStrategyToMarketingAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  if (!["STRATEGY", "GLOBAL_ADMIN"].includes(user.role)) {
    return { error: "Only the Strategy team can send cranes to Marketing catalogue." };
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
  const comment = String(formData.get("comment") ?? "").trim();

  let moved = 0;
  await mutate((state) => {
    const targets = ids.map((id) =>
      state.cranes.find((crane) => crane.id === id || crane.equipmentId === id),
    );
    if (targets.some((crane) => !crane)) throw new Error("One or more cranes were not found.");
    if (targets.some((crane) => !["S04", "S05"].includes((crane as Crane).status))) {
      throw new Error("Only cranes offered to BUs (S04) or in bid evaluation (S05) can be sent to Marketing catalogue.");
    }
    if (targets.some((crane) => state.cycles.find((cycle) => cycle.id === (crane as Crane).cycleId)?.status === "CLOSED")) {
      throw new Error("This cycle is stopped. No changes are allowed.");
    }

    const at = now();
    const actor = user.name;
    for (const crane of targets as Crane[]) {
      crane.status = "S08";
      crane.audit.unshift({
        id: entryId("a"), actor, actorRole: user.role as Role,
        action: "No BU taker — sent to sale (bulk)",
        detail: `${crane.equipmentId} · BU window closed by Strategy${comment ? ` · ${comment}` : ""}`,
        at,
      });
      moved += 1;
    }
  });

  revalidatePath("/");
  revalidatePath("/cranes");
  revalidatePath("/approvals");
  return { ok: `${moved} crane${moved === 1 ? "" : "s"} sent to Marketing catalogue (S08).` };
}

/** SCM: move several S09 cranes to scrap approval (S11) when no acceptable buyer was found. */
export async function bulkScmToScrapAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  if (!["SCM", "GLOBAL_ADMIN"].includes(user.role)) {
    return { error: "Only the SCM team can request scrap approval." };
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
  const comment = String(formData.get("comment") ?? "").trim();

  let moved = 0;
  try {
    await mutate((state) => {
      const targets = ids.map((id) =>
        state.cranes.find((crane) => crane.id === id || crane.equipmentId === id),
      );
      if (targets.some((crane) => !crane)) throw new Error("One or more cranes were not found.");
      if (targets.some((crane) => (crane as Crane).status !== "S09")) {
        throw new Error("Only cranes listed for sale (S09) can be moved to scrap approval.");
      }
      if (targets.some((crane) => state.cycles.find((cycle) => cycle.id === (crane as Crane).cycleId)?.status === "CLOSED")) {
        throw new Error("This cycle is stopped. No changes are allowed.");
      }

      const at = now();
      const actor = user.name;
      for (const crane of targets as Crane[]) {
        crane.status = "S11";
        crane.audit.unshift({
          id: entryId("a"), actor, actorRole: user.role as Role,
          action: "No buyer — scrap approval requested (bulk)",
          detail: `${crane.equipmentId} · sale window closed with no acceptable quotation${comment ? ` · ${comment}` : ""}`,
          at,
        });
        moved += 1;
      }
    });
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not move the cranes to scrap approval." };
  }

  revalidatePath("/");
  revalidatePath("/cranes");
  revalidatePath("/approvals");
  return { ok: `${moved} crane${moved === 1 ? "" : "s"} moved to MD scrap approval (S11).` };
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
      const result = crane.finalOverride
        ? routeForCategory(crane.finalOverride.category)
        : dedupe(crane.flags);
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
        invitedBus: [],
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
