/**
 * Policy parameters. Every number that drives a classification is stored in the
 * database (settings table) so that a policy revision does not require a code
 * change. Defaults mirror the FIRM definition document.
 */

export type ObsoleteScope = "old_fleet_only" | "all";

export interface Policy {
  /** Old Fleet: equipment age (YOM) must exceed this many years. */
  oldFleetYears: number;
  /** NRG Condition 1: utilisation must stay below this percentage. */
  nrgUtilPct: number;
  /**
   * NRG Condition 1: monthly yield on capital employed, in percent.
   * yield = (annual rental revenue / capital employed) / 12 * 100
   */
  nrgYieldPct: number;
  /** NRG Condition 1: number of consecutive trailing years required. */
  nrgYears: number;
  /** Non-Deployable: repair cost as a percentage of replacement capex. */
  repairPct: number;
  /** Non-Deployable: grace period after a certificate expiry, in days. */
  certGraceDays: number;
  /**
   * The obsolescence triggers (OEM support / spares / compliance / repair cost)
   * are worded under "Any crane in the Old Fleet". Keep this as
   * "old_fleet_only" for a literal reading; switch to "all" to apply them to
   * every crane.
   */
  obsoleteScope: ObsoleteScope;
}

export const POLICY_DEFAULTS: Policy = {
  oldFleetYears: 15,
  nrgUtilPct: 60,
  nrgYieldPct: 1.8,
  nrgYears: 3,
  repairPct: 25,
  certGraceDays: 30,
  obsoleteScope: "old_fleet_only",
};

export const POLICY_LIMITS = {
  oldFleetYears: { min: 1, max: 60 },
  nrgUtilPct: { min: 0, max: 100 },
  nrgYieldPct: { min: 0, max: 100 },
  nrgYears: { min: 1, max: 10 },
  repairPct: { min: 0, max: 100 },
  certGraceDays: { min: 0, max: 365 },
} as const;

export function sanitizePolicy(input: Partial<Policy>): Policy {
  const num = (value: unknown, fallback: number, min: number, max: number) => {
    const parsed = typeof value === "number" ? value : Number(value);
    if (!Number.isFinite(parsed)) return fallback;
    return Math.min(max, Math.max(min, parsed));
  };

  return {
    oldFleetYears: num(
      input.oldFleetYears,
      POLICY_DEFAULTS.oldFleetYears,
      POLICY_LIMITS.oldFleetYears.min,
      POLICY_LIMITS.oldFleetYears.max,
    ),
    nrgUtilPct: num(
      input.nrgUtilPct,
      POLICY_DEFAULTS.nrgUtilPct,
      POLICY_LIMITS.nrgUtilPct.min,
      POLICY_LIMITS.nrgUtilPct.max,
    ),
    nrgYieldPct: num(
      input.nrgYieldPct,
      POLICY_DEFAULTS.nrgYieldPct,
      POLICY_LIMITS.nrgYieldPct.min,
      POLICY_LIMITS.nrgYieldPct.max,
    ),
    nrgYears: Math.round(
      num(
        input.nrgYears,
        POLICY_DEFAULTS.nrgYears,
        POLICY_LIMITS.nrgYears.min,
        POLICY_LIMITS.nrgYears.max,
      ),
    ),
    repairPct: num(
      input.repairPct,
      POLICY_DEFAULTS.repairPct,
      POLICY_LIMITS.repairPct.min,
      POLICY_LIMITS.repairPct.max,
    ),
    certGraceDays: Math.round(
      num(
        input.certGraceDays,
        POLICY_DEFAULTS.certGraceDays,
        POLICY_LIMITS.certGraceDays.min,
        POLICY_LIMITS.certGraceDays.max,
      ),
    ),
    obsoleteScope: input.obsoleteScope === "all" ? "all" : "old_fleet_only",
  };
}
