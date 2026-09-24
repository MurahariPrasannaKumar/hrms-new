import { StudentProfile } from "@/components/features/students/StudentProfile";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <StudentProfile id={id} backHref="/school/students" />;
}
