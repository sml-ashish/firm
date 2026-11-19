"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import {
  BadgeCheck, CalendarRange, LayoutDashboard, Menu,
  PanelLeftClose, PanelLeftOpen, SlidersHorizontal, Truck,
  UploadCloud, UsersRound, X,
} from "lucide-react";
import { UserMenu } from "@/components/user-menu";
import { ThemeToggle } from "@/components/theme-toggle";
import { ROLE_MAP, type Role } from "@/lib/firm/workflow";

export interface SidebarUser {
  name: string;
  email: string;
  role: string;
  designation: string | null;
}

const STORAGE_KEY = "firm-sidebar-collapsed";

type NavItem = { href: string; label: string; icon: typeof LayoutDashboard; badge?: boolean };

const NAV: { label: string; items: NavItem[] }[] = [
  { label: "Overview", items: [{ href: "/", label: "Dashboard", icon: LayoutDashboard }] },
  {
    label: "FIRM cycle",
    items: [
      { href: "/cranes", label: "Crane register", icon: Truck },
      { href: "/cycles", label: "Cycles", icon: CalendarRange },
      { href: "/import", label: "Upload fleet", icon: UploadCloud },
    ],
  },
  {
    label: "Governance",
    items: [
      { href: "/approvals", label: "Approvals", icon: BadgeCheck, badge: true },
      { href: "/roles", label: "Roles & people", icon: UsersRound },
    ],
  },
  {
    label: "System",
    items: [{ href: "/settings", label: "Rules & settings", icon: SlidersHorizontal }],
  },
];

function visibleNav(role: string): { label: string; items: NavItem[] }[] {
  const isAdmin = role === "GLOBAL_ADMIN";
  const canUpload = role === "FPNA" || isAdmin;
  const canApprove = !["FPNA", "SALES", "MAINTENANCE", "FINANCE", "MARKETING", "STRATEGY", "CSO", "SCM", "CBO"].includes(role) && (isAdmin || ["STRATEGY", "CBO", "CSO", "MD"].includes(role));

  return NAV.map((group) => ({
    ...group,
    items: group.items.filter((item) => {
      if (item.href === "/") return !["FPNA", "SALES", "MAINTENANCE", "FINANCE", "MARKETING", "STRATEGY", "BU", "CSO", "SCM", "CBO"].includes(role);
      if (item.href === "/import") return canUpload;
      if (item.href === "/approvals") return canApprove;
      if (item.href === "/roles") return isAdmin;
      if (item.href === "/settings") return isAdmin;
      return true;
    }),
  })).filter((group) => group.items.length > 0);
}

