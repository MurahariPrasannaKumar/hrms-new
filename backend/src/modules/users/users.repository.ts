import type { Prisma } from '@prisma/client';
import { prisma } from '../../config/database';

// passwordHash is never selected.
export const userSelect = {
  id: true, email: true, username: true, firstName: true, lastName: true, phone: true, avatarUrl: true,
  status: true, lastLoginAt: true, createdAt: true, schoolId: true, mustChangePassword: true,
  role: { select: { id: true, name: true } },
  school: { select: { id: true, name: true, code: true } },
} satisfies Prisma.UserSelect;

type ProfileUser = { id: string; schoolId: string | null; firstName: string; lastName: string; email: string };
type Db = Prisma.TransactionClient | typeof prisma;

const code = (prefix: string) => `${prefix}${Date.now().toString(36).toUpperCase()}${Math.random().toString(36).slice(2, 5).toUpperCase()}`;

/** Every login role gets its matching profile row so it shows up in lists, attendance, dashboards. */
const ensureProfile = async (db: Db, user: ProfileUser, roleName: string) => {
  if (!user.schoolId) return;
  const base = { schoolId: user.schoolId, userId: user.id };
  if (roleName === 'TEACHER') {
    if (!(await db.teacher.findUnique({ where: { userId: user.id } }))) await db.teacher.create({ data: { ...base, employeeId: code('T') } });
  } else if (roleName === 'STUDENT') {
    if (!(await db.student.findUnique({ where: { userId: user.id } })))
      await db.student.create({ data: { ...base, admissionNumber: code('ADM'), firstName: user.firstName, lastName: user.lastName, email: user.email } });
  } else if (roleName === 'PARENT') {
    if (!(await db.parent.findUnique({ where: { userId: user.id } }))) await db.parent.create({ data: base });
  } else if (roleName === 'STAFF') {
    if (!(await db.staff.findUnique({ where: { userId: user.id } }))) await db.staff.create({ data: { ...base, employeeId: code('S') } });
  }
};

export const usersRepository = {
  list(where: Prisma.UserWhereInput, orderBy: Prisma.UserOrderByWithRelationInput, skip: number, take: number) {
    return Promise.all([
      prisma.user.findMany({ where, orderBy, skip, take, select: userSelect }),
      prisma.user.count({ where }),
    ]);
  },
  findById: (id: string) =>
    prisma.user.findUnique({
      where: { id },
      select: {
        ...userSelect,
        extraPermissions: { select: { permission: { select: { key: true } } } },
        student: { select: { classId: true, sectionId: true, class: { select: { id: true, name: true, level: true } }, section: { select: { id: true, name: true } } } },
      },
    }),
  findRole: (name: string) => prisma.role.findUnique({ where: { name } }),
  create: (data: Prisma.UserUncheckedCreateInput, roleName: string) =>
    prisma.$transaction(async (tx) => {
      const user = await tx.user.create({ data, select: userSelect });
      await ensureProfile(tx, user, roleName);
      return user;
    }),
  ensureProfile: (user: ProfileUser, roleName: string) => ensureProfile(prisma, user, roleName),
  update: (id: string, data: Prisma.UserUncheckedUpdateInput) => prisma.user.update({ where: { id }, data, select: userSelect }),
  setPassword: (id: string, passwordHash: string) =>
    prisma.$transaction([
      prisma.user.update({ where: { id }, data: { passwordHash, mustChangePassword: false } }),
      prisma.refreshToken.updateMany({ where: { userId: id, revokedAt: null }, data: { revokedAt: new Date() } }),
      prisma.session.updateMany({ where: { userId: id, revokedAt: null }, data: { revokedAt: new Date() } }),
    ]),
  async setExtraPermissions(userId: string, keys: string[]) {
    const perms = await prisma.permission.findMany({ where: { key: { in: keys } } });
    await prisma.$transaction([
      prisma.userPermission.deleteMany({ where: { userId } }),
      prisma.userPermission.createMany({ data: perms.map((p) => ({ userId, permissionId: p.id })) }),
    ]);
  },
  revokeSessions: (id: string) =>
    prisma.$transaction([
      prisma.refreshToken.updateMany({ where: { userId: id, revokedAt: null }, data: { revokedAt: new Date() } }),
      prisma.session.updateMany({ where: { userId: id, revokedAt: null }, data: { revokedAt: new Date() } }),
    ]),
};
