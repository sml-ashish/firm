"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Activity, Search } from "lucide-react";
import { SectionCard } from "@/components/dashboard/section-card";
import { EmptyState } from "@/components/empty-state";

export interface ActivityEntry {
  id: string;
  at: string;
  actor: string;
  action: string;
  detail: string;
  craneId: string;
  equipmentId: string;
}

export function ActivityFeed({ entries }: { entries: ActivityEntry[] }) {
  const [filter, setFilter] = useState("");
  const [newCount, setNewCount] = useState(0);

  useEffect(() => {
    const last = window.localStorage.getItem("firm-activity-visit");
    const count = last ? entries.filter((entry) => entry.at > last).length : 0;
    setNewCount(count);
    window.localStorage.setItem("firm-activity-visit", new Date().toISOString());
  }, [entries]);

  const visible = useMemo(() => {
    const q = filter.trim().toLowerCase();
    const rows = q
      ? entries.filter((entry) => `${entry.actor} ${entry.action} ${entry.detail} ${entry.equipmentId}`.toLowerCase().includes(q))
      : entries;
    return rows.slice(0, 24);
  }, [entries, filter]);

  const groups = useMemo(() => {
    const map = new Map<string, ActivityEntry[]>();
    for (const entry of visible) {
      const day = entry.at.slice(0, 10);
      map.set(day, [...(map.get(day) ?? []), entry]);
    }
    return [...map.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  }, [visible]);

  return (
    <SectionCard
      title="Activity feed"
      description="Latest recorded decisions and workflow changes."
      actions={
        <div className="flex items-center gap-2">
          {newCount > 0 && <span className="badge badge-brand" aria-live="polite">{newCount} new</span>}
          <label className="relative">
            <Search size={12} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" />
            <input
              value={filter}
              onChange={(event) => setFilter(event.target.value)}
              placeholder="Filter by crane or person"
              className="input h-8 w-[210px] pl-8 text-[12px]"
              aria-label="Filter activity by crane or person"
            />
          </label>
        </div>
      }
    >
      {groups.length === 0 ? (
        <EmptyState icon={<Activity size={19} />} title="No activity" description="No recorded events match this filter." />
      ) : (
        <div className="max-h-[320px] space-y-4 overflow-y-auto scroll-thin pr-1" aria-live="polite">
          {groups.map(([day, items]) => (
            <div key={day}>
              <div className="mb-2 text-[12px] font-bold uppercase tracking-[0.08em] text-muted">{day}</div>
              <ol className="space-y-2 border-l border-line pl-3">
                {items.map((entry) => (
                  <li key={entry.id} className="relative text-[12px]">
                    <span className="absolute -left-[17px] top-1.5 h-2 w-2 rounded-full bg-brand" aria-hidden />
                    <div className="font-medium text-ink">{entry.action}</div>
                    <div className="text-muted">{entry.detail}</div>
                    <div className="mt-0.5 flex items-center gap-2 text-[12px] text-muted">
                      <Link href={`/cranes/${entry.craneId}`} className="font-mono font-semibold text-brand hover:underline">{entry.equipmentId}</Link>
                      <span>·</span>
                      <span>{entry.actor}</span>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          ))}
        </div>
      )}
    </SectionCard>
  );
}
