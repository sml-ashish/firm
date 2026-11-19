"use client";

import { Info } from "lucide-react";
import { Hint } from "@/components/hint";

/** Small, keyboard-accessible explainer icon for domain terms. */
export function InfoTip({ text, label = "More about this" }: { text: string; label?: string }) {
  return (
    <Hint label={text}>
      <button
        type="button"
        aria-label={label}
        className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-faint transition hover:bg-brand-soft hover:text-brand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
      >
        <Info size={12} />
      </button>
    </Hint>
  );
}
