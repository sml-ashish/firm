/**
 * FIRM business-process domain, derived from
 * `FIRM_Business_Process_Document- Final.docx` (November 2026).
 *
 * This module is deliberately free of Node-only imports so both server and
 * client components can use the same status, role and rule definitions.
 */

export type Role =
  | "FPNA"
  | "SALES"
  | "MAINTENANCE"
  | "FINANCE"
  | "STRATEGY"
  | "BU"
  | "MARKETING"
  | "SCM"
  | "CBO"
  | "CSO"
  | "MD"
  | "GLOBAL_ADMIN";

export type StatusCode =
  | "S01" | "S02" | "S03" | "S04" | "S05" | "S06" | "S07" | "S08" | "S09" | "S10"
  | "S11" | "S12" | "S13" | "S14" | "S15" | "S16" | "S17" | "S18" | "S19" | "S20";

export type StatusType = "Active" | "Approval" | "On Hold" | "Locked" | "Closed";
export type Layer = "L1" | "L2" | "L3" | "L4" | "L5" | "L6" | "L7" | "L8" | "Any" | "L4 or L7" | "–";

export interface StatusMeta {
  code: StatusCode;
  name: string;
  layer: Layer;
  type: StatusType;
  impact: "Carry forward" | "Exclude";
  tone: "slate" | "brand" | "amber" | "violet" | "red" | "green";
  hint: string;
}

/** Section 12.1 — the 20 crane statuses. */
export const STATUSES: StatusMeta[] = [
  { code: "S01", name: "Pending Validation", layer: "L1", type: "Active", impact: "Carry forward", tone: "slate", hint: "Sales and Maintenance checks are open in parallel." },
  { code: "S02", name: "Under Finance Review", layer: "L1", type: "Approval", impact: "Carry forward", tone: "amber", hint: "All three inputs are in; Finance deduplicates and finalises." },
  { code: "S03", name: "Not Flagged – Excluded", layer: "L2", type: "Closed", impact: "Exclude", tone: "slate", hint: "No flag after dedup — the crane stays in the active fleet." },
  { code: "S04", name: "Offered to International BUs", layer: "L3", type: "Active", impact: "Carry forward", tone: "brand", hint: "Strategy has floated the crane to every international BU." },
  { code: "S05", name: "BU Bid Evaluation", layer: "L4", type: "Active", impact: "Carry forward", tone: "brand", hint: "BUs have responded; quotes can still be revised until the window closes." },
  { code: "S06", name: "BU Award Approval Pending", layer: "L4", type: "Approval", impact: "Carry forward", tone: "amber", hint: "Awaiting CSO decision on Strategy's award request." },
  { code: "S07", name: "Reserved – Pending Deployment", layer: "L4", type: "Active", impact: "Carry forward", tone: "violet", hint: "Awarded to a BU. No SO yet — still claimable before transfer." },
  { code: "S08", name: "Catalogue Preparation", layer: "L5", type: "Active", impact: "Carry forward", tone: "violet", hint: "Marketing catalogue window, proposed 5 working days." },
  { code: "S09", name: "Listed for Sale", layer: "L6", type: "Active", impact: "Carry forward", tone: "brand", hint: "SCM is gathering domestic and international quotations." },
  { code: "S10", name: "Sale Approval Pending", layer: "L7", type: "Approval", impact: "Carry forward", tone: "amber", hint: "FP&A has validated price; management approval is next." },
  { code: "S11", name: "Scrap Approval Pending", layer: "L7", type: "Approval", impact: "Carry forward", tone: "amber", hint: "No buyer in the sale window; management decides on scrap." },
  { code: "S12", name: "Scrap Sale in Progress", layer: "L7", type: "Active", impact: "Carry forward", tone: "violet", hint: "SCM is running the scrap sale; FP&A validates the price." },
  { code: "S13", name: "Claim-Back Approval Pending", layer: "Any", type: "Approval", impact: "Carry forward", tone: "amber", hint: "A rental claim-back is waiting for the required approver." },
  { code: "S14", name: "Conflict – Decision Pending", layer: "L4 or L7", type: "On Hold", impact: "Carry forward", tone: "red", hint: "Everything is paused; decision due in 3 working days." },
  { code: "S15", name: "Claimed Back – Rental SO Pending", layer: "Any", type: "Active", impact: "Carry forward", tone: "violet", hint: "Rental won. SO must be created within 15 days." },
  { code: "S16", name: "Completed – International Transfer", layer: "L8", type: "Locked", impact: "Exclude", tone: "green", hint: "SAP asset transfer recorded. Cannot be claimed back." },
  { code: "S17", name: "Completed – Domestic Rental", layer: "L8", type: "Locked", impact: "Exclude", tone: "green", hint: "Rental SO created in SAP. Cannot be claimed back." },
  { code: "S18", name: "Completed – Sold", layer: "L8", type: "Locked", impact: "Exclude", tone: "green", hint: "Sale SO created in SAP. Cannot be claimed back." },
  { code: "S19", name: "Completed – Scrapped", layer: "L8", type: "Locked", impact: "Exclude", tone: "green", hint: "Scrap sale SO created in SAP. Cannot be claimed back." },
  { code: "S20", name: "Scrap Not Approved – Carried Forward", layer: "–", type: "Closed", impact: "Carry forward", tone: "slate", hint: "Management declined scrap; the crane returns next cycle." },
];

