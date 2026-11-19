/** Canonical value normalisers shared by the Excel parser and the engine. */

export type OemSupport = "supported" | "discontinued" | "unknown";
export type SparesAvailability = "available" | "unavailable" | "unknown";
export type ComplianceStatus = "compliant" | "non_compliant" | "unknown";

function clean(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[\s_\-/]+/g, " ");
}

export function normalizeOemSupport(value: unknown): OemSupport {
  const v = clean(value);
  if (!v) return "unknown";
  if (
    v.includes("discontinu") ||
    v.includes("not supported") ||
    v.includes("unsupported") ||
    v.includes("obsolete") ||
    v === "no" ||
    v === "n" ||
    v === "false" ||
    v === "0"
  ) {
    return "discontinued";
  }
  if (
    v.includes("support") ||
    v === "yes" ||
    v === "y" ||
    v === "true" ||
    v === "1" ||
    v === "available"
  ) {
    return "supported";
  }
  return "unknown";
}

export function normalizeSpares(value: unknown): SparesAvailability {
  const v = clean(value);
  if (!v) return "unknown";
  if (
    v.includes("not available") ||
    v.includes("unavailable") ||
    v.includes("non availability") ||
    v.includes("no availability") ||
    v === "no" ||
    v === "n" ||
    v === "false" ||
    v === "0"
  ) {
    return "unavailable";
  }
  if (
    v.includes("available") ||
    v === "yes" ||
    v === "y" ||
    v === "true" ||
    v === "1"
  ) {
    return "available";
  }
  return "unknown";
}

export function normalizeCompliance(value: unknown): ComplianceStatus {
  const v = clean(value);
  if (!v) return "unknown";
  if (
    v.includes("non compliant") ||
    v.includes("noncompliance") ||
    v.includes("not compliant") ||
    v.includes("fail") ||
    v === "no" ||
    v === "n" ||
    v === "false" ||
    v === "0"
  ) {
    return "non_compliant";
  }
  if (
    v.includes("compliant") ||
    v.includes("complied") ||
    v === "yes" ||
    v === "y" ||
    v === "true" ||
    v === "1"
  ) {
    return "compliant";
  }
  return "unknown";
}

/** Normalise a Yes/No style cell into a tri-state boolean. */
export function normalizeTriBool(value: unknown): boolean | null {
  if (value === true || value === false) return value;
  const v = clean(value);
  if (!v) return null;
  if (["yes", "y", "true", "1", "committed", "committable", "can commit"].includes(v)) {
    return true;
  }
  if (
    ["no", "n", "false", "0", "unable", "not committed", "cannot commit", "not committable"].includes(
      v,
    )
  ) {
    return false;
  }
  return null;
}

export function normalizeCategory(value: unknown): string | null {
  const v = clean(value);
  if (!v) return null;
  if (v.includes("crawler") || v.includes("lattice")) return "Crawler Lattice Boom";
  if (v.includes("telescopic") || v.includes("truck") || v.includes("all terrain")) {
    return "Hydraulic Mobile Telescopic";
  }
  if (v.includes("hydraulic")) return "Hydraulic Mobile Telescopic";
  return String(value ?? "").trim() || null;
}

export function normalizeRecommendation(value: unknown): string | null {
  const v = clean(value);
  if (!v) return null;
  if (v.includes("redeploy")) return "Redeploy";
  if (v.includes("sell") || v.includes("sale") || v.includes("dispose")) return "Sell";
  if (v.includes("scrap")) return "Scrap";
  if (v.includes("retain") || v.includes("continue")) return "Retain";
  return String(value ?? "").trim() || null;
}
