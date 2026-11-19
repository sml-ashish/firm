import * as XLSX from "xlsx";
import { MODEL_COUNT, MODEL_MASTER } from "./models";
import { POLICY_DEFAULTS } from "./policy";
import { trailingFinancialYears } from "./classify";

export const FLEET_HEADERS = [
  "Asset Code",
  "Equipment Description",
  "OEM / Make",
  "Model",
  "Equipment Category",
  "Capacity (MT)",
  "Year of Manufacture (YOM)",
  "Capitalisation Date",
  "Original Capex (INR)",
  "Gross Block (INR)",
  "Net Book Value (INR)",
  "Replacement Capex (INR)",
  "Location",
  "Region",
  "Current Status",
  "OEM Support Status",
  "Critical Spares Availability",
  "Safety / Regulatory / Emission Compliance",
  "Estimated Repair Cost (INR)",
  "Fitness Certificate Expiry",
  "Lifting License Expiry",
  "Third-Party Inspection Expiry",
  "PESO / Factory License Expiry",
  "Notes",
];

export const PERFORMANCE_HEADERS = [
  "Asset Code",
  "Financial Year",
  "Available Days",
  "Deployed Days",
  "Rental Revenue (INR)",
  "Operating Cost (INR)",
  "Capital Employed (INR)",
];

export const RETENTION_HEADERS = [
  "Asset Code",
  "Evaluation Date",
  "5-Year Rentability Committable (Yes/No)",
  "NPV of 5-Year Cash Flows (INR)",
  "Achievable Sale Price (INR)",
  "Return on Capital Released (%)",
  "Crane 5-Year Return (%)",
  "Recommendation",
  "Justification",
];

function makeSheet(rows: unknown[][], widths?: number[], autoFilter = false): XLSX.WorkSheet {
  const sheet = XLSX.utils.aoa_to_sheet(rows);
  if (widths) sheet["!cols"] = widths.map((wch) => ({ wch }));
  if (autoFilter && rows.length > 0) {
    const width = Math.max(...rows.map((row) => row.length));
    sheet["!autofilter"] = {
      ref: XLSX.utils.encode_range({
        s: { r: 0, c: 0 },
        e: { r: rows.length - 1, c: width - 1 },
      }),
    };
  }
  return sheet;
}

/* ------------------------------------------------------------------ */
/* Blank template                                                      */
/* ------------------------------------------------------------------ */