export const STATUS_MAP: Record<StatusCode, StatusMeta> = Object.fromEntries(
  STATUSES.map((status) => [status.code, status]),
) as Record<StatusCode, StatusMeta>;

export const isLocked = (code: StatusCode) => STATUS_MAP[code].type === "Locked";
export const isApproval = (code: StatusCode) => STATUS_MAP[code].type === "Approval";

export interface RoleMeta {
  role: Role;
  name: string;
  short: string;
  description: string;
  tone: "slate" | "brand" | "amber" | "violet" | "red" | "green";
}

/** Section 2 — the 12 roles in the cycle. */
export const ROLES: RoleMeta[] = [
  { role: "FPNA", name: "FP&A", short: "FP&A", description: "Starts the cycle, uploads the fleet and validates sale price before management approval.", tone: "brand" },
  { role: "SALES", name: "Sales Team (Domestic)", short: "Sales", description: "Confirms marketability, flags NRG, sets expected deployment duration and can claim a crane back before SO.", tone: "violet" },
  { role: "MAINTENANCE", name: "Maintenance Team", short: "Maintenance", description: "Marks every crane Deployable or Non-Deployable, with a reason.", tone: "amber" },
  { role: "FINANCE", name: "Finance", short: "Finance", description: "Deduplicates the three inputs, finalises the FIRM list and closes exited cranes.", tone: "brand" },
  { role: "STRATEGY", name: "Strategy Team (International)", short: "Strategy", description: "Floats Old Fleet and NRG cranes to all international BUs, evaluates quotes and awards.", tone: "violet" },
  { role: "BU", name: "International BU", short: "Intl. BU", description: "Decides whether to take a crane on rental and submits an indicative quote.", tone: "green" },
  { role: "MARKETING", name: "Marketing Team", short: "Marketing", description: "Uploads the crane catalogue within the window before SCM.", tone: "slate" },
  { role: "SCM", name: "SCM Team", short: "SCM", description: "Runs domestic and international sale and scrap sale, and brings quotations for approval.", tone: "amber" },
  { role: "CBO", name: "CBO", short: "CBO", description: "Final call when a sale quotation competes with domestic rental; decides claim-backs and conflicts.", tone: "red" },
  { role: "CSO", name: "CSO", short: "CSO", description: "Final call and exception approval when international rental competes with a sale quotation.", tone: "red" },
  { role: "MD", name: "MD", short: "MD", description: "Approves sale, scrap sale and exceptions per Section 7.", tone: "green" },
  { role: "GLOBAL_ADMIN", name: "Global Administrator", short: "Admin", description: "Sees every crane in the cycle, sends reminders and escalates; takes no business calls.", tone: "slate" },
];

