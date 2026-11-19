"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { Command } from "cmdk";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import type { LucideIcon } from "lucide-react";
import {
  ArrowDown,
  ArrowUp,
  BadgeCheck,
  CalendarRange,
  CheckCircle2,
  Command as CommandIcon,
  CornerDownLeft,
  FileText,
  LayoutDashboard,
  LockKeyhole,
  Search,
  ShieldAlert,
  SlidersHorizontal,
  Truck,
  Undo2,
  UploadCloud,
  UserRound,
  UsersRound,
  X,
} from "lucide-react";
import type { Crane } from "@/lib/firm/types";
import { ROLES, STATUS_MAP } from "@/lib/firm/workflow";

type PaletteUser = { name: string; email: string; role: string };

interface PaletteItem {
  value: string;
  label: string;
  secondary: string;
  icon: LucideIcon;
  href: string;
  badge?: string;
  badgeClass?: string;
}

interface PaletteGroup {
  heading: string;
  note?: string;
  items: PaletteItem[];
}

interface PaletteModel {
  command: PaletteItem | null;
  groups: PaletteGroup[];
  firstValue: string;
  itemCount: number;
}

const TONE_BADGE: Record<string, string> = {
  slate: "badge-slate",
  brand: "badge-brand",
  amber: "badge-amber",
  violet: "badge-old",
  red: "badge-red",
  green: "badge-green",
};

const ACTIONS: {
  id: string;
  label: string;
  secondary: string;
  href: string;
  icon: LucideIcon;
  keywords: string;
}[] = [
  {
    id: "dashboard",
    label: "Go to dashboard",
    secondary: "Workspace overview and KPIs",
    href: "/",
    icon: LayoutDashboard,
    keywords: "home overview start",
  },
  {
    id: "cranes",
    label: "Open crane register",
    secondary: "Every crane in the current cycle",
    href: "/cranes",
    icon: Truck,
    keywords: "fleet list equipment register",
  },
  {
    id: "approvals",
    label: "My approvals",
    secondary: "Decisions waiting on you",
    href: "/approvals",
    icon: BadgeCheck,
    keywords: "pending decisions waiting sign off",
  },
  {
    id: "upload",
    label: "Upload fleet",
    secondary: "Import a crane list for a cycle",
    href: "/import",
    icon: UploadCloud,
    keywords: "import excel spreadsheet sheet",
  },
  {
    id: "settings",
    label: "Rules & settings",
    secondary: "Workflow rules and configuration",
    href: "/settings",
    icon: SlidersHorizontal,
    keywords: "rules policy configuration",
  },
  {
    id: "roles",
    label: "Roles & people",
    secondary: "Who does what in the cycle",
    href: "/roles",
    icon: UsersRound,
    keywords: "users team directory responsibilities",
  },
];

function matches(query: string, ...fields: (string | null | undefined)[]): boolean {
  if (!query) return true;
  return fields.some((field) => !!field && field.toLowerCase().includes(query));
}

function capNote(total: number, shown: number): string | undefined {
  return total > shown ? `showing ${shown} of ${total}` : undefined;
}

/** Translate a natural-language command into a single, top-priority navigation. */
function resolveCommand(query: string): PaletteItem | null {
  const trimmed = query.trim();
  if (!trimmed) return null;
  const lower = trimmed.toLowerCase();

  const approve = trimmed.match(/^approve\s+(.+)$/i);
  if (approve) {
    const id = approve[1].trim();
    if (id) {
      return {
        value: `cmd:approve:${id}`,
        label: `Approve ${id}`,
        secondary: "Open the approval queue for this crane",
        icon: CheckCircle2,
        href: `/approvals?crane=${encodeURIComponent(id)}`,
        badge: "Command",
        badgeClass: "badge-brand",
      };
    }
  }

  const cycle = trimmed.match(/^cycle\s+(.+)$/i);
  if (cycle) {
    const id = cycle[1].trim();
    if (id) {
      return {
        value: `cmd:cycle:${id}`,
        label: `Open cycle ${id}`,
        secondary: "Jump straight to this FIRM cycle",
        icon: CalendarRange,
        href: `/cycles/${encodeURIComponent(id)}`,
        badge: "Command",
        badgeClass: "badge-brand",
      };
    }
  }

  if (lower.includes("conflict")) {
    return {
      value: "cmd:conflicts",
      label: "Show conflicts",
      secondary: "Cranes paused at S14 · Conflict – Decision Pending",
      icon: ShieldAlert,
      href: "/cranes?status=S14",
      badge: "Command",
      badgeClass: "badge-brand",
    };
  }

  if (lower.includes("locked") || lower.includes("sap")) {
    return {
      value: "cmd:locked",
      label: "Show locked cranes",
      secondary: "Completed cranes locked in SAP (S16–S19)",
      icon: LockKeyhole,
      href: "/cranes?type=Locked",
      badge: "Command",
      badgeClass: "badge-brand",
    };
  }

  // "approval/waiting" command resolved later with role access check via canAccessPath on result if needed,
  // but resolveCommand doesn't take role; we handle by returning it and caller can filter. Easier: keep as-is,
  // callers should be aware, but buildModel will include it as command - however we don't filter command by access.
  // Let's make command respect approvals access by not suggesting when role can't access.
  if (lower.includes("waiting") || lower.includes("approval")) {
    return {
      value: "cmd:approvals",
      label: "Open approvals",
      secondary: "Every decision awaiting an approver",
      icon: BadgeCheck,
      href: "/approvals",
      badge: "Command",
      badgeClass: "badge-brand",
    };
  }

  if (lower.includes("claim")) {
    return {
      value: "cmd:claims",
      label: "Show claim-backs",
      secondary: "Cranes at S13 · Claim-Back Approval Pending",
      icon: Undo2,
      href: "/cranes?status=S13",
      badge: "Command",
      badgeClass: "badge-brand",
    };
  }

  return null;
}

