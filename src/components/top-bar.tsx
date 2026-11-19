"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { CalendarRange, ChevronRight } from "lucide-react";
import { GlobalSearch } from "@/components/global-search";
import { ThemeToggle } from "@/components/theme-toggle";
import { UserMenu } from "@/components/user-menu";
import { dateLabel } from "@/lib/format";

type CycleOption = { id: string; name: string; evaluationDate: string };

const SECTION_LABELS: { match: (pathname: string) => boolean; label: string }[] = [
  { match: (p) => p === "/", label: "Dashboard" },
  { match: (p) => p.startsWith("/cranes/"), label: "Crane register" },
  { match: (p) => p.startsWith("/cranes"), label: "Crane register" },
  { match: (p) => p.startsWith("/cycles/"), label: "FIRM cycles" },
  { match: (p) => p.startsWith("/cycles"), label: "FIRM cycles" },
  { match: (p) => p.startsWith("/import"), label: "Upload fleet" },
  { match: (p) => p.startsWith("/approvals"), label: "Approvals" },
  { match: (p) => p.startsWith("/roles"), label: "Roles & people" },
  { match: (p) => p.startsWith("/settings"), label: "Rules & settings" },
];

function breadcrumbs(pathname: string): { label: string; href?: string }[] {
  const section = SECTION_LABELS.find((entry) => entry.match(pathname))?.label ?? "Workspace";
  const crumbs: { label: string; href?: string }[] = [
    { label: "Sanghvi Movers Limited", href: "/" },
    { label: section, href: section === "Workspace" ? undefined : pathname.split("/").slice(0, 2).join("/") || "/" },
  ];
  const parts = pathname.split("/").filter(Boolean);
  if (parts.length > 2 && (parts[0] === "cranes" || parts[0] === "cycles")) {
    crumbs.push({ label: decodeURIComponent(parts[1]) });
  }
  return crumbs;
}

export function TopBar({
  user,
  cycle,
  cycles,
}: {
  user: { name: string; email: string; role: string; designation: string | null };
  cycle: CycleOption | null;
  cycles: CycleOption[];
}) {
  const pathname = usePathname();
  const router = useRouter();
  const crumbs = breadcrumbs(pathname);

  return (
    <div className="no-print sticky top-0 z-20 hidden h-[60px] items-center gap-4 border-b border-line bg-panel/95 px-6 backdrop-blur lg:flex lg:px-8">
      <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-1.5 text-[12px]">
        {crumbs.map((crumb, index) => (
          <span key={`${crumb.label}-${index}`} className="flex min-w-0 items-center gap-1.5">
            {index > 0 && <ChevronRight size={12} className="shrink-0 text-faint" aria-hidden />}
            {crumb.href ? (
              <Link href={crumb.href} className="truncate text-muted transition hover:text-ink">
                {crumb.label}
              </Link>
            ) : (
              <span className="truncate font-semibold text-ink">{crumb.label}</span>
            )}
          </span>
        ))}
      </nav>

      <div className="ml-auto flex flex-1 justify-end gap-3">
        <GlobalSearch />
      </div>

      <div className="flex items-center gap-2.5">
        {cycles.length > 0 && (
          <label
            className="flex items-center gap-1.5 rounded-[6px] border border-line bg-panel-2 px-2 py-1.5"
            title="Switch cycle"
          >
            <CalendarRange size={13} className="shrink-0 text-brand" aria-hidden />
            <span className="sr-only">Switch cycle</span>
            <select
              className="max-w-[190px] cursor-pointer bg-transparent text-[12px] font-medium text-muted outline-none"
              value={cycle?.id ?? ""}
              onChange={(event) => {
                if (event.target.value) router.push(`/cycles/${event.target.value}`);
              }}
              aria-label="Switch cycle"
            >
              {cycles.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.name} · {dateLabel(option.evaluationDate)}
                </option>
              ))}
            </select>
          </label>
        )}

        <ThemeToggle />
        <UserMenu name={user.name} email={user.email} designation={user.designation} role={user.role} />
      </div>
    </div>
  );
}