export function buildTemplateWorkbook(evaluationDate = new Date()): Buffer {
  const wb = XLSX.utils.book_new();
  const years = trailingFinancialYears(evaluationDate, POLICY_DEFAULTS.nrgYears).reverse();

  const instructions: unknown[][] = [
    ["FIRM — Fleet Classification Data Template"],
    ["Sanghvi Movers Limited  |  Old Fleet · Non-Deployable · NRG"],
    [],
    ["HOW TO USE"],
    [
      "1. Fleet Master — one row per crane. Asset Code, Model and Year of Manufacture (YOM) are mandatory.",
    ],
    [
      `2. Annual Performance — one row per crane per financial year. ${POLICY_DEFAULTS.nrgYears} consecutive years (${years.join(", ")}) are required to test NRG Condition 1.`,
    ],
    [
      "3. Retention Assessment — the business team's five-year rentability view, required to conclude NRG Condition 2.",
    ],
    [
      "4. Upload the completed workbook on the Import Data page. A validation preview is shown before anything is committed.",
    ],
    [],
    ["REQUIRED COLUMNS"],
    ["Fleet Master: Asset Code, Model, Year of Manufacture (YOM)"],
    [
      "Annual Performance: Asset Code, Financial Year, Available Days, Deployed Days, Rental Revenue, Capital Employed",
    ],
    [
      "Retention Assessment: Asset Code, 5-Year Rentability Committable, NPV of 5-Year Cash Flows, Achievable Sale Price, Return on Capital Released, Crane 5-Year Return",
    ],
    [],
    ["MODEL VALIDATION"],
    [
      `The Model column is validated against the approved master of ${MODEL_COUNT} models on the Model Master sheet. Unknown models are imported with a warning, but no model-specific age threshold is applied.`,
    ],
    [],
    ["POLICY THRESHOLDS APPLIED"],
    [`Old Fleet: equipment age exceeds ${POLICY_DEFAULTS.oldFleetYears} years from Year of Manufacture.`],
    [
      `Non-Deployable: Old Fleet obsolescence trigger, any statutory certificate lapsed by more than ${POLICY_DEFAULTS.certGraceDays} days, or age above the model-specific threshold (15 / 20 / 25 years).`,
    ],
    [
      `NRG: utilisation below ${POLICY_DEFAULTS.nrgUtilPct}% AND monthly yield below ${POLICY_DEFAULTS.nrgYieldPct}% for ${POLICY_DEFAULTS.nrgYears} consecutive years (Condition 1), AND the retention economics test (Condition 2).`,
    ],
    [],
    ["NOTES"],
    [
      "Leave Evaluation Date blank on the Retention Assessment sheet to use the evaluation date selected during upload.",
    ],
    ["Do not rename the three data sheets. Extra sheets are ignored."],
    [
      "All monetary values are in INR. You may type 12500000 or 1.25 Cr — both are read correctly. Dates may be YYYY-MM-DD or DD/MM/YYYY.",
    ],
    [
      "Download the sample workbook from the Import Data page to see a complete, valid example of all three sheets.",
    ],
  ];
  XLSX.utils.book_append_sheet(
    wb,
    makeSheet(instructions, [118]),
    "Instructions",
  );

  XLSX.utils.book_append_sheet(
    wb,
    makeSheet([FLEET_HEADERS], [16, 34, 18, 18, 30, 12, 16, 16, 18, 18, 18, 20, 16, 14, 16, 20, 24, 32, 20, 20, 20, 24, 24, 36], true),
    "Fleet Master",
  );
  XLSX.utils.book_append_sheet(
    wb,
    makeSheet([PERFORMANCE_HEADERS], [16, 16, 14, 14, 20, 20, 22], true),
    "Annual Performance",
  );
  XLSX.utils.book_append_sheet(
    wb,
    makeSheet([RETENTION_HEADERS], [16, 16, 30, 24, 24, 24, 22, 16, 46], true),
    "Retention Assessment",
  );

  const modelRows: unknown[][] = [["Model", "Age Threshold (Years)", "Threshold Bucket"]];
  for (const entry of [...MODEL_MASTER].sort(
    (a, b) => a.threshold - b.threshold || a.model.localeCompare(b.model),
  )) {
    modelRows.push([entry.model, entry.threshold, `${entry.threshold}-year bucket`]);
  }
  modelRows.push([]);
  modelRows.push(["Total models", MODEL_COUNT, ""]);
  XLSX.utils.book_append_sheet(wb, makeSheet(modelRows, [22, 20, 22], true), "Model Master");

  const policyRows: unknown[][] = [
    ["Parameter", "Value", "Definition"],
    ["Old Fleet age threshold (years)", POLICY_DEFAULTS.oldFleetYears, "Age from YOM above which equipment is Old Fleet."],
    ["NRG utilisation threshold (%)", POLICY_DEFAULTS.nrgUtilPct, "Utilisation must remain below this level for the NRG test."],
    [
      "NRG monthly yield threshold (%)",
      POLICY_DEFAULTS.nrgYieldPct,
      "Monthly yield on capital employed = (annual rental revenue / capital employed) / 12 × 100.",
    ],
    ["NRG consecutive years", POLICY_DEFAULTS.nrgYears, "Consecutive trailing years the performance test must fail."],
    [
      "Repair cost threshold (% of replacement capex)",
      POLICY_DEFAULTS.repairPct,
      "Repair estimate above this share of prevailing replacement capex is an obsolescence trigger.",
    ],
    ["Certificate grace period (days)", POLICY_DEFAULTS.certGraceDays, "A lapsed certificate becomes a Non-Deployable trigger after this many days."],
    ["Obsolescence test scope", POLICY_DEFAULTS.obsoleteScope === "all" ? "All equipment" : "Old Fleet only", "Scope of the OEM support / spares / compliance / repair-cost triggers."],
  ];
  XLSX.utils.book_append_sheet(wb, makeSheet(policyRows, [42, 18, 90]), "Policy");

  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
}