function NavLinks({
  pendingApprovals,
  collapsed,
  role,
  onNavigate,
}: {
  pendingApprovals: number;
  collapsed: boolean;
  role: string;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const nav = visibleNav(role);
  return (
    <nav className="space-y-5" aria-label="Primary">
      {nav.map((group) => (
        <div key={group.label}>
          {!collapsed && <div className="sidebar-group">{group.label}</div>}
          {collapsed && <div className="mx-3 mb-2 border-t border-line" />}
          <div className="space-y-1">
            {group.items.map((item) => {
              const active =
                item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onNavigate}
                  aria-current={active ? "page" : undefined}
                  title={collapsed ? item.label : undefined}
                  className={`sidebar-link ${active ? "active" : ""} ${collapsed ? "justify-center px-0" : ""}`}
                >
                  <Icon size={17} strokeWidth={1.9} className="shrink-0" />
                  {!collapsed && <span className="flex-1">{item.label}</span>}
                  {!collapsed && item.badge && pendingApprovals > 0 && (
                    <span className="flex h-[19px] min-w-[19px] items-center justify-center rounded-full bg-danger px-1 text-[12px] font-bold text-white tabular-nums">
                      {pendingApprovals}
                    </span>
                  )}
                  {collapsed && item.badge && pendingApprovals > 0 && (
                    <span className="absolute right-1 top-0.5 h-2 w-2 rounded-full bg-danger" aria-label={`${pendingApprovals} approvals`} />
                  )}
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );
}

function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <Link href="/" className="flex items-center gap-2.5 px-1" aria-label="FIRM home">
      <Image
        src="/brand/sml-logo.png"
        alt="Sanghvi Movers Limited"
        width={38}
        height={38}
        className="h-[38px] w-[38px] shrink-0 rounded-[8px] object-contain"
        priority
      />
      {!compact && (
        <span>
          <span className="block font-display text-[15px] font-semibold tracking-[0.06em] text-ink">
            FIRM
          </span>
          <span className="block text-[12px] uppercase tracking-[0.16em] text-muted">
            Fleet exit cycle
          </span>
        </span>
      )}
    </Link>
  );
}

export function Sidebar({
  user,
  pendingApprovals,
}: {
  user: SidebarUser;
  pendingApprovals: number;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const role = ROLE_MAP[user.role as Role];

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY) === "1";
    setCollapsed(stored);
  }, []);

  useEffect(() => {
    document.documentElement.style.setProperty(
      "--firm-sidebar-w",
      collapsed ? "76px" : "252px",
    );
    window.localStorage.setItem(STORAGE_KEY, collapsed ? "1" : "0");
  }, [collapsed]);

  return (
    <>
      <aside
        className={`fixed inset-y-0 left-0 z-30 hidden flex-col border-r border-line bg-panel px-3 py-5 transition-[width] duration-200 ease-out lg:flex ${collapsed ? "w-[76px]" : "w-[252px]"}`}
      >
        <div className="flex items-center justify-between gap-1">
          <Brand compact={collapsed} />
          {!collapsed && (
            <button
              type="button"
              className="btn btn-ghost btn-icon"
              onClick={() => setCollapsed(true)}
              aria-label="Collapse sidebar"
              title="Collapse sidebar"
            >
              <PanelLeftClose size={16} />
            </button>
          )}
        </div>
        {collapsed && (
          <button
            type="button"
            className="btn btn-ghost btn-icon mx-auto mt-3"
            onClick={() => setCollapsed(false)}
            aria-label="Expand sidebar"
            title="Expand sidebar"
          >
            <PanelLeftOpen size={16} />
          </button>
        )}

        <div className="mt-5 flex-1 overflow-y-auto scroll-thin px-1.5">
          <NavLinks pendingApprovals={pendingApprovals} collapsed={collapsed} role={user.role} />
        </div>

        <div className="mt-4 space-y-3 px-1.5">
          <div
            className={`rounded-lg border border-line bg-panel-2 ${collapsed ? "flex justify-center px-1 py-2" : "px-2.5 py-2"}`}
            title={`${user.name} · ${role?.short ?? user.role}`}
          >
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand text-[12px] font-bold text-white tabular-nums">
                {user.name.split(/\s+/).filter(Boolean).slice(0, 2)
                  .map((part) => part[0]?.toUpperCase()).join("")}
              </span>
              {!collapsed && (
                <>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13px] font-semibold text-ink">{user.name}</div>
                    <div className="truncate text-[12px] text-muted">
                      {user.designation ?? role?.short ?? user.role}
                    </div>
                  </div>
                  <span className="badge badge-slate">{role?.short ?? user.role}</span>
                </>
              )}
            </div>
          </div>
          {/* Guide removed */}
          {!collapsed && (
            <div className="px-1 text-[12px] leading-relaxed text-muted">
              Sanghvi Movers Limited
              <br />
              FIRM cycle · Internal use only
            </div>
          )}
        </div>
      </aside>

      <header className="sticky top-0 z-40 flex items-center justify-between border-b border-line bg-panel/95 px-4 py-2.5 backdrop-blur lg:hidden">
        <Brand compact />
        <div className="flex items-center gap-1.5">
          <ThemeToggle />
          <Dialog.Root open={mobileOpen} onOpenChange={setMobileOpen}>
            <Dialog.Trigger asChild>
              <button type="button" className="btn btn-secondary btn-icon" aria-label="Open navigation menu">
                <Menu size={17} />
              </button>
            </Dialog.Trigger>
            <Dialog.Portal>
              <Dialog.Overlay className="fixed inset-0 z-50 bg-black/45 backdrop-blur-[2px]" />
              <Dialog.Content className="fixed inset-y-0 left-0 z-50 flex w-[286px] flex-col border-r border-line bg-panel px-4 py-5 shadow-[var(--shadow-lg)]">
                <Dialog.Title className="sr-only">Navigation</Dialog.Title>
                <div className="flex items-center justify-between">
                  <Brand />
                  <Dialog.Close asChild>
                    <button type="button" className="btn btn-ghost btn-icon" aria-label="Close navigation menu">
                      <X size={17} />
                    </button>
                  </Dialog.Close>
                </div>
                <div className="mt-5 flex-1 overflow-y-auto">
                  <NavLinks pendingApprovals={pendingApprovals} collapsed={false} role={user.role} onNavigate={() => setMobileOpen(false)} />
                </div>
                <div className="mt-4 rounded-lg border border-line bg-panel-2 px-3 py-2.5">
                  <div className="truncate text-[13px] font-semibold text-ink">{user.name}</div>
                  <div className="truncate text-[12px] text-muted">
                    {user.designation ?? role?.short ?? user.role}
                  </div>
                  <div className="mt-1.5">
                    <span className="badge badge-brand">{role?.short ?? user.role}</span>
                  </div>
                </div>
              </Dialog.Content>
            </Dialog.Portal>
          </Dialog.Root>
          <UserMenu name={user.name} email={user.email} designation={user.designation} role={user.role} />
        </div>
      </header>
    </>
  );
}
