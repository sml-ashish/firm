import { lookupModel, MODEL_COUNT } from "./models";
import { POLICY_DEFAULTS, type Policy } from "./policy";

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

export type ClassificationClass =
  | "NON_DEPLOYABLE"
  | "NRG"
  | "NRG_REVIEW"
  | "OLD_FLEET"
  | "HEALTHY";

export type NrgStatus = "nrg" | "not_nrg" | "potential" | "insufficient";

export type ReasonArea = "OLD_FLEET" | "NON_DEPLOYABLE" | "NRG";
export type ReasonSeverity = "critical" | "warning" | "info" | "pass";

export interface Reason {
  area: ReasonArea;
  code: string;
  severity: ReasonSeverity;
  title: string;
  detail: string;
  observed?: string | number | null;
  threshold?: string | number | null;
}

export interface PerformanceYear {
  fy: string;
  availableDays?: number | null;
  deployedDays?: number | null;
  rentalRevenue?: number | null;
  operatingCost?: number | null;
  capitalEmployed?: number | null;
}

export interface RetentionInput {
  rentabilityCommittable?: boolean | null;
  npv5yr?: number | null;
  salePrice?: number | null;
  capitalReleaseReturnPct?: number | null;
  craneReturnPct?: number | null;
  recommendation?: string | null;
  justification?: string | null;
}

export interface AssetInput {
  assetCode: string;
  model: string;
  yom: number;
  replacementCapex?: number | null;
  repairQuote?: number | null;
  oemSupport?: string | null;
  sparesAvailability?: string | null;
  complianceStatus?: string | null;
  certFitnessExpiry?: string | Date | null;
  certLiftingExpiry?: string | Date | null;
  certTpiExpiry?: string | Date | null;
  certPesoExpiry?: string | Date | null;
}

export interface YearMetric {
  fy: string;
  utilisationPct: number | null;
  monthlyYieldPct: number | null;
  rentalRevenue: number | null;
  capitalEmployed: number | null;
  underperforms: boolean | null;
}

export interface CertLapse {
  key: string;
  label: string;
  expiry: string;
  daysLapsed: number;
}

export interface ClassificationMetrics {
  ageYears: number;
  modelAgeThreshold: number | null;
  modelKnown: boolean;
  utilisationAvgPct: number | null;
  monthlyYieldAvgPct: number | null;
  years: YearMetric[];
  repairRatioPct: number | null;
  replacementCapex: number | null;
  certLapses: CertLapse[];
  missingCertificates: string[];
  condition1: boolean | null;
  condition2: boolean | null;
  condition21: boolean | null;
  condition22: boolean | null;
  nrgStatus: NrgStatus;
  missingNrgYears: string[];
}

export interface Classification {
  oldFleet: boolean;
  nonDeployable: boolean;
  nrg: boolean;
  nrgStatus: NrgStatus;
  primaryClass: ClassificationClass;
  ageYears: number;
  ageThreshold: number | null;
  reasons: Reason[];
  metrics: ClassificationMetrics;
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

export function toDateOnly(value: unknown): Date | null {
  if (value == null || value === "") return null;
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    return new Date(
      Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()),
    );
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    // Excel serial date (1900 date system)
    const ms = Math.round((value - 25569) * 86400 * 1000);
    const d = new Date(ms);
    if (Number.isNaN(d.getTime())) return null;
    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  }
  const raw = String(value).trim();
  if (!raw) return null;
  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) {
    return new Date(Date.UTC(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3])));
  }
  const dmy = raw.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/);
  if (dmy) {
    let [, d, m, y] = dmy;
    let day = Number(d);
    let month = Number(m);
    // India convention dd/mm/yyyy; swap only when the first part cannot be a month.
    if (month > 12 && day <= 12) {
      const tmp = day;
      day = month;
      month = tmp;
    }
    let year = Number(y);
    if (year < 100) year += year > 70 ? 1900 : 2000;
    return new Date(Date.UTC(year, month - 1, day));
  }
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return null;
  return new Date(
    Date.UTC(parsed.getUTCFullYear(), parsed.getUTCMonth(), parsed.getUTCDate()),
  );
}

