import { SystemSettingsForm } from "@/components/features/settings/SystemSettingsForm";
import { PageHeader } from "@/components/layout/PageHeader";

export default function SettingsPage() {
  return (
    <>
      <PageHeader title="Settings" description="Platform-wide configuration, saved to the database." />
      <SystemSettingsForm />
    </>
  );
}
