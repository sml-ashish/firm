"use client";

import { useCallback, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import type { Crane } from "@/lib/firm/types";

const CommandPalette = dynamic(
  () => import("@/components/dashboard/command-palette").then((m) => m.CommandPalette),
  { ssr: false },
);
const CraneDrawer = dynamic(
  () => import("@/components/dashboard/crane-drawer").then((m) => m.CraneDrawer),
  { ssr: false },
);

/**
 * Mounts the three global overlays once for the authenticated shell.
 * Any link whose href is `/cranes/<id>` opens the drawer instead of navigating,
 * unless it carries `data-no-drawer` or is opened with a modifier key.
 */
export function DashboardOverlays({
  cranes,
  users,
  cycleId,
  role,
  userName,
}: {
  cranes: Crane[];
  users: { name: string; email: string; role: string }[];
  cycleId: string;
  role: string;
  userName: string;
}) {
  const searchParams = useSearchParams();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    const crane = searchParams.get("crane");
    if (crane) setSelectedId(crane);
  }, [searchParams]);

  useEffect(() => {
    function onOpen(event: Event) {
      const id = (event as CustomEvent<string>).detail;
      if (id) setSelectedId(id);
    }
    window.addEventListener("firm-open-crane", onOpen);
    return () => window.removeEventListener("firm-open-crane", onOpen);
  }, []);

  useEffect(() => {
    function onClick(event: MouseEvent) {
      if (event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      const link = target?.closest<HTMLAnchorElement>('a[href^="/cranes/"]');
      if (!link || link.hasAttribute("data-no-drawer")) return;
      const match = link.getAttribute("href")?.match(/^\/cranes\/([^/?#]+)/);
      if (!match) return;
      const id = decodeURIComponent(match[1]);
      if (!cranes.some((crane) => crane.id === id || crane.equipmentId === id)) return;
      event.preventDefault();
      setSelectedId(id);
    }
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, [cranes]);

  const close = useCallback(() => setSelectedId(null), []);

  return (
    <>
      <CommandPalette cranes={cranes} users={users} cycleId={cycleId} role={role} />
      <CraneDrawer cranes={cranes} selectedId={selectedId} onClose={close} role={role} />
    </>
  );
}
