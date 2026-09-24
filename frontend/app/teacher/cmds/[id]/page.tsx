import { ResourceDetail } from "@/components/features/resources/ResourceDetail";

export default async function CmdsDetailRoute({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ResourceDetail id={id} backHref="/teacher/cmds" moduleName="CMDS 2.0" />;
}
