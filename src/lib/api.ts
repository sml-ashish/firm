import "server-only";

import { getDb } from "@/db";
import * as live from "@/lib/queries";
import * as mock from "@/lib/mock";
import type { Policy } from "@/lib/policy";

/**
 * Typed data facade used by every authenticated page.
 *
 * Set NEXT_PUBLIC_USE_MOCK=true to run the UI against the deterministic fixture
 * set in `src/lib/mock`. Otherwise the same functions read the live database.
 * Pages never import `@/lib/queries` or `@/db` directly, so swapping the data
 * source is a one-line change and the route components stay identical.
 */
const USE_MOCK = process.env.NEXT_PUBLIC_USE_MOCK === "true";

export type {
  ApprovalQueueItem,
  AssetDetail,
  AssetFilters,
  AssetListResult,
  AssetRow,
  DashboardData,
  ModelStat,
  ModelStatDetail,
  RegionStat,
  RunDetail,
  RunListItem,
} from "@/lib/queries";

export type { MockUser as ApiUser } from "@/lib/mock/data";

export const usingMockData = USE_MOCK;

export async function getDashboard(): Promise<live.DashboardData> {
  if (USE_MOCK) return mock.getDashboard();
  const db = await getDb();
  return live.getDashboardData(db);
}

export async function getAssets(filters: live.AssetFilters = {}): Promise<live.AssetListResult> {
  if (USE_MOCK) return mock.getAssets(filters);
  const db = await getDb();
  return live.listAssets(db, filters);
}

export async function getAssetDetail(code: string): Promise<live.AssetDetail | null> {
  if (USE_MOCK) return mock.getAssetDetail(code);
  const db = await getDb();
  return live.getAssetDetail(db, code);
}

export async function getRuns(limit = 50): Promise<live.RunListItem[]> {
  if (USE_MOCK) return mock.getRuns(limit);
  const db = await getDb();
  return live.listRuns(db, limit);
}

export async function getRunDetail(runId: number): Promise<live.RunDetail | null> {
  if (USE_MOCK) return mock.getRunDetail(runId);
  const db = await getDb();
  return live.getRunDetail(db, runId);
}

export async function getApprovalQueue(): Promise<live.ApprovalQueueItem[]> {
  if (USE_MOCK) return mock.getApprovalQueue();
  const db = await getDb();
  return live.getApprovalQueue(db);
}

export async function getModelStats(): Promise<Map<string, live.ModelStatDetail>> {
  if (USE_MOCK) return mock.getModelStats();
  const db = await getDb();
  return live.getModelStats(db);
}

export async function getPolicy(): Promise<Policy> {
  if (USE_MOCK) return mock.getPolicy();
  const { getPolicy: readPolicy } = await import("@/lib/policy-store");
  const db = await getDb();
  return readPolicy(db);
}

export async function getUsers(): Promise<mock.MockUser[]> {
  if (USE_MOCK) return mock.getUsers();
  const { asc } = await import("drizzle-orm");
  const { users } = await import("@/db/schema");
  const db = await getDb();
  return db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      role: users.role,
      designation: users.designation,
    })
    .from(users)
    .orderBy(asc(users.role), asc(users.name));
}
