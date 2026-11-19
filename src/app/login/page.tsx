import { redirect } from "next/navigation";
import Image from "next/image";
import { getSessionUser } from "@/lib/auth";
import { LoginForm } from "@/components/login-form";
import { ThemeToggle } from "@/components/theme-toggle";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const user = await getSessionUser();
  if (user) redirect("/");

  return (
    <div className="app-canvas flex min-h-screen">
      <div className="absolute right-4 top-4 z-10">
        <ThemeToggle />
      </div>

      <aside className="relative hidden w-[46%] flex-col justify-between overflow-hidden border-r border-line bg-gradient-to-br from-brand-soft via-panel to-panel px-10 py-12 lg:flex xl:px-14">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-70"
          style={{
            background:
              "radial-gradient(700px 420px at 15% 0%, color-mix(in srgb, var(--brand) 14%, transparent), transparent 70%)",
          }}
        />
        <div className="relative">
          <Image src="/brand/sml-logo.png" alt="Sanghvi Movers Limited" width={64} height={64} className="h-16 w-16 rounded-2xl object-contain" priority />
          <div className="mt-8 font-display text-[42px] font-semibold leading-[1.05] tracking-[-0.035em] text-ink">
            One cycle.
            <br />
            One clear owner
            <br />
            <span className="text-brand">per step.</span>
          </div>
          <p className="mt-5 max-w-md text-[13px] leading-relaxed text-muted">
            FIRM moves Old Fleet, NRG and Non-Deployable cranes to international rental, sale or scrap — with an audited decision at every hand-off.
          </p>
        </div>

        <p className="relative text-[12px] text-faint">
          Sanghvi Movers Limited. Internal use only.
        </p>
      </aside>

      <div className="flex flex-1 flex-col items-center justify-center px-4 py-10">
        <LoginForm />
        <div className="relative mt-8 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-[12px] text-faint">
          <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-brand" /> Active</span>
          <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-nrg-review" /> Approval</span>
          <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-nd" /> Conflict</span>
          <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-old" /> Locked in SAP</span>
          <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-healthy" /> Closed</span>
        </div>
      </div>
    </div>
  );
}
