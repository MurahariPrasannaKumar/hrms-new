import { SchoolSettingsForm } from "@/components/features/settings/SchoolSettingsForm";
import { PageHeader } from "@/components/layout/PageHeader";

export default function SchoolSettingsPage() {
  return (
    <>
      <PageHeader title="Settings" description="Your school profile, timezone and locale." />
      <SchoolSettingsForm />
    </>
  );
}