/* ------------------------------------------------------------------ */
/* Sample workbook                                                     */
/* ------------------------------------------------------------------ */

const MODEL_CAPACITY: Record<string, number> = {
  F15: 15, F150: 50, F230: 80, G1600D: 100, "JCB530-110": 50, MT732: 75, QUY80: 80,
  SAC1600S: 160, SAC2000C8: 200, SCC1500C: 150, STC1100S: 110, STC1100T6: 110,
  STC1600T7: 160, TRX15: 15, XGS40K: 40, "AC 100": 100, "AC 80-1": 80, "AC 80-2": 80,
  "ATF-50": 50, "GMK 4075": 75, "GMK 5200": 200, "GMK 6300": 300, "GMK 6300L": 300,
  "H32XM-12": 120, "LTM 1070": 70, "LTM 1070/1": 70, "LTM 1080/1": 80, "LTM 1090": 90,
  "LTM 1090-4.1": 90, "LTM 1100": 100, "LTM 1100N": 100, "LTM 1125": 125,
  "LTM 1140": 140, "LTM 1160": 160, "LTM 1250-6.1": 250, "LTM-1300-1": 300, LTM1500: 500,
  "RTF 40-3": 40, SCC2500C: 250, "SCC3200A-2": 320, SCC6300C: 630, SCC7500A: 750,
  SCC8000A: 800, SCC800C: 80, SCS1500A: 150, TM890: 90, XGC12000: 1200, "XGC800-1": 800,
  XLC150: 150, "SCC9000A-1": 900, "SAC3000C8-8": 300, SAC7000T7: 700, "4000W": 400,
  "4100WS2": 450, CC1800: 180, CC2400: 240, "CC2400-1": 240, "CC2800-1": 280,
  "CC3800-1": 380, "CKE2500-2": 250, "KH700-2": 250, "LR 1800": 180, "LR1400-1": 400,
  "LR1400-2": 400, LR1750: 750, "M-250S2": 250, SCC16000A: 1600,
};

function oemFor(model: string): string {
  if (model.startsWith("LTM") || model.startsWith("LR")) return "Liebherr";
  if (model.startsWith("GMK") || model.startsWith("RTF")) return "Grove";
  if (model.startsWith("AC ") || model.startsWith("ATF") || model.startsWith("CC") || model.startsWith("TM"))
    return "Terex / Demag";
  if (model.startsWith("SCC") || model.startsWith("STC") || model.startsWith("SAC") || model.startsWith("SCS"))
    return "SANY";
  if (model.startsWith("XG") || model.startsWith("XLC") || model.startsWith("QUY")) return "XCMG";
  if (model.startsWith("CKE") || model.startsWith("KH")) return "Kobelco";
  if (model.startsWith("4000") || model.startsWith("4100") || model.startsWith("M-250")) return "Manitowoc";
  if (model.startsWith("JCB")) return "JCB";
  return "Other";
}

function categoryFor(model: string): string {
  return /^(CC|LR|SCC|CKE|KH|4000|4100|M-250|XGC|XLC|QUY)/.test(model)
    ? "Crawler Lattice Boom"
    : "Hydraulic Mobile Telescopic";
}

