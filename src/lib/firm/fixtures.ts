/**
 * First-run state for the FIRM workflow store.
 *
 * The app intentionally starts empty: cycles and cranes are created by FP&A
 * through the nine-column Excel upload on /import. Login accounts are seeded
 * separately in src/db/index.ts and are unaffected by this file.
 */
import type { Crane, Cycle } from "./types";

export function buildFixtures(): { cycles: Cycle[]; cranes: Crane[] } {
  return { cycles: [], cranes: [] };
}
