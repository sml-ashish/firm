import { EyeOff } from "lucide-react";
import { EmptyState } from "@/components/empty-state";

/** Plain-language state for widgets whose data is hidden from the current role. */
export function RestrictedState({
  title = "Not available for your role",
  description = "This widget is shown for transparency, but your role does not have access to its data.",
}: {
  title?: string;
  description?: string;
}) {
  return (
    <EmptyState
      icon={<EyeOff size={19} />}
      title={title}
      description={description}
      tone="muted"
    />
  );
}
