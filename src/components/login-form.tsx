"use client";

import Image from "next/image";
import { useActionState, useState } from "react";
import { ChevronDown, Clock3, LockKeyhole, Mail, ShieldAlert } from "lucide-react";
import { loginAction, type LoginState } from "@/app/actions/auth";
import { ROLE_MAP, type Role } from "@/lib/firm/workflow";

const DEMO_ACCOUNTS: { role: Role; email: string; label: string }[] = [
  { role: "FPNA", email: "fpna@firm.local", label: "FP&A" },
  { role: "SALES", email: "sales@firm.local", label: "Sales Team" },
  { role: "MAINTENANCE", email: "maintenance@firm.local", label: "Maintenance" },
  { role: "FINANCE", email: "finance@firm.local", label: "Finance" },
  { role: "STRATEGY", email: "strategy@firm.local", label: "Strategy" },
  { role: "BU", email: "bu1@firm.local", label: "SFRPL (BU1)" },
  { role: "BU", email: "bu2@firm.local", label: "Botswana (BU2)" },
  { role: "BU", email: "bu3@firm.local", label: "SMME (BU3)" },
  { role: "MARKETING", email: "marketing@firm.local", label: "Marketing" },
  { role: "SCM", email: "scm@firm.local", label: "SCM" },
  { role: "CBO", email: "cbo@firm.local", label: "CBO" },
  { role: "CSO", email: "cso@firm.local", label: "CSO" },
  { role: "MD", email: "md@firm.local", label: "MD" },
  { role: "GLOBAL_ADMIN", email: "admin@firm.local", label: "Global Administrator" },
];

const TONE: Record<string, string> = {
  slate: "badge-slate", brand: "badge-info", amber: "badge-amber",
  violet: "badge-old", red: "badge-red", green: "badge-healthy",
};

export function LoginForm() {
  const [state, formAction, pending] = useActionState<LoginState, FormData>(loginAction, null);
  const [email, setEmail] = useState("admin@firm.local");
  const [password, setPassword] = useState("Firm@12345");
  const [demoOpen, setDemoOpen] = useState(false);

  return (
    <div className="w-full max-w-[420px]">
      <div className="mb-6 flex items-center gap-3">
        <Image
          src="/brand/sml-logo.png"
          alt="Sanghvi Movers Limited"
          width={48}
          height={48}
          className="h-12 w-12 rounded-[11px] object-contain"
          priority
        />
        <div>
          <div className="font-display text-[17px] font-semibold tracking-[0.08em] text-ink">
            FIRM
          </div>
          <div className="text-[12px] uppercase tracking-[0.18em] text-faint">
            Fleet exit cycle · Sanghvi Movers Limited
          </div>
        </div>
      </div>

      <div className="card p-6 sm:p-7">
        <h1 className="font-display text-[23px] font-semibold tracking-[-0.02em] text-ink">
          Sign in
        </h1>
        <p className="mt-1.5 text-[12.5px] leading-relaxed text-muted">
          Use your FIRM account to access the crane exit workspace.
        </p>

        <form action={formAction} className="mt-6 space-y-4">
          <div>
            <label className="label" htmlFor="email">Email address</label>
            <div className="relative">
              <Mail size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-faint" />
              <input
                id="email" name="email" type="email" autoComplete="email" required
                value={email} onChange={(event) => setEmail(event.target.value)}
                className="input h-10 pl-9" placeholder="name@firm.local"
              />
            </div>
          </div>

          <div>
            <label className="label" htmlFor="password">Password</label>
            <div className="relative">
              <LockKeyhole size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-faint" />
              <input
                id="password" name="password" type="password" autoComplete="current-password" required
                value={password} onChange={(event) => setPassword(event.target.value)}
                className="input h-10 pl-9" placeholder="••••••••"
              />
            </div>
          </div>

          {state?.error && (
            <div role="alert" className="flex items-start gap-2 rounded-lg border border-[color-mix(in_srgb,var(--nd)_30%,transparent)] bg-nd-soft px-3 py-2 text-[12px] font-medium text-nd-ink">
              <ShieldAlert size={14} className="mt-0.5 shrink-0" />
              {state.error}
            </div>
          )}

          <button type="submit" className="btn btn-primary h-10 w-full" disabled={pending}>
            {pending ? "Signing in…" : "Sign in"}
          </button>

          <p className="flex items-center gap-1.5 text-[12px] text-faint">
            <Clock3 size={12} /> Session lasts 12 hours. You will be asked to sign in again after it expires.
          </p>
        </form>
      </div>

      <div className="mt-4 rounded-xl border border-line bg-panel">
        <button
          type="button"
          onClick={() => setDemoOpen((open) => !open)}
          aria-expanded={demoOpen}
          className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left"
        >
          <span>
            <span className="block text-[12px] font-semibold text-ink">Demo accounts</span>
            <span className="block text-[12px] text-faint">
              One per role, with three BU logins · click to fill · password Firm@12345
            </span>
          </span>
          <ChevronDown size={15} className={`shrink-0 text-faint transition-transform ${demoOpen ? "rotate-180" : ""}`} />
        </button>

        {demoOpen && (
          <div className="border-t border-line p-2">
            <ul className="max-h-[280px] space-y-1 overflow-y-auto scroll-thin">
              {DEMO_ACCOUNTS.map((account) => {
                const meta = ROLE_MAP[account.role];
                return (
                  <li key={account.email}>
                    <button
                      type="button"
                      onClick={() => { setEmail(account.email); setPassword("Firm@12345"); }}
                      className="flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-left transition hover:bg-panel-2"
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-[12px] font-medium text-ink">{account.label}</span>
                        <span className="block truncate text-[12px] text-faint">{account.email}</span>
                      </span>
                      <span className={`badge ${TONE[meta.tone] ?? "badge-slate"}`}>{meta.short}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
            <p className="px-2.5 pb-1 pt-2 text-[12px] leading-relaxed text-faint">
              Change passwords and set <span className="font-mono">SESSION_SECRET</span> before any shared deployment.
            </p>
          </div>
        )}
      </div>

      <p className="mt-5 text-center text-[12px] text-faint">
        Sanghvi Movers Limited. Internal use only.
      </p>
    </div>
  );
}
