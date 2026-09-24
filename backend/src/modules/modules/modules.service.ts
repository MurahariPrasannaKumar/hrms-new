import { prisma } from '../../config/database';

/** Module keys available to a school: platform-enabled AND not disabled for that school. */
export const getEnabledModuleKeys = async (schoolId: string | null): Promise<string[]> => {
  const modules = await prisma.module.findMany({
    where: { enabled: true },
    orderBy: { sortOrder: 'asc' },
    include: schoolId ? { schoolModules: { where: { schoolId } } } : undefined,
  });
  return modules
    .filter((m) => {
      const override = (m as { schoolModules?: { enabled: boolean }[] }).schoolModules?.[0];
      return override ? override.enabled : true;
    })
    .map((m) => m.key);
};