function canAccessPath(role: string, href: string): boolean {
  const path = href.split("?")[0];
  const isAdmin = role === "GLOBAL_ADMIN";
  const canUpload = role === "FPNA" || isAdmin;
  const canApprove =
    !["FPNA", "SALES", "MAINTENANCE", "FINANCE", "MARKETING", "STRATEGY", "CSO", "SCM", "CBO"].includes(role) &&
    (isAdmin || ["STRATEGY", "CBO", "CSO", "MD"].includes(role));

  if (path === "/") return !["FPNA", "SALES", "MAINTENANCE", "FINANCE", "MARKETING", "STRATEGY", "CSO", "SCM", "CBO"].includes(role);
  if (path === "/import") return canUpload;
  if (path === "/approvals") return canApprove;
  if (path === "/roles") return isAdmin;
  if (path === "/settings") return isAdmin;
  return true;
}

function buildModel(
  search: string,
  cranes: Crane[],
  users: PaletteUser[],
  cycleId: string,
  role: string,
): PaletteModel {
  const query = search.trim();
  const lower = query.toLowerCase();
  const hasQuery = query.length > 0;
  const limit = hasQuery ? 30 : 8;

  const command = resolveCommand(query);
  const visibleCommand = command && canAccessPath(role, command.href) ? command : null;
  const groups: PaletteGroup[] = [];

  // Actions
  const actions = ACTIONS.filter(
    (action) =>
      canAccessPath(role, action.href) &&
      !(["FPNA", "SALES", "MAINTENANCE", "FINANCE", "MARKETING", "STRATEGY", "CSO", "SCM", "CBO"].includes(role) && action.href === "/") &&
      (!hasQuery || matches(lower, action.label, action.secondary, action.keywords)),
  );
  if (actions.length) {
    groups.push({
      heading: "Actions",
      items: actions.map((action) => ({
        value: `action:${action.id}`,
        label: action.label,
        secondary: action.secondary,
        icon: action.icon,
        href: action.href,
      })),
    });
  }

  // Cranes
  const filteredCranes = cranes.filter((crane) => {
    if (!hasQuery) return true;
    const meta = STATUS_MAP[crane.status];
    return matches(
      lower,
      crane.equipmentId,
      crane.description,
      crane.id,
      meta?.code,
      meta?.name,
    );
  });
  const craneItems: PaletteItem[] = filteredCranes.slice(0, limit).map((crane) => {
    const meta = STATUS_MAP[crane.status];
    return {
      value: `crane:${crane.id}`,
      label: crane.equipmentId,
      secondary: meta ? `${crane.description || "Crane"} · ${meta.code} ${meta.name}` : crane.description,
      icon: Truck,
      href: `/cranes/${encodeURIComponent(crane.id)}`,
      badge: crane.status,
      badgeClass: meta ? TONE_BADGE[meta.tone] : "badge-slate",
    };
  });
  if (craneItems.length) {
    groups.push({
      heading: "Cranes",
      note: capNote(filteredCranes.length, craneItems.length),
      items: craneItems,
    });
  }

  // SO numbers
  const withSo = cranes.filter((crane) => {
    const so = crane.sap?.soNumber;
    if (!so) return false;
    if (!hasQuery) return true;
    return matches(lower, so, crane.sap?.soEnd, crane.equipmentId);
  });
  const soItems: PaletteItem[] = withSo.slice(0, limit).map((crane) => ({
    value: `so:${crane.id}`,
    label: crane.sap.soNumber as string,
    secondary: `${crane.equipmentId} · SO end ${crane.sap.soEnd || "—"}`,
    icon: FileText,
    href: `/cranes/${encodeURIComponent(crane.id)}`,
    badge: crane.sap.currentStatus,
    badgeClass: "badge-slate",
  }));
  if (soItems.length) {
    groups.push({
      heading: "SO numbers",
      note: capNote(withSo.length, soItems.length),
      items: soItems,
    });
  }

  // Statuses — always expose all 20 codes with their names.
  const statuses = Object.values(STATUS_MAP);
  const filteredStatuses = statuses.filter((meta) =>
    !hasQuery || matches(lower, meta.code, meta.name, meta.type, meta.layer),
  );
  const statusItems: PaletteItem[] = filteredStatuses.map((meta) => ({
    value: `status:${meta.code}`,
    label: `${meta.code} · ${meta.name}`,
    secondary: `${meta.type} · ${meta.layer} · ${meta.impact}`,
    icon: Search,
    href: `/cranes?status=${meta.code}`,
    badge: meta.type,
    badgeClass: TONE_BADGE[meta.tone],
  }));
  if (statusItems.length) {
    groups.push({
      heading: "Statuses",
      note: capNote(statuses.length, statusItems.length),
      items: statusItems,
    });
  }

  // People
  if (canAccessPath(role, "/roles")) {
    const filteredUsers = users.filter((user) =>
      !hasQuery || matches(lower, user.name, user.email, user.role),
    );
    const peopleItems: PaletteItem[] = filteredUsers.slice(0, limit).map((user, index) => {
      const roleMeta = ROLES.find((r) => r.role === user.role);
      return {
        value: `person:${index}:${user.email}`,
        label: user.name,
        secondary: `${roleMeta?.short ?? user.role} · ${user.email}`,
        icon: UserRound,
        href: "/roles",
        badge: roleMeta?.short ?? user.role,
        badgeClass: "badge-slate",
      };
    });
    if (peopleItems.length) {
      groups.push({
        heading: "People",
        note: capNote(filteredUsers.length, peopleItems.length),
        items: peopleItems,
      });
    }
  }

  // Cycles
  const cycleItems: PaletteItem[] = matches(lower, cycleId, "cycle", "current")
    ? [
        {
          value: `cycle:${cycleId}`,
          label: cycleId ? `Cycle ${cycleId}` : "Current cycle",
          secondary: "Current FIRM cycle · open cycle detail",
          icon: CalendarRange,
          href: cycleId ? `/cycles/${encodeURIComponent(cycleId)}` : "/cycles",
          badge: "Current",
          badgeClass: "badge-brand",
        },
      ]
    : [];
  if (cycleItems.length) {
    groups.push({ heading: "Cycles", items: cycleItems });
  }

  const allItems = [
    ...(visibleCommand ? [visibleCommand] : []),
    ...groups.flatMap((group) => group.items),
  ];

  return {
    command: visibleCommand,
    groups,
    firstValue: allItems[0]?.value ?? "",
    itemCount: allItems.length,
  };
}

