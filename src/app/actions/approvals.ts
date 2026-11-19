"use server";

import { desc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getDb } from "@/db";
import { approvals, evaluationRuns } from "@/db/schema";
import { hasRole, requireUser } from "@/lib/auth";
import { STAGE_LABELS, type Role } from "@/lib/workflow";
import { logAudit } from "@/lib/audit";

export interface ApprovalState {
  ok?: boolean;
  error?: string;
  message?: string;
}

type Action = "PREPARE" | "REVIEW" | "APPROVE" | "RETURN";

const ACTION_CONFIG: Record<
  Action,
  { from: string[]; to: string; stage: string; role: Role; verb: string }
> = {
  PREPARE: { from: ["PENDING", "RETURNED"], to: "PREPARED", stage: "PREPARED", role: "PREPARER", verb: "prepared" },
  REVIEW: { from: ["PREPARED"], to: "REVIEWED", stage: "REVIEWED", role: "REVIEWER", verb: "reviewed" },
  APPROVE: { from: ["REVIEWED"], to: "APPROVED", stage: "APPROVED", role: "APPROVER", verb: "approved" },
  RETURN: { from: ["PREPARED", "REVIEWED"], to: "RETURNED", stage: "", role: "REVIEWER", verb: "returned" },
};

export async function submitApproval(
  _prev: ApprovalState | null,
  formData: FormData,
): Promise<ApprovalState> {
  const user = await requireUser();
  const runId = Number(formData.get("runId"));
  const action = String(formData.get("action") ?? "") as Action;
  const comment = String(formData.get("comment") ?? "").trim();

  if (!Number.isFinite(runId) || runId <= 0) {
    return { error: "Invalid evaluation run." };
  }
  if (!(action in ACTION_CONFIG)) {
    return { error: "Unknown sign-off action." };
  }
  const config = ACTION_CONFIG[action];

  if (!hasRole(user, config.role)) {
    return {
      error: `This action requires the ${config.role} role. You are signed in as ${user.role}.`,
    };
  }
  if (action === "RETURN" && !comment) {
    return { error: "Add a comment explaining what needs to be reworked." };
  }

  const db = await getDb();
  const rows = await db
    .select()
    .from(evaluationRuns)
    .where(eq(evaluationRuns.id, runId))
    .limit(1);
  const run = rows[0];
  if (!run) return { error: "Evaluation run not found." };

  if (!config.from.includes(run.status)) {
    return {
      error: `This run is currently "${run.status}", so it cannot be ${config.verb} from here. Refresh the page.`,
    };
  }

  // Segregation of duties: the same person cannot record consecutive stages.
  if (user.role !== "ADMIN") {
    const previous = await db
      .select()
      .from(approvals)
      .where(eq(approvals.runId, runId))
      .orderBy(desc(approvals.actedAt), desc(approvals.id))
      .limit(1);
    if (previous[0]?.actorId === user.id) {
      return {
        error:
          "Segregation of duties: you recorded the previous stage of this run. A different reviewer or approver must act next.",
      };
    }
  }

  let stage = config.stage;
  if (action === "RETURN") {
    stage = run.status === "PREPARED" ? "REVIEWED" : "APPROVED";
  }

  await db.insert(approvals).values({
    runId,
    stage,
    actorId: user.id,
    actorName: user.name,
    designation: user.designation,
    action,
    comment: comment || null,
  });

  await db
    .update(evaluationRuns)
    .set({ status: config.to })
    .where(eq(evaluationRuns.id, runId));

  await logAudit(db, {
    actorId: user.id,
    actorName: user.name,
    action: `RUN_${action}`,
    entity: "evaluation_run",
    entityId: runId,
    details: {
      from: run.status,
      to: config.to,
      stage,
      comment: comment || null,
    },
  });

  revalidatePath(`/runs/${runId}`);
  revalidatePath("/runs");
  revalidatePath("/approvals");
  revalidatePath("/");
  revalidatePath("/assets");
  revalidatePath("/assets/[code]", "page");

  const message =
    action === "RETURN"
      ? `Run #${runId} returned for rework.`
      : `Run #${runId} ${config.verb} — status is now ${
          STAGE_LABELS[config.to] ?? config.to
        }.`;

  return { ok: true, message };
}
