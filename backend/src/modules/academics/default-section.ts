import { prisma } from '../../config/database';

/** First section of a class, creating section "A" when the class has none, so a student can always be placed. */
export async function defaultSectionId(classId: string, schoolId: string): Promise<string> {
  const existing = await prisma.section.findFirst({ where: { classId, schoolId }, orderBy: { name: 'asc' }, select: { id: true } });
  if (existing) return existing.id;
  return (await prisma.section.create({ data: { classId, schoolId, name: 'A' }, select: { id: true } })).id;
}
