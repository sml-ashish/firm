"use client";

import { useState } from "react";

/**
 * Shared Maintenance review inputs. A reason is mandatory only when the crane
 * is marked Non-Deployable, in both the single-crane and bulk dialogs.
 */
export function MaintenanceReviewFields({
  deployable,
  reason,
  variant = "dialog",
}: {
  deployable?: boolean | null;
  reason?: string | null;
  variant?: "dialog" | "inline";
}) {
  const [selected, setSelected] = useState(deployable === false ? "false" : "true");
  const [note, setNote] = useState(reason ?? "");
  const dialog = variant === "dialog";

  return (
    <>
      <select
        name="deployable"
        value={selected}
        onChange={(event) => setSelected(event.target.value)}
        className={dialog ? "select h-9 w-full" : "select h-9 w-auto"}
        aria-label="Deployability"
      >
        <option value="true">Deployable</option>
        <option value="false">Non-Deployable</option>
      </select>

      {selected === "false" && (
        <textarea
          name="reason"
          required
          value={note}
          onChange={(event) => setNote(event.target.value)}
          rows={2}
          className="input min-h-[64px] w-full py-2"
          placeholder="Reason for Non-Deployable (mandatory)"
          aria-label="Reason for Non-Deployable"
        />
      )}
    </>
  );
}