const MODELS_15 = ["SAC1600S", "STC1100S", "QUY80", "SCC1500C", "XGS40K", "F150", "SAC2000C8", "STC1600T7"];
const MODELS_20 = ["LTM 1090", "GMK 6300", "AC 100", "SCC2500C", "LTM 1100", "XGC12000", "LTM 1250-6.1", "SCC3200A-2"];
const MODELS_25 = ["CC2400", "LR1750", "CKE2500-2", "KH700-2", "4000W", "LR 1800"];

const REGIONS = [
  { region: "West", locations: ["Pune", "Mumbai", "Ahmedabad"] },
  { region: "North", locations: ["Delhi NCR", "Jaipur", "Lucknow"] },
  { region: "South", locations: ["Hyderabad", "Chennai", "Bengaluru"] },
  { region: "East", locations: ["Kolkata", "Bhubaneswar"] },
  { region: "Overseas", locations: ["Riyadh", "Dubai", "Muscat"] },
];

type Archetype = "strong" | "steady" | "borderline" | "poor" | "new";

function lcg(seed: number) {
  let state = seed % 2147483647;
  if (state <= 0) state += 2147483646;
  return () => {
    state = (state * 16807) % 2147483647;
    return (state - 1) / 2147483646;
  };
}

const money = (n: number) => Math.round(n);