export const ROLE_MAP: Record<Role, RoleMeta> = Object.fromEntries(
  ROLES.map((entry) => [entry.role, entry]),
) as Record<Role, RoleMeta>;

/** Section 4 — dedup. Non-Deployable wins; otherwise Old Fleet beats NRG. */
export type FinalCategory = "OLD_FLEET" | "NRG" | "NON_DEPLOYABLE" | "NOT_IN_FIRM";

export interface Flags {
  oldFleet: boolean;
  nrg: boolean;
  nonDeployable: boolean;
}

export interface DedupResult {
  category: FinalCategory;
  route: string;
  status: StatusCode;
}

export const CATEGORY_LABEL: Record<FinalCategory, string> = {
  OLD_FLEET: "Old Fleet",
  NRG: "Non-Revenue Generating",
  NON_DEPLOYABLE: "Non-Deployable",
  NOT_IN_FIRM: "Not in FIRM",
};

export function dedupe(flags: Flags): DedupResult {
  if (flags.nonDeployable) {
    return { category: "NON_DEPLOYABLE", route: "Sale (then scrap sale if unsold)", status: "S08" };
  }
  if (flags.oldFleet) {
    return { category: "OLD_FLEET", route: "Strategy – international rental", status: "S04" };
  }
  if (flags.nrg) {
    return { category: "NRG", route: "Strategy – international rental", status: "S04" };
  }
  return { category: "NOT_IN_FIRM", route: "Stays in active fleet", status: "S03" };
}

/** Route a Finance override without changing the original Sales/Maintenance flags. */
export function routeForCategory(category: FinalCategory): DedupResult {
  switch (category) {
    case "NON_DEPLOYABLE":
      return { category, route: "Sale (then scrap sale if unsold)", status: "S08" };
    case "OLD_FLEET":
    case "NRG":
      return { category, route: "Strategy – international rental", status: "S04" };
    default:
      return { category, route: "Stays in active fleet", status: "S03" };
  }
}

/** Detect the Section 6.1 conflict raised by a claim-back on a live deal. */
export function claimConflictRule(input: {
  team: string;
  hasSaleQuote?: boolean;
  hasBuQuote?: boolean;
  hasAward?: boolean;
}): string | null {
  const international = /international|strategy|BU/i.test(input.team);
  if (input.hasSaleQuote) {
    return international ? "SALE_VS_INTERNATIONAL" : "SALE_VS_DOMESTIC";
  }
  if (!international && (input.hasBuQuote || input.hasAward)) {
    return "DOMESTIC_VS_BU";
  }
  return null;
}

/** Section 7 — who approves each decision. */
export const APPROVAL_MATRIX: { decision: string; preparedBy: string; approvedBy: string; note?: string }[] = [
  { decision: "Final FIRM list after deduplication", preparedBy: "Finance", approvedBy: "Finance Head" },
  { decision: "Award crane to a BU for international rental", preparedBy: "Strategy", approvedBy: "CSO when Strategy sends the award for approval" },
  { decision: "Move crane from Strategy to sale (no BU interest)", preparedBy: "Strategy", approvedBy: "Automatic at end of BU window" },
  { decision: "Sale", preparedBy: "SCM; FP&A validates price", approvedBy: "MD" },
  { decision: "Scrap sale", preparedBy: "SCM; FP&A validates scrap price", approvedBy: "MD" },
  { decision: "Claim-back by layer", preparedBy: "Sales or Strategy", approvedBy: "As per claim-back rules" },
  { decision: "Exception: international rental over a sale quotation", preparedBy: "Strategy", approvedBy: "CSO" },
  { decision: "Exception: domestic rental over a sale quotation", preparedBy: "Sales", approvedBy: "CBO" },
];

