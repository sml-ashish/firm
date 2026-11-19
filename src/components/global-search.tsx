"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Search, X } from "lucide-react";

export function GlobalSearch() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState("");
  const [open, setOpen] = useState(false);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      const typing =
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable);
      if (event.key === "/" && !typing) {
        event.preventDefault();
        inputRef.current?.focus();
      }
      if (event.key === "Escape") inputRef.current?.blur();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <form
      role="search"
      onSubmit={(event) => {
        event.preventDefault();
        const q = value.trim();
        router.push(q ? `/cranes?q=${encodeURIComponent(q)}` : "/cranes");
        setOpen(false);
        inputRef.current?.blur();
      }}
      className="relative w-full max-w-[360px]"
    >
      <Search
        size={14}
        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-faint"
      />
      <input
        ref={inputRef}
        value={value}
        onChange={(event) => setValue(event.target.value)}
        onFocus={() => setOpen(true)}
        onBlur={() => window.setTimeout(() => setOpen(false), 120)}
        className="input h-9 pl-9 pr-[76px] text-[13px]"
        placeholder="Search asset code, model or location…"
        aria-label="Search the fleet register"
      />
      {value ? (
        <button
          type="button"
          onClick={() => setValue("")}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-faint hover:text-ink"
          aria-label="Clear search"
        >
          <X size={13} />
        </button>
      ) : (
        <span className="pointer-events-none absolute right-2.5 top-1/2 flex -translate-y-1/2 items-center gap-1">
          <span className="kbd" title="Press / to focus search">/</span>
          <span className="kbd" title="Open the command bar">⌘K</span>
        </span>
      )}

      {open && value.trim().length > 0 && (
        <div className="absolute left-0 right-0 top-[calc(100%+6px)] z-50 overflow-hidden rounded-xl border border-line bg-panel p-1 shadow-[var(--shadow-lg)]">
          <button
            type="submit"
            className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[12px] text-muted transition hover:bg-panel-2 hover:text-ink"
          >
            <Search size={13} className="text-faint" />
            Search the fleet register for <strong className="text-ink">“{value.trim()}”</strong>
          </button>
          <Link
            href={`/cranes?q=${encodeURIComponent(value.trim())}`}
            onClick={() => setOpen(false)}
            className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[12px] text-muted transition hover:bg-panel-2 hover:text-ink"
          >
            Open the full register with this filter
          </Link>
        </div>
      )}
    </form>
  );
}
