import { ReportsPanel } from "@/components/features/reports/ReportsPanel";
import { PageHeader } from "@/components/layout/PageHeader";

export default function ReportsPage() {
  return (
    <>
      <PageHeader title="Analytics & reports" description="Run a report, filter by school and date range, and export to CSV." />
      <ReportsPanel />
    </>
  );
}
