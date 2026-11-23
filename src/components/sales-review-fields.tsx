"use client";

import { useState } from "react";

/**
 * Shared Sales review inputs. Duration is only offered when the crane is
 * marketable (document §11: "Expected deployment duration (M if marketable)").
 * NRG/RG is system-classified at upload and is shown read-only.
 */
export function SalesReviewFields({
  marketable,
  expectedMonths,
  nrg,
  variant = "dialog",
}: {
  marketable?: string | null;
  expectedMonths?: number | null;
  nrg?: boolean | null;
  variant?: "dialog" | "inline";
}) {
  const [selected, setSelected] = useState(marketable ?? "Marketable");
  const [months, setMonths] = useState(expectedMonths ?? "");
  const dialog = variant === "dialog";

  return (
    <>
      <select
        name="marketable"
        value={selected}
        onChange={(event) => setSelected(event.target.value)}
        className={dialog ? "select h-9 w-full" : "select h-9 w-auto"}
        aria-label="Marketability"
      >
        <option>Marketable</option>
        <option>Not marketable</option>
      </select>

      {nrg != null && (
        <span className={`badge ${nrg ? "badge-orange" : "badge-healthy"}`}>
          NRG / RG · {nrg ? "NRG" : "RG"} (set at upload)
        </span>
      )}

      {selected === "Marketable" && (
        <input
          name="expectedMonths"
          type="number"
          min="1"
          step="1"
          required
          value={months}
          onChange={(event) => setMonths(event.target.value)}
          placeholder="Duration (months)"
          className={dialog ? "input h-9 w-full" : "input h-9 w-[150px] tabular-nums"}
          aria-label="Expected deployment duration (months)"
        />
      )}
    </>
  );
}
