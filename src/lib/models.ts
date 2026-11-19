/**
 * Approved model master extracted from "1.2 Definition Document for Project FIRM"
 * (Section 4.2, table of model-specific age thresholds).
 *
 * 67 equipment models across three age-threshold buckets: 15, 20 and 25 years.
 * The model list is authoritative - the tool validates every uploaded row
 * against it so that thresholds are never typed by hand.
 */

export type AgeBucket = 15 | 20 | 25;

export interface ModelInfo {
  /** Canonical model name as printed in the policy. */
  model: string;
  /** Model-specific age threshold (years) used for the Non-Deployable test. */
  threshold: AgeBucket;
}

const BUCKET_15 = [
  "F15",
  "F150",
  "F230",
  "G1600D",
  "JCB530-110",
  "MT732",
  "QUY80",
  "SAC1600S",
  "SAC2000C8",
  "SCC1500C",
  "STC1100S",
  "STC1100T6",
  "STC1600T7",
  "TRX15",
  "XGS40K",
];

const BUCKET_20 = [
  "AC 100",
  "AC 80-1",
  "AC 80-2",
  "ATF-50",
  "GMK 4075",
  "GMK 5200",
  "GMK 6300",
  "GMK 6300L",
  "H32XM-12",
  "LTM 1070",
  "LTM 1070/1",
  "LTM 1080/1",
  "LTM 1090",
  "LTM 1090-4.1",
  "LTM 1100",
  "LTM 1100N",
  "LTM 1125",
  "LTM 1140",
  "LTM 1160",
  "LTM 1250-6.1",
  "LTM-1300-1",
  "LTM1500",
  "RTF 40-3",
  "SCC2500C",
  "SCC3200A-2",
  "SCC6300C",
  "SCC7500A",
  "SCC8000A",
  "SCC800C",
  "SCS1500A",
  "TM890",
  "XGC12000",
  "XGC800-1",
  "XLC150",
  "SCC9000A-1",
  "SAC3000C8-8",
  "SAC7000T7",
];

const BUCKET_25 = [
  "4000W",
  "4100WS2",
  "CC1800",
  "CC2400",
  "CC2400-1",
  "CC2800-1",
  "CC3800-1",
  "CKE2500-2",
  "KH700-2",
  "LR 1800",
  "LR1400-1",
  "LR1400-2",
  "LR1750",
  "M-250S2",
  "SCC16000A",
];

export const MODEL_MASTER: ModelInfo[] = [
  ...BUCKET_15.map((model) => ({ model, threshold: 15 as AgeBucket })),
  ...BUCKET_20.map((model) => ({ model, threshold: 20 as AgeBucket })),
  ...BUCKET_25.map((model) => ({ model, threshold: 25 as AgeBucket })),
];

export const MODEL_COUNT = MODEL_MASTER.length;

/** Loose comparison key: ignores case, spaces, dashes, dots and underscores. */
export function modelKey(value: string): string {
  return value
    .toUpperCase()
    .replace(/[\s\-_.]+/g, "")
    .trim();
}

export const MODEL_INDEX: ReadonlyMap<string, ModelInfo> = new Map(
  MODEL_MASTER.map((entry) => [modelKey(entry.model), entry]),
);

export function lookupModel(value: string | null | undefined): ModelInfo | null {
  if (!value) return null;
  return MODEL_INDEX.get(modelKey(value)) ?? null;
}

export function modelsByBucket(bucket: AgeBucket): ModelInfo[] {
  return MODEL_MASTER.filter((entry) => entry.threshold === bucket);
}

export const BUCKET_COUNTS: Record<AgeBucket, number> = {
  15: BUCKET_15.length,
  20: BUCKET_20.length,
  25: BUCKET_25.length,
};

export const EQUIPMENT_CATEGORIES = [
  "Hydraulic Mobile Telescopic",
  "Crawler Lattice Boom",
] as const;

export type EquipmentCategory = (typeof EQUIPMENT_CATEGORIES)[number];
