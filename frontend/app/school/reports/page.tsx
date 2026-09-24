import { ReportsPanel } from "@/components/features/reports/ReportsPanel";
import { PageHeader } from "@/components/layout/PageHeader";

export default function SchoolReportsPage() {
  return (
    <>
      <PageHeader title="Reports" description="Run a report for your school, filter by date range and export to CSV." />
      <ReportsPanel />
    </>
  );
}
