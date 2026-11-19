"use client";

import { useEffect, useState } from "react";
import { Rows2, Rows3 } from "lucide-react";

const KEY = "firm-register-density";

export function DensityToggle() {
  const [compact, setCompact] = useState(false);

  useEffect(() => {
    const stored = window.localStorage.getItem(KEY) === "compact";
    setCompact(stored);
  }, []);

  useEffect(() => {
    document.documentElement.dataset.registerDensity = compact ? "compact" : "comfortable";
    window.localStorage.setItem(KEY, compact ? "compact" : "comfortable");
  }, [compact]);

  return (
    <div className="flex items-center gap-1 rounded-[6px] border border-line bg-panel-2 p-0.5" role="group" aria-label="Table density">
      <button
        type="button"
        onClick={() => setCompact(false)}
        aria-pressed={!compact}
        title="Comfortable density"
        className={`btn btn-ghost h-7 w-7 p-0 ${!compact ? "bg-panel text-ink" : ""}`}
      >
        <Rows3 size={14} />
      </button>
      <button
        type="button"
        onClick={() => setCompact(true)}
        aria-pressed={compact}
        title="Compact density"
        className={`btn btn-ghost h-7 w-7 p-0 ${compact ? "bg-panel text-ink" : ""}`}
      >
        <Rows2 size={14} />
      </button>
    </div>
  );
}
