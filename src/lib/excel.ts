import * as XLSX from "xlsx";
import { lookupModel } from "./models";
import {
  normalizeCategory,
  normalizeCompliance,
  normalizeOemSupport,
  normalizeRecommendation,
  normalizeSpares,
  normalizeTriBool,
} from "./normalize";
import { parseFy, toIsoDate } from "./classify";
import type { AssetInput, PerformanceYear, RetentionInput } from "./classify";

/* ------------------------------------------------------------------ */
/* Public types                                                        */
/* ------------------------------------------------------------------ */

export interface ParsedAsset extends AssetInput {
  rowNumber: number;
  description: string | null;
  oem: string | null;
  category: string | null;
  capacityMt: number | null;
  capitalisationDate: string | null;
  originalCapex: number | null;
  grossBlock: number | null;
  netBookValue: number | null;
  location: string | null;
  region: string | null;
  currentStatus: string | null;
  notes: string | null;
  certFitnessExpiry: string | null;
  certLiftingExpiry: string | null;
  certTpiExpiry: string | null;
  certPesoExpiry: string | null;
}

export interface ParsedPerformanceRow extends PerformanceYear {
  assetCode: string;
  rowNumber: number;
}

export interface ParsedRetentionRow extends RetentionInput {
  assetCode: string;
  evaluationDate: string;
  rowNumber: number;
}

export interface ParseIssue {
  severity: "error" | "warning";
  sheet: string;
  row: number | null;
  field?: string;
  code: string;
  message: string;
}

export interface ParseStats {
  assetCount: number;
  performanceRows: number;
  retentionRows: number;
  modelsUsed: number;
  unknownModels: number;
  errorCount: number;
  warningCount: number;
}

export interface ParsedWorkbook {
  fatal: boolean;
  sheetNames: string[];
  assets: ParsedAsset[];
  performance: ParsedPerformanceRow[];
  retention: ParsedRetentionRow[];
  issues: ParseIssue[];
  stats: ParseStats;
}

/* ------------------------------------------------------------------ */
/* Header mapping                                                      */
/* ------------------------------------------------------------------ */

const HEADER_ALIASES: Record<string, string[]> = {
  asset_code: [
    "assetcode",
    "assetid",
    "equipmentid",
    "equipmentcode",
    "craneid",
    "cranecode",
    "assetno",
    "assetnumber",
    "machineid",
  ],
  description: ["equipmentdescription", "cranedescription", "description"],
  oem: ["oemmake", "manufacturer", "oem", "make"],
  model: ["equipmentmodel", "cranemodel", "model"],
  category: ["equipmentcategory", "category"],
  capacity_mt: ["capacitymt", "capacity", "tonnage"],
  yom: ["yearofmanufactureyom", "yearofmanufacture", "manufacturingyear", "yom"],
  capitalisation_date: [
    "capitalisationdate",
    "capitalizationdate",
    "dateofcommissioning",
    "commissioningdate",
  ],
  original_capex: ["originalcapex", "originalcost", "capex"],
  gross_block: ["grossblock"],
  net_book_value: ["netbookvalue", "nbv", "wdv"],
  replacement_capex: [
    "replacementcapex",
    "prevailingreplacementcapex",
    "replacementcost",
  ],
  location: ["location", "site", "base"],
  region: ["region", "zone", "geography"],
  current_status: ["currentstatus", "deploymentstatus", "status"],
  oem_support: ["oemsupportstatus", "oemsupport"],
  spares_availability: [
    "criticalsparesavailability",
    "sparesavailability",
    "criticalspares",
    "sparesstatus",
  ],
  compliance_status: [
    "safetyregulatoryemissioncompliance",
    "compliancestatus",
    "safetycompliance",
    "regulatorycompliance",
    "compliance",
  ],
  repair_quote: [
    "estimatedrepaircost",
    "majorrepaircost",
    "repaircost",
    "repairquote",
  ],
  cert_fitness_expiry: ["fitnesscertificateexpiry", "fitnesscertexpiry", "fitnessexpiry"],
  cert_lifting_expiry: [
    "liftingequipmentlicenseexpiry",
    "liftinglicenseexpiry",
    "liftinglicenceexpiry",
    "liftingexpiry",
  ],
  cert_tpi_expiry: [
    "thirdpartyinspectioncertificateexpiry",
    "thirdpartyinspectionexpiry",
    "tpiexpiry",
    "inspectionexpiry",
  ],
  cert_peso_expiry: ["pesofactorylicenseexpiry", "factorylicenseexpiry", "pesoexpiry"],
  notes: ["notes", "remarks"],
  fy: ["financialyear", "fy"],
  available_days: ["availabledays"],
  deployed_days: ["deployeddays"],
  rental_revenue: ["rentalrevenue", "revenue"],
  operating_cost: ["operatingcost"],
  capital_employed: ["capitalemployed"],
  evaluation_date: ["evaluationdate", "assessmentdate"],
  rentability_committable: [
    "5yearrentabilitycommittableyesno",
    "yearrentabilitycommittable",
    "rentabilitycommittable",
    "rentability",
  ],
  npv_5yr: ["npvof5yearcashflowsinr", "npvof5yearcashflows", "npv5yr", "npv"],
  sale_price: ["achievablesalepriceinr", "achievablesaleprice", "saleprice"],
  capital_release_return_pct: [
    "returnoncapitalreleased",
    "capitalreleasereturnpct",
    "capitalreleasereturn",
  ],
  crane_return_pct: ["crane5yearreturn", "cranereturnpct", "cranereturn"],
  recommendation: ["recommendation"],
  justification: ["justification", "rationale"],
};