/** Section 6 — conflict decisions and their approvers. */
export const CONFLICT_RULES = [
  {
    id: "SALE_VS_DOMESTIC",
    title: "Sale quotation vs domestic rental",
    decidedBy: "CBO",
    from: "S10 → S14",
    rentalWins: "S14 → S15 — stop sale, tell buyer, Sales creates rental SO (S17). No SO in 15 days → S09.",
    otherWins: "S14 → S10 — claim rejected, sale approval resumes.",
  },
  {
    id: "SALE_VS_INTERNATIONAL",
    title: "Sale quotation vs international rental",
    decidedBy: "CSO",
    from: "S10 → S14",
    rentalWins: "S14 → S07 — stop sale, Strategy reserves for BU and transfers via SAP (S16). Not reserved in 15 days → S09.",
    otherWins: "S14 → S10 — claim rejected, sale approval resumes.",
  },
  {
    id: "DOMESTIC_VS_BU",
    title: "Domestic claim-back vs BU quote or award",
    decidedBy: "CBO and CSO together; CEO if they disagree",
    from: "S05 / S07 → S14",
    rentalWins: "S14 → S15 — close BU quotes, tell all BUs, Sales creates rental SO (S17).",
    otherWins: "S14 → S05 / S07 — domestic claim rejected, Strategy continues the award.",
  },
  {
    id: "BU_VS_BU",
    title: "Two BU's want the same crane",
    decidedBy: "Strategy",
    from: "Stays S05 — no conflict status",
    rentalWins: "Selected BU: S05 → S07; other BUs told 'not awarded'.",
    otherWins: "–",
  },
] as const;

/** Outcome options and target status for each conflict rule (Section 6.1). */
export function conflictOptions(ruleId: string | undefined): { value: string; label: string }[] {
  switch (ruleId) {
    case "SALE_VS_DOMESTIC":
      return [
        { value: "Domestic", label: "Domestic rental" },
        { value: "Sale", label: "Sale" },
      ];
    case "SALE_VS_INTERNATIONAL":
      return [
        { value: "International", label: "International rental" },
        { value: "Sale", label: "Sale" },
      ];
    case "DOMESTIC_VS_BU":
      return [
        { value: "Domestic", label: "Domestic rental" },
        { value: "International", label: "International BU" },
      ];
    case "BU_VS_BU":
      return [
        { value: "BU", label: "Selected BU" },
        { value: "Sale", label: "Sale" },
      ];
    default:
      return [
        { value: "Rental", label: "Rental" },
        { value: "Sale", label: "Sale" },
      ];
  }
}

/** Roles allowed to decide a conflict, per Section 6.1. */
export function conflictApprovers(ruleId: string | undefined): string[] {
  switch (ruleId) {
    case "SALE_VS_DOMESTIC": return ["CBO", "GLOBAL_ADMIN"];
    case "SALE_VS_INTERNATIONAL": return ["CSO", "GLOBAL_ADMIN"];
    case "DOMESTIC_VS_BU": return ["CBO", "CSO", "MD", "GLOBAL_ADMIN"];
    case "BU_VS_BU": return ["STRATEGY", "GLOBAL_ADMIN"];
    default: return ["CBO", "CSO", "STRATEGY", "MD", "GLOBAL_ADMIN"];
  }
}

/** Map a conflict decision to the status required by the business document. */
export function conflictOutcomeStatus(
  ruleId: string | undefined,
  winner: string,
  context: { originStatus?: string | null; hasAward?: boolean } = {},
): StatusCode {
  if (ruleId === "SALE_VS_INTERNATIONAL") {
    return winner === "Sale" ? "S10" : "S07";
  }
  if (ruleId === "DOMESTIC_VS_BU") {
    if (winner === "Domestic") return "S15";
    return context.originStatus === "S05" ? "S05" : "S07";
  }
  if (ruleId === "SALE_VS_DOMESTIC") {
    return winner === "Sale" ? "S10" : "S15";
  }
  return winner === "Sale" ? "S10" : "S15";
}

