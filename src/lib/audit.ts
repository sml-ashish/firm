import type { Database } from "@/db";
import { auditLog } from "@/db/schema";

export async function logAudit(
  db: Database,
  input: {
    actorId?: number | null;
    actorName?: string | null;
    action: string;
    entity?: string | null;
    entityId?: string | number | null;
    details?: Record<string, unknown>;
  },
): Promise<void> {
  await db.insert(auditLog).values({
    actorId: input.actorId ?? null,
    actorName: input.actorName ?? null,
    action: input.action,
    entity: input.entity ?? null,
    entityId: input.entityId != null ? String(input.entityId) : null,
    details: input.details ?? {},
  });
}
