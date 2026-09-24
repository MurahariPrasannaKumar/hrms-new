"use client";

import { useParams } from "next/navigation";
import { SchoolDetail } from "@/components/features/schools/SchoolDetail";

export default function SchoolDetailPage() {
  const { id } = useParams<{ id: string }>();
  return <SchoolDetail id={id} />;
}