const normaliseHeader = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, "");

const ALIAS_INDEX: { key: string; alias: string }[] = Object.entries(HEADER_ALIASES)
  .flatMap(([key, aliases]) => aliases.map((alias) => ({ key, alias: normaliseHeader(alias) })))
  .sort((a, b) => b.alias.length - a.alias.length);

function matchField(header: string | null): string | null {
  if (!header) return null;
  const h = normaliseHeader(header);
  if (!h) return null;
  const exact = ALIAS_INDEX.find((entry) => entry.alias === h);
  if (exact) return exact.key;
  const partial = ALIAS_INDEX.find((entry) => h.includes(entry.alias));
  return partial?.key ?? null;
}

/* ------------------------------------------------------------------ */
/* Cell parsing                                                        */
/* ------------------------------------------------------------------ */

export function parseNumber(value: unknown): number | null {
  if (value == null || value === "") return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  let raw = String(value).trim();
  if (!raw) return null;

  let negative = false;
  if (/^\(.*\)$/.test(raw)) {
    negative = true;
    raw = raw.slice(1, -1);
  }
  raw = raw
    .replace(/[₹$€£]/g, "")
    .replace(/rs\.?/gi, "")
    .replace(/%/g, "")
    .replace(/,/g, "")
    .replace(/\s+/g, "")
    .trim();

  const match = raw.match(/^(-?\d+(?:\.\d+)?)(cr(?:ore)?s?|lakhs?|lacs?|l|k)?$/i);
  if (!match) return null;

  let multiplier = 1;
  const suffix = match[2]?.toLowerCase();
  if (suffix) {
    if (suffix.startsWith("cr")) multiplier = 10_000_000;
    else if (suffix.startsWith("lakh") || suffix.startsWith("lac") || suffix === "l")
      multiplier = 100_000;
    else if (suffix === "k") multiplier = 1_000;
  }
  const parsed = Number(match[1]) * multiplier;
  if (!Number.isFinite(parsed)) return null;
  return negative ? -parsed : parsed;
}

function parseInteger(value: unknown): number | null {
  const n = parseNumber(value);
  if (n == null) return null;
  return Math.round(n);
}

function parseYear(value: unknown): number | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.getUTCFullYear();
  }
  const numeric = parseNumber(value);
  if (numeric != null && Number.isInteger(numeric) && numeric >= 1900 && numeric <= 2200) {
    return numeric;
  }
  const match = String(value ?? "").match(/\b(19|20)\d{2}\b/);
  return match ? Number(match[0]) : null;
}

function parseDate(value: unknown): string | null {
  return toIsoDate(value);
}

function text(value: unknown): string | null {
  if (value == null) return null;
  const s = String(value).trim();
  return s ? s : null;
}

