import { UsersRound } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { getUsers } from "@/lib/firm/api";
import { PageHeader } from "@/components/page-header";
import { ROLES } from "@/lib/firm/workflow";

export const dynamic = "force-dynamic";

const TONE: Record<string, string> = {
  slate: "badge-slate", brand: "badge-info", amber: "badge-amber",
  violet: "badge-old", red: "badge-red", green: "badge-healthy",
};

export default async function RolesPage() {
  await requireUser();
  const users = await getUsers();

  return (
    <>
      <PageHeader
        eyebrow="Governance"
        title="Roles & people"
        description="The FIRM document assigns one owner per step. These are the 12 roles and the accounts seeded for evaluation."
        help="Twelve roles from the business document, one owner per step. Global Administrators push stuck cranes but take no business calls."
      />

      <div className="grid gap-4 lg:grid-cols-2">
        {ROLES.map((role) => {
          const accounts = users.filter((user) => user.role === role.role);
          return (
            <section key={role.role} className="card p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h2 className="panel-title">{role.name}</h2>

                </div>
                <span className={`badge ${TONE[role.tone] ?? "badge-slate"}`}>{role.short}</span>
              </div>
              <div className="mt-3 space-y-1.5 rounded-lg border border-line bg-panel-2 px-2.5 py-2">
                {accounts.length > 0 ? accounts.map((account) => (
                  <div key={account.id} className="flex items-center gap-2">
                    <UsersRound size={14} className="shrink-0 text-brand" />
                    <span className="text-[12px] text-muted">
                      <strong className="text-ink">{account.name}</strong> · {account.email}
                    </span>
                  </div>
                )) : (
                  <span className="text-[12px] text-faint">No account seeded</span>
                )}
              </div>
            </section>
          );
        })}
      </div>
    </>
  );
}
