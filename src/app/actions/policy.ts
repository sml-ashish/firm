"use server";

import { revalidatePath } from "next/cache";
import { getDb } from "@/db";
import { requireUser } from "@/lib/auth";
import { getPolicy, savePolicy } from "@/lib/policy-store";
import { logAudit } from "@/lib/audit";
import type { Policy } from "@/lib/policy";

export interface PolicyState {
  ok?: boolean;
  error?: string;
  message?: string;
}

function numberField(formData: FormData, key: keyof Policy, fallback: number): number {
  const raw = formData.get(key);
  if (raw == null || String(raw).trim() === "") return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export async function updatePolicy(
  _prev: PolicyState | null,
  formData: FormData,
): Promise<PolicyState> {
  const user = await requireUser();
  if (user.role !== "ADMIN") {
    return { error: "Only an Administrator can change policy thresholds." };
  }

  const db = await getDb();
  const before = await getPolicy(db);

  const input: Partial<Policy> = {
    oldFleetYears: numberField(formData, "oldFleetYears", before.oldFleetYears),
    nrgUtilPct: numberField(formData, "nrgUtilPct", before.nrgUtilPct),
    nrgYieldPct: numberField(formData, "nrgYieldPct", before.nrgYieldPct),
    nrgYears: numberField(formData, "nrgYears", before.nrgYears),
    repairPct: numberField(formData, "repairPct", before.repairPct),
    certGraceDays: numberField(formData, "certGraceDays", before.certGraceDays),
    obsoleteScope: formData.get("obsoleteScope") === "all" ? "all" : "old_fleet_only",
  };

  const after = await savePolicy(db, input);

  await logAudit(db, {
    actorId: user.id,
    actorName: user.name,
    action: "POLICY_UPDATED",
    entity: "settings",
    entityId: "policy",
    details: { before, after },
  });

  revalidatePath("/settings");
  revalidatePath("/");
  revalidatePath("/assets");
  revalidatePath("/models");

  return {
    ok: true,
    message:
      "Policy saved. Existing evaluation runs keep their original snapshot; run a new classification to apply these thresholds.",
  };
}
