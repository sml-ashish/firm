"use client";

import { ThemeProvider } from "next-themes";
import * as Tooltip from "@radix-ui/react-tooltip";
import { Toaster } from "sonner";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false} disableTransitionOnChange>
      <Tooltip.Provider delayDuration={220}>
        {children}
        <Toaster
          position="bottom-right"
          closeButton
          toastOptions={{
            classNames: {
              toast:
                "!rounded-xl !border !border-[var(--line)] !bg-[var(--panel)] !text-[var(--ink)] !shadow-[var(--shadow-lg)] !text-[12.5px]",
              description: "!text-[var(--muted)]",
              actionButton: "!bg-[var(--brand)] !text-white",
              cancelButton: "!bg-[var(--panel-2)] !text-[var(--muted)]",
            },
          }}
        />
      </Tooltip.Provider>
    </ThemeProvider>
  );
}
