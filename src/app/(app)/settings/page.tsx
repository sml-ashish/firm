import { requireUser } from "@/lib/auth";
import { PageHeader } from "@/components/page-header";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  await requireUser();

  return (
    <>
      <PageHeader eyebrow="System" title="Rules & settings" />
    </>
  );
}
