"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, ClipboardCheck, CornerDownLeft } from "lucide-react";
import { AgeChip } from "@/components/dashboard/age-chip";
import { StatusChip } from "@/components/status-chip";
import { EmptyState } from "@/components/empty-state";
import { SectionCard } from "@/components/dashboard/section-card";
import { STATUS_MAP, ROLE_MAP, type Role } from "@/lib/firm/workflow";
import type { ApprovalItem } from "@/lib/firm/api";

function openCrane(id: string) {
  window.dispatchEvent(new CustomEvent("firm-open-crane", { detail: id }));
}

const URGENCY: Record<string, number> = {
  S14: 0, S10: 1, S11: 1, S02: 2, S06: 2, S13: 3, S01: 4, S07: 5,
};

export function MyQueue({
  items,
  role,
  readOnly = false,
}: {
  items: (ApprovalItem & { days: number })[];
  role: string;
  readOnly?: boolean;
}) {
  const ordered = [...items].sort(
    (a, b) => (URGENCY[a.crane.status] ?? 9) - (URGENCY[b.crane.status] ?? 9) || b.days - a.days,
  );
  const [cursor, setCursor] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);
  const roleName = ROLE_MAP[role as Role]?.name ?? role;

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      if (target && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)) return;
      if (event.key === "j" || event.key === "J" || event.key === "k" || event.key === "K") {
        event.preventDefault();
        setCursor((current) => {
          const next = event.key.toLowerCase() === "j"
            ? Math.min(ordered.length - 1, current + 1)
            : Math.max(0, current - 1);
          listRef.current?.querySelector<HTMLElement>(`[data-queue-index="${next}"]`)?.focus();
          return next;
        });
      }
      if (!readOnly && (event.key === "a" || event.key === "A" || event.key === "r" || event.key === "R") && ordered[cursor]) {
        event.preventDefault();
        openCrane(ordered[cursor].crane.id);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [ordered, cursor, readOnly]);

  return (
    <SectionCard
      title="My queue"
      description={readOnly
        ? `No decisions are assigned to ${roleName}. Open a crane to read its record.`
        : `Waiting on ${roleName} · sorted by urgency. J/K to move, A/R to open a decision.`}
      actions={
        <Link href="/approvals" className="btn btn-secondary h-9">
          All approvals <ArrowUpRight size={13} />
        </Link>
      }
    >
      {ordered.length === 0 ? (
        <EmptyState
          icon={<ClipboardCheck size={19} />}
          title={readOnly ? "Your role is view-only" : "Nothing needs your decision"}
          description={readOnly
            ? "You can inspect every crane, its approvals and its SAP record without changing anything."
            : "No crane is currently waiting on your role. The register still shows the full cycle."}
          actions={<Link href="/cranes" className="btn btn-secondary">Open crane register</Link>}
        />
      ) : (
        <div ref={listRef} className="space-y-2">
          {ordered.map((item, index) => (
            <div
              key={`${item.crane.id}-${item.decision}`}
              data-queue-index={index}
              tabIndex={0}
              onFocus={() => setCursor(index)}
              className="group flex flex-wrap items-center gap-3 rounded-[8px] border border-line bg-panel-2 px-3 py-2.5 outline-none transition duration-200 ease-out hover:border-brand focus-visible:ring-2 focus-visible:ring-brand"
            >
              <span className={`h-8 w-1 shrink-0 rounded-full ${item.crane.status === "S14" ? "bg-danger" : item.crane.status === "S10" || item.crane.status === "S11" ? "bg-warning" : "bg-brand"}`} aria-hidden />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => openCrane(item.crane.id)}
                    className="font-mono text-[13px] font-semibold text-brand hover:underline focus-visible:ring-2 focus-visible:ring-brand"
                  >
                    {item.crane.equipmentId}
                  </button>
                  <StatusChip status={item.crane.status} compact />
                  <AgeChip days={item.days} />
                </div>
                <p className="mt-1 truncate text-[12px] text-muted">
                  {item.decision} · {STATUS_MAP[item.crane.status].hint}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => openCrane(item.crane.id)}
                  className="btn btn-primary h-9"
                  aria-label={`${readOnly ? "View" : "Review"} ${item.crane.equipmentId}`}
                >
                  {readOnly ? "View" : "Review"} <CornerDownLeft size={12} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </SectionCard>
  );
}
