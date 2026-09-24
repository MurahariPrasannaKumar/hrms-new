import { CourseDetail } from "@/components/features/learning/CourseDetail";

export default async function CourseRoute({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <CourseDetail id={id} backHref="/student/learn" />;
}