/* ------------------------------------------------------------------ */
/* Sheet helpers                                                       */
/* ------------------------------------------------------------------ */

interface SheetTable {
  headers: (string | null)[];
  rows: { values: unknown[]; rowNumber: number }[];
}

function readTable(sheet: XLSX.WorkSheet | undefined): SheetTable {
  if (!sheet) return { headers: [], rows: [] };
  const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    raw: true,
    defval: null,
    blankrows: false,
  });
  let headerIndex = -1;
  for (let i = 0; i < matrix.length; i += 1) {
    const populated = matrix[i].filter((cell) => cell != null && String(cell).trim() !== "");
    if (populated.length >= 2) {
      headerIndex = i;
      break;
    }
  }
  if (headerIndex < 0) return { headers: [], rows: [] };
  const headers = matrix[headerIndex].map((cell) =>
    cell == null || String(cell).trim() === "" ? null : String(cell).trim(),
  );
  const rows = matrix.slice(headerIndex + 1).map((values, index) => ({
    values,
    rowNumber: headerIndex + 2 + index,
  }));
  return { headers, rows };
}

function findSheet(
  workbook: XLSX.WorkBook,
  aliases: string[],
): { name: string; sheet: XLSX.WorkSheet } | null {
  const wanted = aliases.map(normaliseHeader);
  for (const name of workbook.SheetNames) {
    const n = normaliseHeader(name);
    if (wanted.some((alias) => n === alias || n.includes(alias))) {
      return { name, sheet: workbook.Sheets[name] };
    }
  }
  return null;
}

function rowToObject(headers: (string | null)[], values: unknown[]): Record<string, unknown> {
  const record: Record<string, unknown> = {};
  headers.forEach((header, index) => {
    const key = matchField(header);
    if (key && record[key] === undefined) {
      record[key] = values[index];
    }
  });
  return record;
}

/* ------------------------------------------------------------------ */
/* Parser                                                              */
/* ------------------------------------------------------------------ */

