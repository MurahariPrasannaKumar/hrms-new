import { ModulesMatrix } from "@/components/features/modules/ModulesMatrix";
import { PageHeader } from "@/components/layout/PageHeader";

export default function ModulesPage() {
  return (
    <>
      <PageHeader title="Modules" description="Enable modules platform-wide, then choose which schools can use each one." />
      <ModulesMatrix />
    </>
  );
}
