import { requireUser } from "@/lib/auth";
import { PageHeader } from "@/components/page-header";
import { ImportWizard } from "@/components/import-wizard";

export const dynamic = "force-dynamic";

export default async function ImportPage() {
  const user = await requireUser();

  return (
    <>
      <PageHeader eyebrow="FIRM cycle" title="Upload fleet" />
      <ImportWizard role={user.role} />
    </>
  );
}