export function buildSampleWorkbook(evaluationDate = new Date()): Buffer {
  const wb = XLSX.utils.book_new();
  const years = trailingFinancialYears(evaluationDate, POLICY_DEFAULTS.nrgYears);
  const currentYear = evaluationDate.getUTCFullYear();

  const fleetRows: unknown[][] = [FLEET_HEADERS];
  const performanceRows: unknown[][] = [PERFORMANCE_HEADERS];
  const retentionRows: unknown[][] = [RETENTION_HEADERS];

  const total = 42;
  for (let i = 0; i < total; i += 1) {
    const random = lcg(i + 11);
    const bucketModels =
      i % 3 === 0 ? MODELS_25 : i % 3 === 1 ? MODELS_20 : MODELS_15;
    const model = bucketModels[i % bucketModels.length];
    const threshold = MODEL_MASTER.find((m) => m.model === model)?.threshold ?? 15;
    const capacity = MODEL_CAPACITY[model] ?? 100;

    let age: number;
    if (threshold === 15) age = 6 + ((i * 7) % 14); // 6-19
    else if (threshold === 20) age = 10 + ((i * 5) % 14); // 10-23
    else age = 14 + ((i * 3) % 14); // 14-27
    if (i % 13 === 0) age = 2; // a few near-new units

    const yom = currentYear - age;
    const region = REGIONS[i % REGIONS.length];
    const location = region.locations[i % region.locations.length];
    const replacementCapex = money(5_000_000 + capacity * 720_000);
    const originalCapex = money(replacementCapex * (0.55 + 0.012 * age));
    const grossBlock = originalCapex;
    const netBookValue = money(
      originalCapex * Math.max(0.04, 1 - age / 22) * 0.72,
    );
    const capitalEmployed = money(replacementCapex * 0.55);

    let archetype: Archetype;
    if (i % 9 === 0 || i % 9 === 4) archetype = "poor";
    else if (i % 7 === 0) archetype = "borderline";
    else if (i % 11 === 0) archetype = "new";
    else if (i % 3 === 0) archetype = "steady";
    else archetype = "strong";

    const oemDiscontinued = [2, 13, 26, 35].includes(i);
    const sparesUnavailable = [5, 21, 37].includes(i);
    const nonCompliant = [9, 31].includes(i);
    const repairHigh = [16, 30].includes(i);
    const certLapsed = [7, 24].includes(i);
    const certMissing = [19, 33].includes(i);

    const status =
      certLapsed || repairHigh
        ? "Under Repair"
        : archetype === "poor"
          ? "Idle"
          : "Deployed";

    const repairQuote = money(
      replacementCapex * (repairHigh ? 0.31 + random() * 0.06 : 0.05 + random() * 0.06),
    );

    const fitnessExpiry = certLapsed ? "2025-11-30" : "2027-03-31";
    const liftingExpiry = "2027-06-30";
    const tpiExpiry = certMissing ? "" : "2027-01-31";
    const pesoExpiry = "2027-09-30";

    fleetRows.push([
      `SML-${String(i + 1).padStart(4, "0")}`,
      `${capacity} MT ${categoryFor(model)} Crane`,
      oemFor(model),
      model,
      categoryFor(model),
      capacity,
      yom,
      `${yom}-06-15`,
      originalCapex,
      grossBlock,
      netBookValue,
      replacementCapex,
      location,
      region.region,
      status,
      oemDiscontinued ? "Discontinued" : "Supported",
      sparesUnavailable ? "Not available" : "Available",
      nonCompliant ? "Non-compliant" : "Compliant",
      repairQuote,
      fitnessExpiry,
      liftingExpiry,
      tpiExpiry,
      pesoExpiry,
      "Synthetic demo data for evaluation",
    ]);

    const revenueFactor =
      archetype === "strong"
        ? 2.1 + random() * 0.5
        : archetype === "steady"
          ? 1.9 + random() * 0.25
          : archetype === "borderline"
            ? 1.72 + random() * 0.16
            : archetype === "new"
              ? 2.0 + random() * 0.4
              : 1.05 + random() * 0.55;

    const utilisationFactor =
      archetype === "strong"
        ? 74 + random() * 12
        : archetype === "steady"
          ? 63 + random() * 9
          : archetype === "borderline"
            ? 57 + random() * 8
            : archetype === "new"
              ? 70 + random() * 10
              : 36 + random() * 18;

    const yearsForAsset = archetype === "new" ? years.slice(0, 2) : years;
    for (const fy of yearsForAsset) {
      const jitter = 0.92 + random() * 0.16;
      const utilisation = Math.min(96, Math.max(20, utilisationFactor * jitter));
      const monthlyYield = Math.max(0.7, revenueFactor * (0.94 + random() * 0.12));
      const availableDays = 365;
      const deployedDays = Math.round((utilisation / 100) * availableDays);
      const revenue = money((monthlyYield / 100) * capitalEmployed * 12);
      performanceRows.push([
        `SML-${String(i + 1).padStart(4, "0")}`,
        fy,
        availableDays,
        deployedDays,
        revenue,
        money(revenue * 0.58),
        capitalEmployed,
      ]);
    }

    const includeRetention = !(archetype === "poor" && i % 3 === 0) && archetype !== "new";
    if (includeRetention) {
      const isPoor = archetype === "poor";
      const salePrice = money(replacementCapex * (isPoor ? 0.32 : 0.46));
      const npv = money(salePrice * (isPoor ? 0.78 : 1.35));
      retentionRows.push([
        `SML-${String(i + 1).padStart(4, "0")}`,
        "",
        isPoor ? "No" : "Yes",
        npv,
        salePrice,
        isPoor ? 21.5 : 12.8,
        isPoor ? 13.4 : 17.6,
        isPoor ? "Sell" : "Retain",
        isPoor
          ? "Business team cannot underwrite five-year rentability at 60% utilisation / 1.8% monthly yield; capital release earns a superior return."
          : "Five-year rentability underwritten; retained use earns a superior return.",
      ]);
    }
  }

  XLSX.utils.book_append_sheet(
    wb,
    makeSheet(fleetRows, [14, 34, 18, 18, 30, 12, 16, 16, 18, 18, 18, 20, 16, 14, 16, 20, 24, 32, 20, 20, 20, 24, 24, 34], true),
    "Fleet Master",
  );
  XLSX.utils.book_append_sheet(
    wb,
    makeSheet(performanceRows, [14, 16, 14, 14, 20, 20, 22], true),
    "Annual Performance",
  );
  XLSX.utils.book_append_sheet(
    wb,
    makeSheet(retentionRows, [14, 16, 30, 24, 24, 24, 22, 16, 60], true),
    "Retention Assessment",
  );

  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
}
