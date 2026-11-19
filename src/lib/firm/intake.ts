/**
 * Server-safe intake helpers for the FIRM upload workflow (Section 11 of the
 * business-process document).
 *
 * The first five columns are the only crane data required by the document.
 * Age and the Old Fleet flag are derived from YOM. This build has no SAP
 * connection, so SAP Status / SO details are entered manually; SO End Date
 * drives "Execution allowed from".
 *
 * This module imports only `xlsx` and local workflow types; it must not pull
 * in the legacy 24-column fleet template, excel or model/classifier modules.
 */

import * as XLSX from "xlsx";
import type { UPLOAD_FIELDS } from "./workflow";

/** Section 11 — the five crane fields plus manually entered SAP / SO fields. */
export const FIRM_HEADERS = [
  "Equipment ID",
  "Equipment Description",
  "YOM",
  "Yield %",
  "Utilisation %",
  "SAP Status",
  "SO Number",
  "SO Start Date",
  "SO End Date",
] as const;

export interface FirmParsedRow {
  rowNumber: number;
  equipmentId: string;
  description: string;
  yom: number;
  yieldPct: number;
  utilisationPct: number;
  age: number;
  oldFleet: boolean;
  sapStatus: string;
  soNumber: string | null;
  soStart: string | null;
  soEnd: string | null;
}

export interface FirmIssue {
  severity: "error" | "warning";
  row: number | null;
  field: string | null;
  message: string;
}

export interface FirmParseResult {
  fatal: boolean;
  rows: FirmParsedRow[];
  issues: FirmIssue[];
  errorCount: number;
  warningCount: number;
}

const COLUMN_WIDTHS = [18, 42, 10, 12, 16, 14, 18, 16, 16];
const MAX_ROWS = 500;

/** Build a worksheet with fixed column widths and an optional autofilter. */
function makeSheet(
  rows: unknown[][],
  widths: number[] = COLUMN_WIDTHS,
  autoFilter = false,
): XLSX.WorkSheet {
  const sheet = XLSX.utils.aoa_to_sheet(rows);
  sheet["!cols"] = widths.map((wch) => ({ wch }));
  if (autoFilter && rows.length > 0) {
    const width = Math.max(...rows.map((row) => row.length), FIRM_HEADERS.length);
    sheet["!autofilter"] = {
      ref: XLSX.utils.encode_range({
        s: { r: 0, c: 0 },
        e: { r: rows.length - 1, c: width - 1 },
      }),
    };
  }
  return sheet;
}

/** Shared Instructions sheet for both the blank template and the sample. */
function buildInstructions(evaluationDate: Date, sample: boolean): unknown[][] {
  // The sample stays byte-for-byte deterministic regardless of the date passed.
  const date = sample
    ? "set when the workbook is uploaded"
    : evaluationDate.toISOString().slice(0, 10);
  const rows: unknown[][] = [
    ["FIRM — Fleet Upload Template"],
    ["Sanghvi Movers Limited  |  Section 11 — fleet data and SO details"],
    [`Evaluation date: ${date}`],
    [],
    ["HOW TO USE"],
    ["1. Enter one row per crane on the 'Fleet' sheet. Do not rename or remove that sheet."],
    [
      "2. The first five columns are the crane data required by the business-process document — all five are mandatory.",
    ],
    ["3. Age and the Old Fleet flag are derived automatically from YOM — do not type them in."],
    [
      "4. SAP Status and the SO columns are entered manually in this build because there is no SAP connection.",
    ],
    [
      "5. SO End Date becomes 'Execution allowed from': a new SO, deployment or handover cannot be executed until that date.",
    ],
    [
      "6. If a crane has an SO on rent, it stays in the cycle and can be quoted or claimed, but execution waits for the current SO to end.",
    ],
    [
      "7. Upload the completed workbook on the Import page. Validation is shown before anything is committed.",
    ],
    [],
    ["FIELD GUIDE"],
    ["Equipment ID — unique crane identifier from the asset register."],
    ["Equipment Description — free text describing the crane."],
    ["YOM — year of manufacture as an integer (1950 or later, not after the current year)."],
    ["Yield % — monthly yield percentage, a number between 0 and 100."],
    ["Utilisation % — utilisation percentage, a number between 0 and 100."],
    ["SAP Status — On rent / Idle / Sold (case-insensitive); blank defaults to Idle with a warning."],
    ["SO Number — optional, but if filled then SO Start Date and SO End Date are mandatory."],
    ["SO Start Date / SO End Date — YYYY-MM-DD or DD/MM/YYYY. SO End Date drives 'Execution allowed from'."],
    [],
    ["NOTES"],
    ["Do not add extra columns to the Fleet sheet; additional sheets are ignored."],
    ["No more than 500 cranes can be imported from one workbook."],
  ];
  if (sample) {
    rows.push(["This sample contains 12 example rows — replace them with your own fleet."]);
  } else {
    rows.push(["Download the sample workbook from the Import page to see valid example rows."]);
  }
  return rows;
}

