import { LockKeyhole } from "lucide-react";
import { Hint } from "@/components/hint";

/** A disabled action that stays visible, explaining which role can perform it. */
export function LockedActionChip({
  label,
  role,
}: {
  label: string;
  role: string;
}) {
  return (
    <Hint label={`Requires the ${role} role. Your role cannot perform this action.`}>
      <span
        className="inline-flex cursor-not-allowed items-center gap-1.5 rounded-[6px] border border-line bg-panel-2 px-2.5 py-1.5 text-[12px] font-medium text-muted"
        aria-disabled="true"
      >
        <LockKeyhole size={12} aria-hidden />
        {label}
      </span>
    </Hint>
  );
}
