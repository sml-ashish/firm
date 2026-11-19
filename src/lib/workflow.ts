/**
 * Workflow constants shared by server and client components.
 * Kept free of database / node-only imports so it can be bundled in the browser.
 */

export type Role = "ADMIN" | "PREPARER" | "REVIEWER" | "APPROVER";

export const STAGE_ROLES: Record<string, Role[]> = {
  PREPARED: ["PREPARER"],
  REVIEWED: ["REVIEWER"],
  APPROVED: ["APPROVER"],
};

export const STAGE_LABELS: Record<string, string> = {
  PREPARED: "Prepared",
  REVIEWED: "Reviewed",
  APPROVED: "Approved",
};

export const RUN_STATUS_LABELS: Record<string, string> = {
  PENDING: "Pending preparation",
  PREPARED: "Pending review",
  REVIEWED: "Pending approval",
  APPROVED: "Approved",
  RETURNED: "Returned for rework",
};

export function nextStage(status: string): string | null {
  if (status === "PENDING") return "PREPARED";
  if (status === "PREPARED") return "REVIEWED";
  if (status === "REVIEWED") return "APPROVED";
  return null;
}
