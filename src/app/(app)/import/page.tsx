import { requireUser } from "@/lib/auth";
import { getCranes, getCycles } from "@/lib/firm/api";
import { PageHeader } from "@/components/page-header";
import { ImportWizard } from "@/components/import-wizard";

export const dynamic = "force-dynamic";

export default async function ImportPage() {
  const user = await requireUser();
  const [cycles, allCranes] = await Promise.all([getCycles(), getCranes()]);
  const openCycles = cycles
    .filter((cycle) => cycle.status === "OPEN")
    .map((cycle) => ({
      id: cycle.id,
      name: cycle.name,
      startDate: cycle.startDate,
      endDate: cycle.endDate,
      craneCount: allCranes.rows.filter((crane) => crane.cycleId === cycle.id).length,
    }));

  return (
    <>
      <PageHeader eyebrow="FIRM cycle" title="Upload fleet" />
      <ImportWizard role={user.role} cycles={openCycles} />
    </>
  );
}
