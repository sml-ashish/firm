"use client";

import * as Tooltip from "@radix-ui/react-tooltip";

export function Hint({
  label,
  children,
  side = "top",
}: {
  label: string;
  children: React.ReactNode;
  side?: "top" | "right" | "bottom" | "left";
}) {
  return (
    <Tooltip.Root>
      <Tooltip.Trigger asChild>{children}</Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Content
          side={side}
          sideOffset={6}
          className="z-50 max-w-[240px] rounded-lg border border-line bg-ink px-2.5 py-1.5 text-[12px] leading-relaxed text-panel shadow-[var(--shadow-md)]"
        >
          {label}
          <Tooltip.Arrow className="fill-ink" />
        </Tooltip.Content>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
}