export function toIsoDate(value: unknown): string | null {
  const d = toDateOnly(value);
  return d ? d.toISOString().slice(0, 10) : null;
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 86400 * 1000);
}

export function diffDays(from: Date, to: Date): number {
  return Math.floor((to.getTime() - from.getTime()) / 86400000);
}

function num(value: unknown): number | null {
  if (value == null || value === "") return null;
  const n = typeof value === "number" ? value : Number(String(value).replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
}

function round1(n: number | null): number | null {
  return n == null ? null : Math.round(n * 10) / 10;
}

export function parseFy(value: unknown): { startYear: number; endYear: number; label: string } | null {
  if (value == null) return null;
  const raw = String(value).trim();
  const m = raw.match(/^(?:fy\s*)?(\d{4})\s*[-\/]\s*(\d{2,4})$/i);
  if (!m) return null;
  const startYear = Number(m[1]);
  let endYear = Number(m[2]);
  if (m[2].length <= 2) endYear = Math.floor(startYear / 100) * 100 + endYear;
  if (endYear !== startYear + 1) return null;
  return {
    startYear,
    endYear,
    label: `${startYear}-${String(endYear).slice(-2)}`,
  };
}

/** Last N completed financial years (Apr-Mar) as of an evaluation date. */
export function trailingFinancialYears(evaluationDate: Date, count: number): string[] {
  const year = evaluationDate.getUTCFullYear();
  const month = evaluationDate.getUTCMonth(); // 0-based
  const lastCompletedEnd = month >= 3 ? year : year - 1; // FY ends 31 March
  const labels: string[] = [];
  for (let i = 0; i < count; i += 1) {
    const endYear = lastCompletedEnd - i;
    labels.push(`${endYear - 1}-${String(endYear).slice(-2)}`);
  }
  return labels;
}

export const CERTIFICATES = [
  { key: "fitness", label: "Fitness Certificate", field: "certFitnessExpiry" },
  { key: "lifting", label: "Lifting Equipment License", field: "certLiftingExpiry" },
  { key: "tpi", label: "Third-Party Inspection Certificate", field: "certTpiExpiry" },
  { key: "peso", label: "PESO / Factory License", field: "certPesoExpiry" },
] as const;

/* ------------------------------------------------------------------ */
/* Engine                                                              */
/* ------------------------------------------------------------------ */

export function classifyAsset(
  asset: AssetInput,
  performance: PerformanceYear[],
  retention: RetentionInput | null | undefined,
  policy: Policy = POLICY_DEFAULTS,
  evaluationDate: Date = new Date(),
): Classification {
  const evalDate = toDateOnly(evaluationDate) ?? new Date();
  const reasons: Reason[] = [];

  /* ---------------- Old Fleet ---------------- */
  const ageYears = Math.max(0, evalDate.getUTCFullYear() - Number(asset.yom));
  const oldFleet = ageYears > policy.oldFleetYears;

  reasons.push({
    area: "OLD_FLEET",
    code: "AGE",
    severity: oldFleet ? "critical" : "pass",
    title: oldFleet ? "Old Fleet — age threshold exceeded" : "Within Old Fleet age threshold",
    detail: oldFleet
      ? `Equipment age is ${ageYears} years (YOM ${asset.yom}), above the ${policy.oldFleetYears}-year marketability threshold.`
      : `Equipment age is ${ageYears} years (YOM ${asset.yom}), within the ${policy.oldFleetYears}-year marketability threshold.`,
    observed: ageYears,
    threshold: policy.oldFleetYears,
  });

  /* ---------------- Non-Deployable ---------------- */
  const model = lookupModel(asset.model);
  const modelAgeThreshold = model?.threshold ?? null;
  const modelKnown = model != null;
  const ageThresholdFail = modelAgeThreshold != null && ageYears > modelAgeThreshold;

  if (!modelKnown) {
    reasons.push({
      area: "NON_DEPLOYABLE",
      code: "MODEL_UNKNOWN",
      severity: "warning",
      title: "Model not in approved model master",
      detail: `"${asset.model}" is not one of the ${MODEL_COUNT} models listed in the FIRM definition, so the model-specific age threshold could not be applied.`,
    });
  } else {
    reasons.push({
      area: "NON_DEPLOYABLE",
      code: "MODEL_AGE_THRESHOLD",
      severity: ageThresholdFail ? "critical" : "pass",
      title: ageThresholdFail
        ? "Model age threshold exceeded"
        : "Within model age threshold",
      detail: ageThresholdFail
        ? `${asset.model} is ${ageYears} years old, above its ${modelAgeThreshold}-year Non-Deployable threshold.`
        : `${asset.model} is ${ageYears} years old, within its ${modelAgeThreshold}-year Non-Deployable threshold.`,
      observed: ageYears,
      threshold: modelAgeThreshold,
    });
  }

  // Obsolescence indicators (OEM support / spares / compliance / repair cost)
  const oemSupport = (asset.oemSupport ?? "unknown").toLowerCase();
  const spares = (asset.sparesAvailability ?? "unknown").toLowerCase();
  const compliance = (asset.complianceStatus ?? "unknown").toLowerCase();
  const replacementCapex = num(asset.replacementCapex);
  const repairQuote = num(asset.repairQuote);
  const repairRatioPct =
    replacementCapex != null && replacementCapex > 0 && repairQuote != null
      ? (repairQuote / replacementCapex) * 100
      : null;
  const repairFail = repairRatioPct != null && repairRatioPct > policy.repairPct;

  const obsolescenceApplicable = policy.obsoleteScope === "all" || oldFleet;

  type Indicator = {
    code: string;
    title: string;
    triggered: boolean;
    known: boolean;
    detail: string;
    observed: string | number | null;
    threshold: string | number | null;
  };

  const indicators: Indicator[] = [
    {
      code: "OEM_SUPPORT",
      title: "OEM technical support discontinued",
      triggered: oemSupport === "discontinued",
      known: oemSupport !== "unknown",
      detail:
        oemSupport === "discontinued"
          ? "OEM technical support for this model has been discontinued."
          : oemSupport === "supported"
            ? "OEM technical support is available."
            : "OEM support status was not reported.",
      observed: oemSupport,
      threshold: "supported",
    },
    {
      code: "SPARES",
      title: "Critical spare parts unavailable",
      triggered: spares === "unavailable",
      known: spares !== "unknown",
      detail:
        spares === "unavailable"
          ? "Critical spares are not available from the OEM or approved aftermarket sources."
          : spares === "available"
            ? "Critical spares are available."
            : "Spares availability was not reported.",
      observed: spares,
      threshold: "available",
    },
    {
      code: "COMPLIANCE",
      title: "Safety / regulatory / emission non-compliance",
      triggered: compliance === "non_compliant",
      known: compliance !== "unknown",
      detail:
        compliance === "non_compliant"
          ? "Equipment does not comply with applicable safety, regulatory or emission norms."
          : compliance === "compliant"
            ? "Equipment complies with applicable safety, regulatory and emission norms."
            : "Compliance status was not reported.",
      observed: compliance,
      threshold: "compliant",
    },
    {
      code: "REPAIR_COST",
      title: `Repair cost above ${policy.repairPct}% of replacement capex`,
      triggered: repairFail,
      known: repairRatioPct != null,
      detail:
        repairRatioPct != null
          ? `Repair estimate is ${round1(repairRatioPct)}% of prevailing replacement capex (threshold ${policy.repairPct}%).`
          : "Replacement capex or repair estimate was not reported.",
      observed: round1(repairRatioPct),
      threshold: policy.repairPct,
    },
  ];

  for (const indicator of indicators) {
    if (indicator.triggered) {
      reasons.push({
        area: "NON_DEPLOYABLE",
        code: indicator.code,
        severity: obsolescenceApplicable ? "critical" : "warning",
        title: indicator.title,
        detail: obsolescenceApplicable
          ? indicator.detail
          : `${indicator.detail} Not applied: the obsolescence tests are scoped to Old Fleet equipment and this crane is ${ageYears} years old.`,
        observed: indicator.observed,
        threshold: indicator.threshold,
      });
    } else if (!indicator.known) {
      reasons.push({
        area: "NON_DEPLOYABLE",
        code: `${indicator.code}_MISSING`,
        severity: "warning",
        title: "Data not reported",
        detail: indicator.detail,
      });
    } else {
      reasons.push({
        area: "NON_DEPLOYABLE",
        code: indicator.code,
        severity: "pass",
        title: indicator.title,
        detail: indicator.detail,
        observed: indicator.observed,
        threshold: indicator.threshold,
      });
    }
  }

  // Certificate lapse test
  const certLapses: CertLapse[] = [];
  const missingCertificates: string[] = [];
  for (const cert of CERTIFICATES) {
    const expiry = toDateOnly(asset[cert.field] as string | Date | null | undefined);
    if (!expiry) {
      missingCertificates.push(cert.label);
      continue;
    }
    const lapseDate = addDays(expiry, policy.certGraceDays);
    if (evalDate.getTime() > lapseDate.getTime()) {
      certLapses.push({
        key: cert.key,
        label: cert.label,
        expiry: expiry.toISOString().slice(0, 10),
        daysLapsed: diffDays(expiry, evalDate),
      });
    }
  }

  if (certLapses.length > 0) {
    for (const lapse of certLapses) {
      reasons.push({
        area: "NON_DEPLOYABLE",
        code: `CERT_LAPSED_${lapse.key.toUpperCase()}`,
        severity: "critical",
        title: `${lapse.label} lapsed`,
        detail: `Expired on ${lapse.expiry} and not renewed within ${policy.certGraceDays} days (${lapse.daysLapsed} days lapsed).`,
        observed: lapse.expiry,
        threshold: `${policy.certGraceDays} days grace`,
      });
    }
  } else if (missingCertificates.length === 0) {
    reasons.push({
      area: "NON_DEPLOYABLE",
      code: "CERTIFICATES",
      severity: "pass",
      title: "All statutory certificates valid",
      detail: "Fitness, lifting license, third-party inspection and PESO/factory license are current.",
    });
  } else {
    reasons.push({
      area: "NON_DEPLOYABLE",
      code: "CERTIFICATES_MISSING",
      severity: "warning",
      title: "Certificate expiry dates not reported",
      detail: `Missing expiry dates: ${missingCertificates.join(", ")}. These certificates could not be tested.`,
    });
  }

  const obsolete = obsolescenceApplicable && indicators.some((i) => i.triggered);
  const nonDeployable = obsolete || ageThresholdFail || certLapses.length > 0;

  /* ---------------- NRG ---------------- */
  const fyRows = performance
    .map((row) => ({ row, parsed: parseFy(row.fy) }))
    .filter((entry): entry is { row: PerformanceYear; parsed: { startYear: number; endYear: number; label: string } } => entry.parsed != null);

  const byEndYear = new Map<number, { row: PerformanceYear; label: string }>();
  for (const entry of fyRows) {
    if (!byEndYear.has(entry.parsed.endYear)) {
      byEndYear.set(entry.parsed.endYear, { row: entry.row, label: entry.parsed.label });
    }
  }
  const sorted = [...byEndYear.entries()].sort((a, b) => b[0] - a[0]);
  const required = Math.max(1, policy.nrgYears);
  const trailing = sorted.slice(0, required);
  const consecutive =
    trailing.length === required &&
    trailing.every((entry, index) => index === 0 || trailing[index - 1][0] - entry[0] === 1);

  const selected = consecutive ? trailing : [];
  const missingNrgYears = trailingFinancialYears(evalDate, required).filter(
    (label) => !selected.some(([, value]) => value.label === label),
  );

  const years: YearMetric[] = selected.map(([endYear, value]) => {
    const row = value.row;
    const available = num(row.availableDays);
    const deployed = num(row.deployedDays);
    const revenue = num(row.rentalRevenue);
    const capital = num(row.capitalEmployed);

    const utilisationPct =
      available != null && available > 0 && deployed != null
        ? (deployed / available) * 100
        : null;
    const monthlyYieldPct =
      capital != null && capital > 0 && revenue != null
        ? (revenue / capital / 12) * 100
        : null;

    const underperforms =
      utilisationPct != null && monthlyYieldPct != null
        ? utilisationPct < policy.nrgUtilPct && monthlyYieldPct < policy.nrgYieldPct
        : null;

    return {
      fy: value.label,
      utilisationPct: round1(utilisationPct),
      monthlyYieldPct:
        monthlyYieldPct == null ? null : Math.round(monthlyYieldPct * 100) / 100,
      rentalRevenue: revenue,
      capitalEmployed: capital,
      underperforms,
    };
  });

  const condition1 =
    selected.length !== required
      ? null
      : years.some((year) => year.underperforms == null)
        ? null
        : years.every((year) => year.underperforms === true);

  const utilisationAvgPct =
    years.length > 0 && years.every((y) => y.utilisationPct != null)
      ? round1(years.reduce((sum, y) => sum + (y.utilisationPct ?? 0), 0) / years.length)
      : null;
  const monthlyYieldAvgPct =
    years.length > 0 && years.every((y) => y.monthlyYieldPct != null)
      ? Math.round(
          (years.reduce((sum, y) => sum + (y.monthlyYieldPct ?? 0), 0) / years.length) * 100,
        ) / 100
      : null;

  for (const year of years) {
    const detail = `Utilisation ${year.utilisationPct ?? "n/a"}% and monthly yield ${year.monthlyYieldPct ?? "n/a"}% (thresholds ${policy.nrgUtilPct}% / ${policy.nrgYieldPct}%).`;
    reasons.push({
      area: "NRG",
      code: `FY_${year.fy}`,
      severity: year.underperforms ? "warning" : "pass",
      title: year.underperforms
        ? `FY ${year.fy}: below both performance thresholds`
        : `FY ${year.fy}: performance threshold met`,
      detail,
      observed: `Util ${year.utilisationPct ?? "-"}% / Yield ${year.monthlyYieldPct ?? "-"}%`,
      threshold: `${policy.nrgUtilPct}% / ${policy.nrgYieldPct}%`,
    });
  }

  if (condition1 == null) {
    reasons.push({
      area: "NRG",
      code: "CONDITION1_INSUFFICIENT",
      severity: "warning",
      title: "Condition 1 cannot be tested",
      detail: `${required} consecutive financial years of performance data are required. Missing: ${
        missingNrgYears.length > 0 ? missingNrgYears.join(", ") : "utilisation or capital employed figures"
      }.`,
    });
  } else if (condition1) {
    reasons.push({
      area: "NRG",
      code: "CONDITION1_MET",
      severity: "critical",
      title: "Condition 1 met — sustained under-performance",
      detail: `Utilisation stayed below ${policy.nrgUtilPct}% and monthly yield below ${policy.nrgYieldPct}% for ${required} consecutive years.`,
    });
  } else {
    reasons.push({
      area: "NRG",
      code: "CONDITION1_NOT_MET",
      severity: "pass",
      title: "Condition 1 not met",
      detail: `The crane did not fail both the ${policy.nrgUtilPct}% utilisation and ${policy.nrgYieldPct}% yield tests for all ${required} consecutive years.`,
    });
  }

  const committable = retention?.rentabilityCommittable ?? null;
  const npv = num(retention?.npv5yr);
  const sale = num(retention?.salePrice);
  const releaseReturn = num(retention?.capitalReleaseReturnPct);
  const craneReturn = num(retention?.craneReturnPct);

  const condition21 =
    committable === false && npv != null && sale != null ? npv < sale : null;
  const condition22 =
    releaseReturn != null && craneReturn != null ? releaseReturn > craneReturn : null;
  const condition2 =
    condition21 == null || condition22 == null ? null : condition21 && condition22;

  if (retention == null) {
    reasons.push({
      area: "NRG",
      code: "CONDITION2_MISSING",
      severity: "warning",
      title: "Condition 2 assessment not available",
      detail: "No retention assessment has been recorded for this evaluation date.",
    });
  } else {
    reasons.push({
      area: "NRG",
      code: "CONDITION21",
      severity: condition21 === true ? "critical" : condition21 === false ? "pass" : "warning",
      title:
        condition21 === true
          ? "Condition 2.1 met — 5-year rentability not underwritten"
          : condition21 === false
            ? "Condition 2.1 not met — rentability underwritten"
            : "Condition 2.1 cannot be tested",
      detail:
        condition21 === true
          ? `Business team cannot commit 5-year rentability and NPV of future cash flows (${npv != null ? npv.toLocaleString("en-IN") : "n/a"}) is below the achievable sale price (${sale != null ? sale.toLocaleString("en-IN") : "n/a"}).`
          : condition21 === false
            ? "Either the business team can commit to 5-year rentability, or the NPV of future cash flows is not below the achievable sale price."
            : "Rentability commitment, NPV or achievable sale price is missing.",
    });
    reasons.push({
      area: "NRG",
      code: "CONDITION22",
      severity: condition22 === true ? "critical" : condition22 === false ? "pass" : "warning",
      title:
        condition22 === true
          ? "Condition 2.2 met — capital release earns a superior return"
          : condition22 === false
            ? "Condition 2.2 not met — retained use earns a superior return"
            : "Condition 2.2 cannot be tested",
      detail:
        condition22 === true
          ? `Return on capital released by sale (${releaseReturn}%) exceeds the crane's 5-year return (${craneReturn}%).`
          : condition22 === false
            ? `The crane's 5-year return (${craneReturn}%) is at least the return on capital released (${releaseReturn}%).`
            : "Capital release return or crane return is missing.",
    });
  }

  let nrgStatus: NrgStatus;
  if (condition1 == null) nrgStatus = "insufficient";
  else if (!condition1) nrgStatus = "not_nrg";
  else if (condition2 == null) nrgStatus = "potential";
  else nrgStatus = condition2 ? "nrg" : "not_nrg";

  const nrg = nrgStatus === "nrg";

  if (nrgStatus === "nrg") {
    reasons.push({
      area: "NRG",
      code: "NRG_CONFIRMED",
      severity: "critical",
      title: "NRG / Under-Performing Asset confirmed",
      detail: "Both Condition 1 (asset performance) and Condition 2 (retention economics) are met.",
    });
  } else if (nrgStatus === "potential") {
    reasons.push({
      area: "NRG",
      code: "NRG_POTENTIAL",
      severity: "warning",
      title: "Potential NRG — Condition 2 assessment pending",
      detail:
        "The crane fails Condition 1. A business-team retention assessment is required to conclude the NRG test.",
    });
  } else if (nrgStatus === "not_nrg" && condition1 === true) {
    reasons.push({
      area: "NRG",
      code: "NRG_NOT_CONFIRMED",
      severity: "info",
      title: "NRG not confirmed",
      detail: "Condition 1 is met but the retention economics test (Condition 2) is not.",
    });
  } else if (nrgStatus === "not_nrg") {
    reasons.push({
      area: "NRG",
      code: "NRG_NOT_APPLICABLE",
      severity: "pass",
      title: "Not NRG",
      detail: "Condition 1 (asset performance) is not met.",
    });
  }

  const primaryClass: ClassificationClass = nonDeployable
    ? "NON_DEPLOYABLE"
    : nrgStatus === "nrg"
      ? "NRG"
      : nrgStatus === "potential"
        ? "NRG_REVIEW"
        : oldFleet
          ? "OLD_FLEET"
          : "HEALTHY";

  return {
    oldFleet,
    nonDeployable,
    nrg,
    nrgStatus,
    primaryClass,
    ageYears,
    ageThreshold: modelAgeThreshold,
    reasons,
    metrics: {
      ageYears,
      modelAgeThreshold,
      modelKnown,
      utilisationAvgPct,
      monthlyYieldAvgPct,
      years,
      repairRatioPct: round1(repairRatioPct),
      replacementCapex,
      certLapses,
      missingCertificates,
      condition1,
      condition2,
      condition21,
      condition22,
      nrgStatus,
      missingNrgYears,
    },
  };
}

export const CLASS_LABELS: Record<ClassificationClass, string> = {
  NON_DEPLOYABLE: "Non-Deployable",
  NRG: "NRG",
  NRG_REVIEW: "NRG — Review",
  OLD_FLEET: "Old Fleet",
  HEALTHY: "Healthy",
};

export const NRG_STATUS_LABELS: Record<NrgStatus, string> = {
  nrg: "NRG confirmed",
  not_nrg: "Not NRG",
  potential: "Potential NRG",
  insufficient: "Insufficient data",
};
