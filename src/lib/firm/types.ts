import type { Role, StatusCode, FinalCategory, Flags } from "./workflow";

export interface SapData {
  currentStatus: "On rent" | "Idle" | "Sold";
  soNumber: string | null;
  soStart: string | null;
  soEnd: string | null;
  assetTransferNo: string | null;
}

export interface SalesCheck {
  marketable: "Marketable" | "Not marketable" | null;
  nrg: boolean | null;
  expectedMonths: number | null;
  remarks: string | null;
  submittedBy: string | null;
  submittedAt: string | null;
}

export interface MaintenanceCheck {
  deployable: boolean | null;
  reason: string | null;
  submittedBy: string | null;
  submittedAt: string | null;
}

export interface BuQuote {
  bu: string;
  interested: boolean;
  ratePerMonth: number | null;
  durationMonths: number | null;
  expectedYieldPct: number | null;
  earliestStart: string | null;
  customer: string | null;
  country: string | null;
  revisedAt: string;
}

export interface Award {
  bu: string;
  reason: string;
  decidedBy: string;
  decidedAt: string;
  /** True when the awarded yield is below the crane's expected rate; CSO must also sign off. */
  csoRequired?: boolean;
  strategyHeadApprovedBy?: string | null;
  strategyHeadApprovedAt?: string | null;
  csoApprovedBy?: string | null;
  csoApprovedAt?: string | null;
  approvedBy: string | null;
  approvedAt: string | null;
}

export interface SaleQuote {
  buyer: string;
  market: "Domestic" | "International";
  value: number;
  date: string;
  fpnaValidated: boolean;
  validatedBy: string | null;
  validatedAt?: string | null;
}

export interface ScrapQuote {
  buyer: string;
  value: number;
  date: string;
  fpnaValidated: boolean;
  validatedBy: string | null;
  validatedAt?: string | null;
}

export interface ClaimBack {
  team: string;
  customer: string;
  rate: number;
  durationMonths: number;
  expectedSoDate: string;
  reason: string;
  /** Layer the crane was pulled from; a rejected claim returns here. */
  originStatus?: StatusCode | null;
  status: "PENDING" | "APPROVED" | "REJECTED";
  createdBy: string;
  createdAt: string;
  decidedBy: string | null;
  decidedAt: string | null;
}

export interface Conflict {
  ruleId: string;
  title: string;
  decidedBy: string;
  status: "OPEN" | "RESOLVED";
  winner: string | null;
  reason: string | null;
  decidedByUser: string | null;
  decidedAt: string | null;
  /** DOMESTIC_VS_BU needs CBO and CSO agreement; MD/CEO decides a split call. */
  cboVote?: string | null;
  csoVote?: string | null;
  escalatedToMd?: boolean;
}

export interface ApprovalEntry {
  id: string;
  decision: string;
  approverRole: Role;
  approverName: string;
  action: "APPROVED" | "REJECTED";
  comment: string;
  at: string;
}

export interface AuditEntry {
  id: string;
  actor: string;
  actorRole: Role;
  action: string;
  detail: string;
  at: string;
}

export interface CatalogueAttachment {
  label: string;
  filename: string;
  url: string;
  size: number;
  mime: string;
}

export interface Crane {
  id: string;
  equipmentId: string;
  description: string;
  yom: number;
  yieldPct: number;
  utilisationPct: number;
  age: number;
  oldFleet: boolean;
  cycleId: string;
  status: StatusCode;
  flags: Flags;
  finalCategory: FinalCategory | null;
  finalOverride: { category: FinalCategory; reason: string; by: string; at: string } | null;
  sap: SapData;
  sales: SalesCheck;
  maintenance: MaintenanceCheck;
  buQuotes: BuQuote[];
  award: Award | null;
  catalogue: {
    uploaded: boolean;
    files: string[];
    attachments?: CatalogueAttachment[];
    uploadedBy: string | null;
    at: string | null;
  };
  saleQuotes: SaleQuote[];
  /** Index of the quote SCM sent for FP&A price validation / management approval. */
  selectedSaleQuoteIndex?: number | null;
  scrapQuotes?: ScrapQuote[];
  selectedScrapQuoteIndex?: number | null;
  claimBack: ClaimBack | null;
  conflict: Conflict | null;
  approvals: ApprovalEntry[];
  audit: AuditEntry[];
}

export interface Cycle {
  id: string;
  name: string;
  openedAt: string;
  openedBy: string;
  evaluationDate: string;
  startDate: string | null;
  endDate: string | null;
  status: "OPEN" | "CLOSED";
}

export interface FirmUser {
  id: number;
  name: string;
  email: string;
  role: Role;
  designation: string;
}

export interface CraneFilters {
  q?: string;
  status?: string;
  layer?: string;
  category?: string;
  type?: string;
  cycleId?: string;
  role?: string;
}

export interface CraneListResult {
  rows: Crane[];
  total: number;
  byStatus: { code: StatusCode; count: number }[];
  byCategory: { category: FinalCategory | "ALL"; count: number }[];
  counts: {
    all: number;
    active: number;
    approval: number;
    conflict: number;
    locked: number;
    closed: number;
  };
}

export interface DashboardData {
  cycle: Cycle | null;
  cranes: Crane[];
  total: number;
  byStatus: { code: StatusCode; count: number }[];
  byLayer: { layer: string; count: number }[];
  approvals: number;
  conflicts: number;
  locked: number;
  reminders: { crane: Crane; reason: string; sinceDays: number }[];
}

export interface ApprovalItem {
  crane: Crane;
  decision: string;
  approverRole: Role;
  note: string;
}