/** Claim-back sign-off follows the team that raised it (Section 6.5 / Section 7). */
export function claimApprovers(team: string | undefined): string[] {
  return /international|strategy|BU/i.test(team ?? "")
    ? ["CSO", "STRATEGY", "GLOBAL_ADMIN"]
    : ["CBO", "SALES", "GLOBAL_ADMIN"];
}

/** Approved international claims reserve for a BU; domestic claims await a rental SO. */
export function claimTargetStatus(team: string | undefined): StatusCode {
  return /international|strategy|BU/i.test(team ?? "") ? "S07" : "S15";
}

/** Section 11 — the crane fields the team supplies at upload. */
export const UPLOAD_FIELDS = [
  { key: "equipmentId", label: "Equipment ID", mandatory: true, hint: "Unique crane identifier from the asset register." },
  { key: "description", label: "Equipment Description", mandatory: true, hint: "Free text describing the crane." },
  { key: "yom", label: "YOM", mandatory: true, hint: "Year of manufacture — age and the Old Fleet flag are derived from this." },
  { key: "yieldPct", label: "Yield %", mandatory: true, hint: "Monthly yield percentage." },
  { key: "utilisationPct", label: "Utilisation %", mandatory: true, hint: "Utilisation percentage." },
] as const;

/**
 * SAP fields. The document specifies these are pulled from SAP. This build has
 * no SAP connection, so they are entered in the upload sheet instead.
 */
export const SAP_UPLOAD_FIELDS = [
  { key: "sapStatus", label: "SAP Status", values: "On rent / Idle / Sold" },
  { key: "soNumber", label: "SO Number", values: "Existing sales order, if any" },
  { key: "soStart", label: "SO Start Date", values: "Required when an SO Number is present" },
  { key: "soEnd", label: "SO End Date", values: "Becomes 'Execution allowed from'" },
] as const;

export const SAP_FIELDS = [
  "Current status (on rent / idle / sold)",
  "SO number",
  "SO start date",
  "SO end date → Execution allowed from",
  "Asset transfer document number (international deployment)",
] as const;

/**
 * System NRG/RG classification applied at upload: a crane is NRG only when
 * BOTH utilisation and monthly yield stay below the thresholds; otherwise RG.
 */
export const NRG_UTILISATION_MAX = 60;
export const NRG_YIELD_MAX = 1.8;
export function isNrg(yieldPct: number, utilisationPct: number): boolean {
  return utilisationPct < NRG_UTILISATION_MAX && yieldPct < NRG_YIELD_MAX;
}

/** Section 1 — no new SO, deployment or handover before the current SO ends. */
export function executionAllowedFrom(soEndDate: string | null): string | null {
  return soEndDate || null;
}

export function canExecute(
  soEndDate: string | null,
  today = new Date().toISOString().slice(0, 10),
): boolean {
  if (!soEndDate) return true;
  return soEndDate <= today;
}

/** Section 6.1 — a rental win has 15 days to produce an SO before S09 reopens. */
export const RENTAL_SO_WINDOW_DAYS = 15;
/** A held sale quotation can only be revived inside its 15-day validity window. */
export const SALE_QUOTE_VALID_DAYS = 15;

/** Add calendar days to a yyyy-mm-dd date without pulling in a date library. */
export function addDays(date: string, days: number): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return date;
  const value = new Date(`${date}T00:00:00Z`);
  if (Number.isNaN(value.getTime())) return date;
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

/** True while a dated sale quotation is still inside its validity window. */
export function saleQuoteStillValid(
  quoteDate: string | undefined | null,
  today = new Date().toISOString().slice(0, 10),
): boolean {
  if (!quoteDate || !/^\d{4}-\d{2}-\d{2}$/.test(quoteDate)) return false;
  return quoteDate <= today && today <= addDays(quoteDate, SALE_QUOTE_VALID_DAYS);
}
