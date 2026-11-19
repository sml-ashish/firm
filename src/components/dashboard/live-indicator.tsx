"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

/** Refetches on focus and on a slow poll; no WebSocket in this build. */
export function LiveIndicator() {
  const router = useRouter();
  const [stamp, setStamp] = useState<string | null>(null);

  useEffect(() => {
    const refresh = () => {
      router.refresh();
      setStamp(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
    };
    setStamp(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
    window.addEventListener("focus", refresh);
    const timer = window.setInterval(refresh, 60_000);
    return () => {
      window.removeEventListener("focus", refresh);
      window.clearInterval(timer);
    };
  }, [router]);

  return (
    <span className="inline-flex items-center gap-2 text-[12px] text-muted" aria-live="polite">
      <span className="relative flex h-2 w-2">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-healthy opacity-60 motion-reduce:animate-none" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-healthy" />
      </span>
      Live{stamp ? ` · updated ${stamp}` : ""}
    </span>
  );
}
