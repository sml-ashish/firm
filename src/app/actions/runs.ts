"use server";

import { revalidatePath } from "next/cache";
import { sql } from "drizzle-orm";
import { getDb } from "@/db";
import { assets } from "@/db/schema";
import { hasRole, requireUser } from "@/lib/auth";
import { createEvaluationRun } from "@/lib/import";
import { logAudit } from "@/lib/audit";
import { toDateOnly } from "@/lib/classify";

export interface ReclassifyState {
  ok?: boolean;
  error?: string;
  runId?: number;
}

export async function reclassifyFleet(
  _prev: ReclassifyState | null,
  formData: FormData,
): Promise<ReclassifyState> {
  const user = await requireUser();
  if (!hasRole(user, "PREPARER")) {
    return { error: "Only a Preparer or Administrator can run a new classification." };
  }

  const dateRaw = String(formData.get("evaluationDate") ?? "").trim();
  const evaluationDate = dateRaw ? toDateOnly(dateRaw) : toDateOnly(new Date());
  if (!evaluationDate) {
    return { error: "Enter a valid evaluation date." };
  }
  const today = toDateOnly(new Date());
  if (today && evaluationDate.getTime() > today.getTime()) {
    return { error: "The evaluation date cannot be in the future." };
  }

  const db = await getDb();
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(assets);
  if (Number(count) === 0) {
    return { error: "There are no fleet assets to classify. Import a workbook first." };
  }

  try {
    const result = await createEvaluationRun(db, {
      evaluationDate: evaluationDate.toISOString().slice(0, 10),
      actorId: user.id,
    });

    await logAudit(db, {
      actorId: user.id,
      actorName: user.name,
      action: "RUN_RECLASSIFIED",
      entity: "evaluation_run",
      entityId: result.runId,
      details: {
        evaluationDate: evaluationDate.toISOString().slice(0, 10),
        assets: Number(count),
      },
    });

    revalidatePath("/runs");
    revalidatePath("/approvals");
    revalidatePath("/");
    revalidatePath("/assets");

    return { ok: true, runId: result.runId };
  } catch (error) {
    console.error("Reclassification failed", error);
    return {
      error:
        error instanceof Error
          ? `The classification run failed: ${error.message}`
          : "The classification run failed.",
    };
  }
}