/** Blank upload workbook: Instructions + Fleet (header only). */
export function buildFirmTemplate(evaluationDate = new Date()): Buffer {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    wb,
    makeSheet(buildInstructions(evaluationDate, false), [120]),
    "Instructions",
  );
  XLSX.utils.book_append_sheet(
    wb,
    makeSheet([[...FIRM_HEADERS]], COLUMN_WIDTHS, true),
    "Fleet",
  );
  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
}

/**
 * 12 deterministic, realistic SML crane rows spanning YOM 1999..2023.
 * A few rows carry an SO number with a future SO end date; several have blank
 * SO details. Dates are written as strings so the sample stays deterministic.
 */
const SAMPLE_ROWS: ReadonlyArray<
  readonly [string, string, number, number, number, string, string | null, string | null, string | null]
> = [
  ["SML-0101", "Liebherr LTM 1090-4.1 90 MT Telescopic Crane", 1999, 1.4, 34, "Idle", null, null, null],
  ["SML-0102", "Grove GMK 4075 75 MT Telescopic Crane", 2001, 1.9, 48, "On rent", "SO-2026-0142", "2026-09-01", "2027-03-31"],
  ["SML-0103", "SANY SCC1500C 150 MT Crawler Crane", 2003, 2.3, 61, "Idle", null, null, null],
  ["SML-0104", "Terex Demag AC 100 100 MT Telescopic Crane", 2005, 1.1, 29, "Sold", null, null, null],
  ["SML-0105", "Liebherr LR 1400/2 400 MT Crawler Crane", 2007, 2.8, 72, "On rent", "SO-2026-0155", "2026-10-15", "2027-06-30"],
  ["SML-0106", "XCMG QUY80 80 MT Crawler Crane", 2009, 1.6, 41, "Idle", null, null, null],
  ["SML-0107", "SANY STC1100S 110 MT Telescopic Crane", 2011, 2.1, 55, "On rent", "SO-2026-0171", "2026-11-01", "2027-01-31"],
  ["SML-0108", "Grove GMK 6300 300 MT Telescopic Crane", 2013, 3.2, 81, "Idle", null, null, null],
  ["SML-0109", "Liebherr LTM 1160-5.2 160 MT Telescopic Crane", 2015, 2.5, 67, "On rent", "SO-2026-0188", "2026-08-20", "2027-09-30"],
  ["SML-0110", "Manitowoc 4100WS2 450 MT Crawler Crane", 2017, 1.8, 46, "Idle", null, null, null],
  ["SML-0111", "SANY SAC2000C8 200 MT Telescopic Crane", 2020, 3.0, 77, "Sold", null, null, null],
  ["SML-0112", "XCMG XGC800-1 800 MT Crawler Crane", 2023, 2.7, 70, "Idle", null, null, null],
];

/** Sample workbook with the same two sheets plus 12 example cranes. */
export function buildFirmSample(evaluationDate = new Date()): Buffer {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    wb,
    makeSheet(buildInstructions(evaluationDate, true), [120]),
    "Instructions",
  );
  const fleetRows: unknown[][] = [
    [...FIRM_HEADERS],
    ...SAMPLE_ROWS.map((row) => [...row]),
  ];
  XLSX.utils.book_append_sheet(wb, makeSheet(fleetRows, COLUMN_WIDTHS, true), "Fleet");
  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
}

/* ------------------------------------------------------------------ */
/* Parsing / validation                                               */
/* ------------------------------------------------------------------ */

/** Section 11 field keys, extended with the manually entered SAP / SO fields. */
type FieldKey =
  | (typeof UPLOAD_FIELDS)[number]["key"]
  | "sapStatus"
  | "soNumber"
  | "soStart"
  | "soEnd";

/** Normalise a header cell for case- and spacing-insensitive matching. */
function normaliseHeader(value: unknown): string {
  return String(value ?? "")
    .replace(/\u00a0/g, " ")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/\s*%/g, "%");
}

