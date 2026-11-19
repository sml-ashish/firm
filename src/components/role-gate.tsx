"use client";

import { Lock } from "lucide-react";
import { Hint } from "@/components/hint";

/**
 * Wraps role-restricted UI. When the current role is not allowed, the children
 * are rendered disabled-looking inside a tooltip that explains why.
 */
export function RoleGate({
  role,
  allow,
  children,
  reason,
  mode = "hide",
}: {
  role: string;
  allow: string[];
  children: React.ReactNode;
  reason: string;
  mode?: "hide" | "disable";
}) {
  const allowed = role === "ADMIN" || allow.includes(role);
  if (allowed) return <>{children}</>;

  if (mode === "hide") {
    return (
      <Hint label={reason}>
        <span className="inline-flex cursor-not-allowed items-center gap-1.5 rounded-lg border border-line bg-panel-2 px-2.5 py-1.5 text-[12px] font-medium text-faint">
          <Lock size={11} /> Restricted
        </span>
      </Hint>
    );
  }

  return (
    <Hint label={reason}>
      <span
        aria-disabled
        className="inline-flex cursor-not-allowed items-center gap-1.5 rounded-lg border border-line bg-panel-2 px-2.5 py-1.5 text-[12px] font-medium text-faint opacity-80"
      >
        <Lock size={11} /> {children}
      </span>
    </Hint>
  );
}
