import { TeacherProfile } from "@/components/features/teachers/TeacherProfile";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <TeacherProfile id={id} backHref="/school/teachers" />;
}