const HEADER_ALIASES: Record<FieldKey, readonly string[]> = {
  equipmentId: ["equipment id", "equipmentid", "id"],
  description: ["equipment description", "description"],
  yom: ["yom", "year of manufacture", "year"],
  yieldPct: ["yield%", "yield"],
  utilisationPct: ["utilisation%", "utilization%", "utilisation", "utilization"],
  sapStatus: ["sap status", "sapstatus", "sap current status", "current status"],
  soNumber: ["so number", "sonumber", "so no", "so no.", "so"],
  soStart: ["so start date", "so start", "sostartdate"],
  soEnd: ["so end date", "so end", "soenddate"],
};

function matchField(header: string): FieldKey | null {
  for (const key of Object.keys(HEADER_ALIASES) as FieldKey[]) {
    if ((HEADER_ALIASES[key] as readonly string[]).includes(header)) return key;
  }
  return null;
}

function blank(value: unknown): boolean {
  return value === null || value === undefined || String(value).trim() === "";
}

function numeric(value: unknown): number | null {
  if (blank(value)) return null;
  const n = typeof value === "number" ? value : Number(String(value).trim());
  return Number.isFinite(n) ? n : null;
}

const pad = (n: string | number) => String(n).padStart(2, "0");

/** Accept Date objects, Excel serial numbers, YYYY-MM-DD or DD/MM/YYYY. */
function normaliseDate(value: unknown): string | null {
  if (blank(value)) return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value.toISOString().slice(0, 10);
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    const ms = Math.round((value - 25569) * 86400 * 1000);
    const date = new Date(ms);
    return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10);
  }
  const text = String(value).trim();
  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(text);
  if (iso) return `${iso[1]}-${pad(iso[2])}-${pad(iso[3])}`;
  const dmy = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(text);
  if (dmy) return `${dmy[3]}-${pad(dmy[2])}-${pad(dmy[1])}`;
  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString().slice(0, 10);
}

const SAP_STATUS: Record<string, string> = {
  "on rent": "On rent",
  onrent: "On rent",
  idle: "Idle",
  sold: "Sold",
};

/**
 * Parse and validate an FIRM upload workbook.
 * Structural problems set `fatal`; cell-level problems become issues and only
 * error-free rows are returned.
 */