function ItemRow({
  item,
  onPick,
}: {
  item: PaletteItem;
  onPick: (href: string) => void;
}) {
  const Icon = item.icon;
  return (
    <Command.Item
      value={item.value}
      onSelect={() => onPick(item.href)}
      className="group flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 text-left outline-none transition-colors duration-150 motion-reduce:transition-none data-[selected=true]:bg-brand-soft data-[selected=true]:ring-1 data-[selected=true]:ring-[color-mix(in_srgb,var(--brand)_40%,transparent)]"
    >
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-panel-2 text-muted transition-colors duration-150 motion-reduce:transition-none group-data-[selected=true]:bg-brand group-data-[selected=true]:text-white">
        <Icon size={15} strokeWidth={1.9} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[12.5px] font-medium text-ink">{item.label}</span>
        <span className="block truncate text-[12px] text-faint">{item.secondary}</span>
      </span>
      {item.badge ? (
        <span className={`badge shrink-0 ${item.badgeClass ?? "badge-slate"}`}>{item.badge}</span>
      ) : null}
    </Command.Item>
  );
}

export function CommandPalette({
  cranes,
  users,
  cycleId,
  role,
}: {
  cranes: Crane[];
  users: PaletteUser[];
  cycleId: string;
  role: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [value, setValue] = useState("");

  const model = useMemo(
    () => buildModel(search, cranes, users, cycleId, role),
    [search, cranes, users, cycleId, role],
  );

  useEffect(() => {
    setValue(model.firstValue);
  }, [model.firstValue]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((current) => !current);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (next) {
      setSearch("");
      setValue("");
    }
  }

  function pick(href: string) {
    setOpen(false);
    router.push(href);
  }

  return (
    <Dialog.Root open={open} onOpenChange={handleOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[100] bg-black/45 backdrop-blur-[2px] transition-opacity duration-150 motion-reduce:transition-none" />
        <Dialog.Content className="fixed left-1/2 top-[10%] z-[101] w-[min(94vw,640px)] -translate-x-1/2 outline-none">
          <Dialog.Title className="sr-only">Command palette</Dialog.Title>
          <Dialog.Description className="sr-only">
            Search commands, cranes, SO numbers, statuses and people, or type a command.
          </Dialog.Description>

          <Command
            label="Command palette"
            shouldFilter={false}
            loop
            value={value}
            onValueChange={setValue}
            className="card overflow-hidden outline-none"
          >
            <div className="flex items-center gap-2.5 border-b border-line px-4">
              <Search size={16} className="shrink-0 text-faint" aria-hidden />
              <Command.Input
                autoFocus
                value={search}
                onValueChange={setSearch}
                aria-label="Search commands, cranes, statuses and people"
                placeholder="Search cranes, statuses, people… or type a command"
                className="input h-12 flex-1 border-0 bg-transparent px-0 text-[13px] shadow-none outline-none placeholder:text-faint focus:ring-0 motion-reduce:transition-none"
              />
              <Dialog.Close asChild>
                <button
                  type="button"
                  className="btn btn-ghost btn-icon h-7 w-7 shrink-0 rounded-md focus-visible:ring-2 focus-visible:ring-brand"
                  aria-label="Close command palette"
                >
                  <X size={15} />
                </button>
              </Dialog.Close>
            </div>

            <Command.List
              label="Command results"
              className="scroll-thin max-h-[min(52vh,420px)] overflow-y-auto overscroll-contain p-2"
            >
              {model.command ? (
                <Command.Group
                  heading={
                    <span className="flex items-center gap-1.5 px-3 py-1.5 text-[9px] font-bold uppercase tracking-[0.13em] text-brand">
                      <CommandIcon size={11} aria-hidden /> Suggested command
                    </span>
                  }
                >
                  <ItemRow item={model.command} onPick={pick} />
                </Command.Group>
              ) : null}

              {model.groups.map((group) => (
                <Command.Group
                  key={group.heading}
                  heading={
                    <span className="flex items-baseline gap-2 px-3 py-1.5 text-[9px] font-bold uppercase tracking-[0.13em] text-faint">
                      <span>{group.heading}</span>
                      {group.note ? (
                        <span className="font-normal normal-case tracking-normal text-faint">
                          {group.note}
                        </span>
                      ) : null}
                    </span>
                  }
                >
                  {group.items.map((item) => (
                    <ItemRow key={item.value} item={item} onPick={pick} />
                  ))}
                </Command.Group>
              ))}

              {model.itemCount === 0 ? (
                <div className="flex flex-col items-center gap-2 px-6 py-10 text-center">
                  <Search size={20} className="text-faint" aria-hidden />
                  <p className="max-w-[380px] text-[12.5px] leading-relaxed text-muted">
                    No matches. Try an asset code, status, or a command like{" "}
                    <span className="font-medium text-ink">&apos;Show conflicts&apos;</span>.
                  </p>
                </div>
              ) : null}
            </Command.List>

            <footer className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-line bg-panel-2/60 px-4 py-2 text-[12px] text-faint">
              <span className="flex items-center gap-1.5">
                <span className="kbd">
                  <ArrowUp size={10} />
                </span>
                <span className="kbd">
                  <ArrowDown size={10} />
                </span>
                navigate
              </span>
              <span className="flex items-center gap-1.5">
                <span className="kbd">
                  <CornerDownLeft size={10} />
                </span>
                select
              </span>
              <span className="flex items-center gap-1.5">
                <span className="kbd">esc</span>
                close
              </span>
              <span className="ml-auto flex items-center gap-1.5">
                <CommandIcon size={11} aria-hidden /> FIRM command palette
              </span>
            </footer>
          </Command>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
