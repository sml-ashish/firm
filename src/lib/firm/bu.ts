/**
 * International business units that Strategy can float a crane to.
 *
 * Each BU has its own login (BU1 / BU2 / BU3). A crane only enters the bins of
 * the BUs selected when Strategy floats it; an empty `invitedBus` on a crane is
 * treated as "all BUs" so cranes uploaded before this rule keep working.
 */
export const INTERNATIONAL_BUS = ["BU1", "BU2", "BU3"] as const;

export type BuCode = (typeof INTERNATIONAL_BUS)[number];

/** Display names used across the register, float dialog and audit trail. */
export const BU_LABELS: Record<BuCode, string> = {
  BU1: "BU1 · SFRPL",
  BU2: "BU2 · Botswana",
  BU3: "BU3 · SMME",
};

export function buLabel(code: string): string {
  return BU_LABELS[code as BuCode] ?? code;
}

/** Derive the logged-in BU from its designation, email or display name. */
export function buCodeForUser(user: {
  designation?: string | null;
  email?: string | null;
  name?: string | null;
}): BuCode | null {
  const candidates = [user.designation, user.email?.split("@")[0], user.name]
    .filter((value): value is string => !!value)
    .map((value) => value.trim().toUpperCase().replace(/[\s-]/g, ""));

  for (const candidate of candidates) {
    const match = INTERNATIONAL_BUS.find((bu) => candidate === bu || candidate.startsWith(bu));
    if (match) return match;
  }
  return null;
}

/** Normalise and validate the BU codes submitted by the float form. */
export function parseInvitedBus(value: unknown): BuCode[] | null {
  if (typeof value !== "string") return null;
  const raw = value.includes(",") ? value.split(",") : value.split("|");
  const codes = raw.map((item) => item.trim().toUpperCase()).filter(Boolean);
  if (codes.length === 0 || codes.length !== new Set(codes).size) return null;
  if (codes.some((code) => !INTERNATIONAL_BUS.includes(code as BuCode))) return null;
  return codes as BuCode[];
}