export function parseFirmWorkbook(buffer: Buffer): FirmParseResult {
  const issues: FirmIssue[] = [];
  const rows: FirmParsedRow[] = [];
  const currentYear = new Date().getFullYear();
  const today = new Date().toISOString().slice(0, 10);

  const add = (
    severity: FirmIssue["severity"],
    row: number | null,
    field: string | null,
    message: string,
  ) => issues.push({ severity, row, field, message });

  let workbook: XLSX.WorkBook;
  try {
    workbook = XLSX.read(buffer, { type: "buffer" });
  } catch (error) {
    add("error", null, null, `Could not read the workbook: ${(error as Error).message}`);
    return { fatal: true, rows, issues, errorCount: 1, warningCount: 0 };
  }

  const sheetName = workbook.SheetNames.find((name) => name.toLowerCase() === "fleet");
  if (!sheetName) {
    add("error", null, null, "The workbook has no sheet named 'Fleet'.");
    return { fatal: true, rows, issues, errorCount: 1, warningCount: 0 };
  }

  const sheet = workbook.Sheets[sheetName];
  const grid = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    defval: "",
    blankrows: true,
  });

  // The header row is the first row containing a recognisable column name.
  let headerIndex = -1;
  const columns: Partial<Record<FieldKey, number>> = {};
  for (let i = 0; i < Math.min(grid.length, 20); i += 1) {
    const found: Partial<Record<FieldKey, number>> = {};
    (grid[i] ?? []).forEach((cell, col) => {
      const field = matchField(normaliseHeader(cell));
      if (field && found[field] === undefined) found[field] = col;
    });
    if (Object.keys(found).length > 0) {
      headerIndex = i;
      Object.assign(columns, found);
      break;
    }
  }

  if (headerIndex === -1) {
    add("error", null, null, "The 'Fleet' sheet has no recognisable header row.");
    return { fatal: true, rows, issues, errorCount: 1, warningCount: 0 };
  }

  const coreFields: FieldKey[] = [
    "equipmentId",
    "description",
    "yom",
    "yieldPct",
    "utilisationPct",
  ];
  for (const field of coreFields) {
    if (columns[field] === undefined) {
      add("error", headerIndex + 1, null, `Missing mandatory column: ${field}.`);
    }
  }

  const dataRows = grid.slice(headerIndex + 1);
  const totalDataRows = dataRows.filter((row) => row && row.some((cell) => !blank(cell))).length;
  if (totalDataRows > MAX_ROWS) {
    add(
      "warning",
      null,
      null,
      `Workbook has ${totalDataRows} data rows; only the first ${MAX_ROWS} were imported.`,
    );
  }

  const seenIds = new Set<string>();

  dataRows.forEach((row, index) => {
    if (!row || row.every((cell) => blank(cell))) return;
    const rowNumber = headerIndex + 2 + index; // 1-based Excel row number
    let rowHasError = false;

    const fail = (field: string | null, message: string) => {
      add("error", rowNumber, field, message);
      rowHasError = true;
    };

    const cell = (field: FieldKey): unknown =>
      columns[field] !== undefined ? row[columns[field] as number] : undefined;

    const rawId = cell("equipmentId");
    const rawDescription = cell("description");
    const rawYom = cell("yom");
    const rawYield = cell("yieldPct");
    const rawUtil = cell("utilisationPct");

    if (blank(rawId)) {
      fail("Equipment ID", "Equipment ID is mandatory.");
    }
    if (blank(rawDescription)) {
      fail("Equipment Description", "Equipment Description is mandatory.");
    }

    const yom = numeric(rawYom);
    if (rawYom === undefined || yom === null) {
      fail("YOM", "YOM is mandatory and must be a number.");
    } else if (!Number.isInteger(yom) || yom < 1950 || yom > currentYear) {
      fail("YOM", `YOM must be an integer between 1950 and ${currentYear}.`);
    }

    const yieldPct = numeric(rawYield);
    if (rawYield === undefined || yieldPct === null) {
      fail("Yield %", "Yield % is mandatory and must be a number.");
    } else if (yieldPct < 0 || yieldPct > 100) {
      fail("Yield %", "Yield % must be between 0 and 100.");
    }

    const utilisationPct = numeric(rawUtil);
    if (rawUtil === undefined || utilisationPct === null) {
      fail("Utilisation %", "Utilisation % is mandatory and must be a number.");
    } else if (utilisationPct < 0 || utilisationPct > 100) {
      fail("Utilisation %", "Utilisation % must be between 0 and 100.");
    }

    const equipmentId = blank(rawId) ? "" : String(rawId).trim();
    if (!blank(rawId) && seenIds.has(equipmentId)) {
      fail("Equipment ID", `Duplicate Equipment ID: ${equipmentId}.`);
    } else if (!blank(rawId)) {
      seenIds.add(equipmentId);
    }

    // SAP Status — blank defaults to Idle with a warning.
    const rawStatus = cell("sapStatus");
    let sapStatus = "Idle";
    if (blank(rawStatus)) {
      add("warning", rowNumber, "SAP Status", "SAP Status is blank; defaulted to Idle.");
    } else {
      const key = String(rawStatus).trim().toLowerCase().replace(/\s+/g, " ");
      const canonical = SAP_STATUS[key];
      if (!canonical) {
        fail("SAP Status", "SAP Status must be On rent, Idle or Sold.");
      } else {
        sapStatus = canonical;
      }
    }

    // SO details — optional, but SO Number requires both dates.
    const rawSoNumber = cell("soNumber");
    const rawSoStart = cell("soStart");
    const rawSoEnd = cell("soEnd");
    const soNumber = blank(rawSoNumber) ? null : String(rawSoNumber).trim();
    const soStart = normaliseDate(rawSoStart);
    const soEnd = normaliseDate(rawSoEnd);

    if (!blank(rawSoStart) && soStart === null) {
      fail("SO Start Date", "SO Start Date must be a valid date.");
    }
    if (!blank(rawSoEnd) && soEnd === null) {
      fail("SO End Date", "SO End Date must be a valid date.");
    }
    if (soNumber) {
      if (!soStart) {
        fail("SO Start Date", "SO Start Date is mandatory when SO Number is filled.");
      }
      if (!soEnd) {
        fail("SO End Date", "SO End Date is mandatory when SO Number is filled.");
      }
    }
    if (soEnd && soEnd < today) {
      add(
        "warning",
        rowNumber,
        "SO End Date",
        "SO end date is in the past — verify the SO is still live",
      );
    }

    if (rowHasError) return;
    if (rows.length >= MAX_ROWS) return;

    const age = currentYear - (yom as number);
    rows.push({
      rowNumber,
      equipmentId,
      description: String(rawDescription).trim(),
      yom: yom as number,
      yieldPct: yieldPct as number,
      utilisationPct: utilisationPct as number,
      age,
      oldFleet: age >= 15,
      sapStatus,
      soNumber,
      soStart,
      soEnd,
    });
  });

  const errorCount = issues.filter((issue) => issue.severity === "error").length;
  const warningCount = issues.filter((issue) => issue.severity === "warning").length;
  return { fatal: false, rows, issues, errorCount, warningCount };
}
