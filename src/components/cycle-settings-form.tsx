"use client";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";
import { updateCycleAction, type ActionState } from "@/app/actions/firm";

export function CycleSettingsForm({
  cycleId,
  startDate,
  endDate,
  status,
  showStatus = true,
}: {
  cycleId: string;
  startDate: string | null;
  endDate: string | null;
  status: "OPEN" | "CLOSED";
  showStatus?: boolean;
}) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(updateCycleAction, null);

  useEffect(() => {
    if (state?.ok) toast.success(state.ok);
    if (state?.error) toast.error(state.error);
  }, [state]);

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="cycleId" value={cycleId} />
      {!showStatus && <input type="hidden" name="status" value={status} />}
      <div className={`grid gap-3 ${showStatus ? "sm:grid-cols-3" : "sm:grid-cols-2"}`}>
        <label className="block">
          <span className="mb-1 block text-[12px] font-semibold text-ink">Cycle start date</span>
          <input
            type="date"
            name="startDate"
            defaultValue={startDate ?? ""}
            className="input h-9"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-[12px] font-semibold text-ink">Cycle end date</span>
          <input
            type="date"
            name="endDate"
            defaultValue={endDate ?? ""}
            className="input h-9"
          />
        </label>
        {showStatus && (
          <label className="block">
            <span className="mb-1 block text-[12px] font-semibold text-ink">Cycle status</span>
            <select name="status" defaultValue={status} className="select h-9">
              <option value="OPEN">Open</option>
              <option value="CLOSED">Stopped</option>
            </select>
          </label>
        )}
      </div>
      <div className="flex items-center gap-2">
        <button type="submit" className="btn btn-primary h-9" disabled={pending}>
          {pending ? "Saving…" : "Save"}
        </button>
      </div>
      {state?.error && <p className="text-[12px] font-medium text-nd-ink">{state.error}</p>}
    </form>
  );
}
