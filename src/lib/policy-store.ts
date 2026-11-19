import { eq } from "drizzle-orm";
import type { Database } from "@/db";
import { settings } from "@/db/schema";
import { POLICY_DEFAULTS, sanitizePolicy, type Policy } from "./policy";

export async function getPolicy(db: Database): Promise<Policy> {
  const rows = await db.select().from(settings).where(eq(settings.key, "policy"));
  if (rows.length === 0) return POLICY_DEFAULTS;
  try {
    return sanitizePolicy(JSON.parse(rows[0].value) as Partial<Policy>);
  } catch {
    return POLICY_DEFAULTS;
  }
}

export async function savePolicy(
  db: Database,
  input: Partial<Policy>,
): Promise<Policy> {
  const policy = sanitizePolicy(input);
  await db
    .insert(settings)
    .values({ key: "policy", value: JSON.stringify(policy), updatedAt: new Date() })
    .onConflictDoUpdate({
      target: settings.key,
      set: { value: JSON.stringify(policy), updatedAt: new Date() },
    });
  return policy;
}