export function parseFleetWorkbook(
  data: ArrayBuffer | Uint8Array | Buffer,
  options: { evaluationDate?: Date } = {},
): ParsedWorkbook {
  const evaluationDate = options.evaluationDate ?? new Date();
  const workbook = XLSX.read(data, { type: "buffer", cellDates: true });
  const issues: ParseIssue[] = [];
  const assets: ParsedAsset[] = [];
  const performance: ParsedPerformanceRow[] = [];
  const retention: ParsedRetentionRow[] = [];

  const addIssue = (issue: ParseIssue) => issues.push(issue);

  const fleetSheet = findSheet(workbook, ["fleetmaster", "fleet", "assetmaster", "assets"]);
  if (!fleetSheet) {
    addIssue({
      severity: "error",
      sheet: "Fleet Master",
      row: null,
      code: "SHEET_MISSING",
      message:
        "The workbook does not contain a Fleet Master sheet. Use the FIRM template and keep the sheet name unchanged.",
    });
    return {
      fatal: true,
      sheetNames: workbook.SheetNames,
      assets,
      performance,
      retention,
      issues,
      stats: emptyStats(issues),
    };
  }

  const fleetTable = readTable(fleetSheet.sheet);
  if (fleetTable.headers.length === 0) {
    addIssue({
      severity: "error",
      sheet: fleetSheet.name,
      row: null,
      code: "HEADER_MISSING",
      message: "The Fleet Master sheet has no header row.",
    });
    return {
      fatal: true,
      sheetNames: workbook.SheetNames,
      assets,
      performance,
      retention,
      issues,
      stats: emptyStats(issues),
    };
  }

  const assetCodes = new Set<string>();
  const currentYear = new Date().getUTCFullYear();

  for (const row of fleetTable.rows) {
    const values = row.values;
    if (values.every((cell) => cell == null || String(cell).trim() === "")) continue;
    const record = rowToObject(fleetTable.headers, values);

    const assetCode = text(record.asset_code);
    if (!assetCode) {
      addIssue({
        severity: "error",
        sheet: fleetSheet.name,
        row: row.rowNumber,
        field: "asset_code",
        code: "REQUIRED",
        message: "Asset Code is required.",
      });
      continue;
    }
    if (assetCodes.has(assetCode)) {
      addIssue({
        severity: "error",
        sheet: fleetSheet.name,
        row: row.rowNumber,
        field: "asset_code",
        code: "DUPLICATE_ASSET",
        message: `Asset Code "${assetCode}" appears more than once in Fleet Master.`,
      });
      continue;
    }
    assetCodes.add(assetCode);

    const model = text(record.model);
    if (!model) {
      addIssue({
        severity: "error",
        sheet: fleetSheet.name,
        row: row.rowNumber,
        field: "model",
        code: "REQUIRED",
        message: `Model is required for asset ${assetCode}.`,
      });
      continue;
    }

    const yom = parseYear(record.yom);
    if (yom == null || yom < 1950 || yom > currentYear + 1) {
      addIssue({
        severity: "error",
        sheet: fleetSheet.name,
        row: row.rowNumber,
        field: "yom",
        code: "INVALID_YOM",
        message: `Year of Manufacture for ${assetCode} is missing or invalid (received "${String(record.yom ?? "")}").`,
      });
      continue;
    }

    const modelInfo = lookupModel(model);
    if (!modelInfo) {
      addIssue({
        severity: "warning",
        sheet: fleetSheet.name,
        row: row.rowNumber,
        field: "model",
        code: "UNKNOWN_MODEL",
        message: `Model "${model}" for ${assetCode} is not in the approved model master; the model-specific age threshold will not be applied.`,
      });
    }

    const replacementCapex = parseNumber(record.replacement_capex);
    const repairQuote = parseNumber(record.repair_quote);
    if (replacementCapex != null && replacementCapex < 0) {
      addIssue({
        severity: "warning",
        sheet: fleetSheet.name,
        row: row.rowNumber,
        field: "replacement_capex",
        code: "NEGATIVE_VALUE",
        message: `Replacement capex for ${assetCode} is negative and was ignored.`,
      });
    }
    if (
      replacementCapex != null &&
      replacementCapex > 0 &&
      repairQuote != null &&
      repairQuote > replacementCapex
    ) {
      addIssue({
        severity: "warning",
        sheet: fleetSheet.name,
        row: row.rowNumber,
        field: "repair_quote",
        code: "REPAIR_GT_CAPEX",
        message: `Repair estimate for ${assetCode} is higher than its replacement capex; please verify.`,
      });
    }

    const dateFields: { key: string; label: string }[] = [
      { key: "capitalisation_date", label: "Capitalisation Date" },
      { key: "cert_fitness_expiry", label: "Fitness Certificate Expiry" },
      { key: "cert_lifting_expiry", label: "Lifting License Expiry" },
      { key: "cert_tpi_expiry", label: "Third-Party Inspection Expiry" },
      { key: "cert_peso_expiry", label: "PESO / Factory License Expiry" },
    ];
    const parsedDates: Record<string, string | null> = {};
    for (const field of dateFields) {
      const raw = record[field.key];
      const parsed = parseDate(raw);
      parsedDates[field.key] = parsed;
      if (raw != null && String(raw).trim() !== "" && !parsed) {
        addIssue({
          severity: "warning",
          sheet: fleetSheet.name,
          row: row.rowNumber,
          field: field.key,
          code: "INVALID_DATE",
          message: `Could not read ${field.label} for ${assetCode} ("${String(raw)}"). Use YYYY-MM-DD or DD/MM/YYYY.`,
        });
      }
    }

    const capitalisation = parsedDates.capitalisation_date;
    if (capitalisation && Number(capitalisation.slice(0, 4)) < yom) {
      addIssue({
        severity: "warning",
        sheet: fleetSheet.name,
        row: row.rowNumber,
        field: "capitalisation_date",
        code: "DATE_BEFORE_YOM",
        message: `Capitalisation date for ${assetCode} is earlier than its year of manufacture.`,
      });
    }

    assets.push({
      rowNumber: row.rowNumber,
      assetCode,
      description: text(record.description),
      oem: text(record.oem),
      model,
      category: normalizeCategory(record.category),
      capacityMt: parseNumber(record.capacity_mt),
      yom,
      capitalisationDate: capitalisation,
      originalCapex: parseNumber(record.original_capex),
      grossBlock: parseNumber(record.gross_block),
      netBookValue: parseNumber(record.net_book_value),
      replacementCapex:
        replacementCapex != null && replacementCapex >= 0 ? replacementCapex : null,
      location: text(record.location),
      region: text(record.region),
      currentStatus: text(record.current_status),
      oemSupport: normalizeOemSupport(record.oem_support),
      sparesAvailability: normalizeSpares(record.spares_availability),
      complianceStatus: normalizeCompliance(record.compliance_status),
      repairQuote: repairQuote != null && repairQuote >= 0 ? repairQuote : null,
      certFitnessExpiry: parsedDates.cert_fitness_expiry,
      certLiftingExpiry: parsedDates.cert_lifting_expiry,
      certTpiExpiry: parsedDates.cert_tpi_expiry,
      certPesoExpiry: parsedDates.cert_peso_expiry,
      notes: text(record.notes),
    });
  }

  if (assets.length === 0) {
    addIssue({
      severity: "error",
      sheet: fleetSheet.name,
      row: null,
      code: "NO_ASSETS",
      message: "No valid asset rows were found in the Fleet Master sheet.",
    });
  }

  /* -------------------------- Performance -------------------------- */
  const performanceSheet = findSheet(workbook, [
    "annualperformance",
    "performance",
    "utilisation",
    "utilization",
  ]);
  if (!performanceSheet) {
    addIssue({
      severity: "warning",
      sheet: "Annual Performance",
      row: null,
      code: "SHEET_MISSING",
      message:
        "No Annual Performance sheet found. NRG Condition 1 cannot be tested without three years of utilisation and yield data.",
    });
  } else {
    const table = readTable(performanceSheet.sheet);
    const seen = new Set<string>();
    for (const row of table.rows) {
      const values = row.values;
      if (values.every((cell) => cell == null || String(cell).trim() === "")) continue;
      const record = rowToObject(table.headers, values);

      const assetCode = text(record.asset_code);
      if (!assetCode) {
        addIssue({
          severity: "error",
          sheet: performanceSheet.name,
          row: row.rowNumber,
          field: "asset_code",
          code: "REQUIRED",
          message: "Asset Code is required on the Annual Performance sheet.",
        });
        continue;
      }
      if (!assetCodes.has(assetCode)) {
        addIssue({
          severity: "error",
          sheet: performanceSheet.name,
          row: row.rowNumber,
          field: "asset_code",
          code: "ORPHAN_PERFORMANCE",
          message: `Asset ${assetCode} on the Annual Performance sheet does not exist in Fleet Master.`,
        });
        continue;
      }
      const fyParsed = parseFy(record.fy);
      if (!fyParsed) {
        addIssue({
          severity: "warning",
          sheet: performanceSheet.name,
          row: row.rowNumber,
          field: "fy",
          code: "INVALID_FY",
          message: `Financial year "${String(record.fy ?? "")}" for ${assetCode} is not valid. Use a format like 2024-25.`,
        });
        continue;
      }
      const key = `${assetCode}::${fyParsed.label}`;
      if (seen.has(key)) {
        addIssue({
          severity: "warning",
          sheet: performanceSheet.name,
          row: row.rowNumber,
          code: "DUPLICATE_PERFORMANCE",
          message: `Duplicate performance row for ${assetCode} / FY ${fyParsed.label} ignored.`,
        });
        continue;
      }
      seen.add(key);

      const availableDays = parseInteger(record.available_days);
      const deployedDays = parseInteger(record.deployed_days);
      if (
        availableDays != null &&
        deployedDays != null &&
        deployedDays > availableDays
      ) {
        addIssue({
          severity: "warning",
          sheet: performanceSheet.name,
          row: row.rowNumber,
          field: "deployed_days",
          code: "DEPLOYED_GT_AVAILABLE",
          message: `Deployed days exceed available days for ${assetCode} / FY ${fyParsed.label}. Utilisation will exceed 100%.`,
        });
      }

      performance.push({
        rowNumber: row.rowNumber,
        assetCode,
        fy: fyParsed.label,
        availableDays,
        deployedDays,
        rentalRevenue: parseNumber(record.rental_revenue),
        operatingCost: parseNumber(record.operating_cost),
        capitalEmployed: parseNumber(record.capital_employed),
      });
    }
  }

  /* --------------------------- Retention --------------------------- */
  const retentionSheet = findSheet(workbook, ["retentionassessment", "retention"]);
  if (!retentionSheet) {
    addIssue({
      severity: "warning",
      sheet: "Retention Assessment",
      row: null,
      code: "SHEET_MISSING",
      message:
        "No Retention Assessment sheet found. NRG Condition 2 cannot be concluded and qualifying assets will be flagged as 'Potential NRG'.",
    });
  } else {
    const table = readTable(retentionSheet.sheet);
    const seen = new Set<string>();
    const fallbackDate = toIsoDate(evaluationDate) ?? new Date().toISOString().slice(0, 10);
    for (const row of table.rows) {
      const values = row.values;
      if (values.every((cell) => cell == null || String(cell).trim() === "")) continue;
      const record = rowToObject(table.headers, values);

      const assetCode = text(record.asset_code);
      if (!assetCode) {
        addIssue({
          severity: "error",
          sheet: retentionSheet.name,
          row: row.rowNumber,
          field: "asset_code",
          code: "REQUIRED",
          message: "Asset Code is required on the Retention Assessment sheet.",
        });
        continue;
      }
      if (!assetCodes.has(assetCode)) {
        addIssue({
          severity: "error",
          sheet: retentionSheet.name,
          row: row.rowNumber,
          field: "asset_code",
          code: "ORPHAN_RETENTION",
          message: `Asset ${assetCode} on the Retention Assessment sheet does not exist in Fleet Master.`,
        });
        continue;
      }
      const evaluationDateIso = parseDate(record.evaluation_date) ?? fallbackDate;
      const key = `${assetCode}::${evaluationDateIso}`;
      if (seen.has(key)) {
        addIssue({
          severity: "warning",
          sheet: retentionSheet.name,
          row: row.rowNumber,
          code: "DUPLICATE_RETENTION",
          message: `Duplicate retention assessment for ${assetCode} on ${evaluationDateIso} ignored.`,
        });
        continue;
      }
      seen.add(key);

      const committableRaw = record.rentability_committable;
      const committable = normalizeTriBool(committableRaw);
      if (
        committableRaw != null &&
        String(committableRaw).trim() !== "" &&
        committable == null
      ) {
        addIssue({
          severity: "warning",
          sheet: retentionSheet.name,
          row: row.rowNumber,
          field: "rentability_committable",
          code: "INVALID_BOOLEAN",
          message: `Could not read the 5-year rentability commitment for ${assetCode} ("${String(committableRaw)}"). Use Yes or No.`,
        });
      }

      retention.push({
        rowNumber: row.rowNumber,
        assetCode,
        evaluationDate: evaluationDateIso,
        rentabilityCommittable: committable,
        npv5yr: parseNumber(record.npv_5yr),
        salePrice: parseNumber(record.sale_price),
        capitalReleaseReturnPct: parseNumber(record.capital_release_return_pct),
        craneReturnPct: parseNumber(record.crane_return_pct),
        recommendation: normalizeRecommendation(record.recommendation),
        justification: text(record.justification),
      });
    }
  }

  const unknownModels = new Set(
    issues
      .filter((issue) => issue.code === "UNKNOWN_MODEL")
      .map((issue) => issue.message),
  ).size;
  const modelsUsed = new Set(assets.map((asset) => asset.model.toUpperCase())).size;

  return {
    fatal: assets.length === 0,
    sheetNames: workbook.SheetNames,
    assets,
    performance,
    retention,
    issues,
    stats: {
      assetCount: assets.length,
      performanceRows: performance.length,
      retentionRows: retention.length,
      modelsUsed,
      unknownModels,
      errorCount: issues.filter((issue) => issue.severity === "error").length,
      warningCount: issues.filter((issue) => issue.severity === "warning").length,
    },
  };
}

function emptyStats(issues: ParseIssue[]): ParseStats {
  return {
    assetCount: 0,
    performanceRows: 0,
    retentionRows: 0,
    modelsUsed: 0,
    unknownModels: 0,
    errorCount: issues.filter((issue) => issue.severity === "error").length,
    warningCount: issues.filter((issue) => issue.severity === "warning").length,
  };
}
