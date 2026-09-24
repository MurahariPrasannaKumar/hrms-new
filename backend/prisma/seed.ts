import 'dotenv/config';
import argon2 from 'argon2';
import { AttendanceStatus, PrismaClient, type NoticeType } from '@prisma/client';
import { MODULES, PERMISSIONS, ROLES, ROLE_PERMISSIONS } from '../src/config/permissions';

const prisma = new PrismaClient();
const PASSWORD = process.env.SEED_DEMO_PASSWORD ?? 'password';

const FIRST = ['Aarav', 'Diya', 'Kabir', 'Ishita', 'Vihaan', 'Anaya', 'Reyansh', 'Myra', 'Arjun', 'Saanvi',
  'Ayaan', 'Kiara', 'Krish', 'Riya', 'Advait', 'Navya', 'Rohan', 'Tara', 'Dev', 'Zoya'];
const LAST = ['Sharma', 'Patel', 'Iyer', 'Reddy', 'Nair', 'Gupta', 'Khan', 'Mehta', 'Rao', 'Das'];
const pick = <T,>(arr: T[], i: number) => arr[i % arr.length];

const startOfDay = (d: Date) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));

async function seedRbac() {
  for (const key of PERMISSIONS) {
    await prisma.permission.upsert({ where: { key }, update: {}, create: { key } });
  }
  for (const name of ROLES) {
    const role = await prisma.role.upsert({ where: { name }, update: {}, create: { name } });
    await prisma.rolePermission.deleteMany({ where: { roleId: role.id } });
    const perms = await prisma.permission.findMany({ where: { key: { in: ROLE_PERMISSIONS[name] } } });
    await prisma.rolePermission.createMany({ data: perms.map((p) => ({ roleId: role.id, permissionId: p.id })) });
  }
  for (const [i, m] of MODULES.entries()) {
    await prisma.module.upsert({ where: { key: m.key }, update: { name: m.name, sortOrder: i }, create: { ...m, sortOrder: i } });
  }
}

async function seedSchool(n: 'one' | 'two', hash: string) {
  const code = n === 'one' ? 'SCH-ONE' : 'SCH-TWO';
  if (await prisma.school.findUnique({ where: { code } })) {
    console.log(`School ${code} exists, skipping`);
    return;
  }
  const domain = `school${n}.com`;
  const roles = Object.fromEntries((await prisma.role.findMany()).map((r) => [r.name, r.id]));

  const school = await prisma.school.create({
    data: {
      name: n === 'one' ? 'Greenfield Public School' : 'Riverside International Academy',
      code, email: `info@${domain}`, phone: '+91 80 5550 0100',
      address: '12 Learning Avenue', city: n === 'one' ? 'Bengaluru' : 'Pune', state: n === 'one' ? 'Karnataka' : 'Maharashtra',
      country: 'India', postalCode: n === 'one' ? '560001' : '411001',
      principal: n === 'one' ? 'Dr. Meera Krishnan' : 'Mr. Sanjay Verma', establishedYear: n === 'one' ? 1998 : 2005,
      settings: { create: { timezone: 'Asia/Kolkata' } },
    },
  });

  // Module availability differs per school (demonstrates per-school toggles).
  const off = n === 'one' ? 'instasolve' : 'v-buddy';
  const mods = await prisma.module.findMany({ where: { key: off } });
  await prisma.schoolModule.createMany({ data: mods.map((m) => ({ schoolId: school.id, moduleId: m.id, enabled: false })) });

  const mkUser = (email: string, role: string, firstName: string, lastName: string) =>
    prisma.user.create({ data: { email, roleId: roles[role], schoolId: school.id, passwordHash: hash, firstName, lastName } });

  await mkUser(`admin@${domain}`, 'SCHOOL_ADMIN', 'Priya', 'Menon');

  // Academic structure
  const years = await Promise.all([
    prisma.academicYear.create({ data: { schoolId: school.id, name: '2024-25', startDate: new Date('2024-06-01'), endDate: new Date('2025-03-31') } }),
    prisma.academicYear.create({ data: { schoolId: school.id, name: '2025-26', startDate: new Date('2025-06-01'), endDate: new Date('2026-03-31'), isCurrent: true } }),
  ]);
  const current = years[1];
  const classes = [];
  for (const level of [6, 7, 8]) {
    const cls = await prisma.class.create({ data: { schoolId: school.id, academicYearId: current.id, name: `Grade ${level}`, level } });
    const sections = await Promise.all(['A', 'B'].map((name) => prisma.section.create({ data: { schoolId: school.id, classId: cls.id, name } })));
    classes.push({ cls, sections });
  }
  const subjects = await Promise.all(
    [['Mathematics', 'MATH'], ['Science', 'SCI'], ['English', 'ENG'], ['Social Studies', 'SOC'], ['Computer Science', 'CS']].map(([name, c]) =>
      prisma.subject.create({ data: { schoolId: school.id, name, code: c } })),
  );

  // Teachers
  const teachers = [];
  for (let i = 0; i < 5; i++) {
    const email = i === 0 ? `teacher@${domain}` : `teacher${i + 1}@${domain}`;
    const user = await mkUser(email, 'TEACHER', pick(FIRST, i + 3), pick(LAST, i + 1));
    const t = await prisma.teacher.create({ data: { schoolId: school.id, userId: user.id, employeeId: `T${100 + i}`, qualification: 'M.Ed', joiningDate: new Date('2020-06-01') } });
    await prisma.teacherSubject.create({ data: { teacherId: t.id, subjectId: subjects[i].id } });
    const { cls, sections } = classes[i % 3];
    await prisma.teacherClass.create({ data: { teacherId: t.id, classId: cls.id, sectionId: sections[0].id } });
    teachers.push(t);
  }

  // Staff
  for (let i = 0; i < 2; i++) {
    const user = await mkUser(i === 0 ? `staff@${domain}` : `staff2@${domain}`, 'STAFF', pick(FIRST, i + 8), pick(LAST, i + 4));
    await prisma.staff.create({ data: { schoolId: school.id, userId: user.id, employeeId: `S${100 + i}`, department: i ? 'Front Office' : 'Administration', designation: 'Executive' } });
  }

  // Parents
  const parents = [];
  for (let i = 0; i < 2; i++) {
    const user = await mkUser(i === 0 ? `parent@${domain}` : `parent2@${domain}`, 'PARENT', pick(FIRST, i + 11), pick(LAST, i + 6));
    parents.push(await prisma.parent.create({ data: { schoolId: school.id, userId: user.id, phone: '+91 90000 0000' + i } }));
  }

  // Students (20)
  const students = [];
  for (let i = 0; i < 20; i++) {
    const { cls, sections } = classes[i % 3];
    const section = sections[i % 2];
    const firstName = pick(FIRST, i);
    const lastName = pick(LAST, i + 2);
    const user = i === 0 ? await mkUser(`student@${domain}`, 'STUDENT', firstName, lastName) : null;
    students.push(await prisma.student.create({
      data: {
        schoolId: school.id, userId: user?.id, parentId: parents[i < 10 ? 0 : 1].id,
        classId: cls.id, sectionId: section.id, admissionNumber: `${n === 'one' ? 'GF' : 'RI'}${2025000 + i}`,
        firstName, lastName, gender: i % 2 ? 'FEMALE' : 'MALE',
        dateOfBirth: new Date(2012 - (i % 3), i % 12, 5 + (i % 20)), admissionDate: new Date('2025-06-02'),
      },
    }));
  }

  // Attendance: last 14 weekdays for every section
  const statuses: AttendanceStatus[] = ['PRESENT', 'PRESENT', 'PRESENT', 'PRESENT', 'PRESENT', 'LATE', 'ABSENT', 'EXCUSED'];
  let daysBack = 0;
  let made = 0;
  while (made < 14) {
    const d = startOfDay(new Date(Date.now() - daysBack++ * 86_400_000));
    if ([0, 6].includes(d.getUTCDay())) continue;
    made++;
    for (const { sections } of classes) {
      for (const section of sections) {
        const roster = students.filter((s) => s.sectionId === section.id);
        if (!roster.length) continue;
        await prisma.attendance.create({
          data: {
            schoolId: school.id, sectionId: section.id, date: d, markedById: teachers[0].userId,
            records: { create: roster.map((s, k) => ({ schoolId: school.id, studentId: s.id, status: pick(statuses, k * 3 + made + d.getUTCDate()) })) },
          },
        });
      }
    }
  }

  // Notices
  const notices: [string, NoticeType, string][] = [
    ['Annual Day Celebration', 'EVENT', 'Annual Day will be held on the school grounds. Parents are cordially invited.'],
    ['Mid-term Exam Schedule', 'ACADEMIC', 'Mid-term examinations begin next month. Timetable is available with class teachers.'],
    ['Winter Break Holiday', 'HOLIDAY', 'The school will remain closed for the winter break as per the academic calendar.'],
    ['Fire Drill Today', 'EMERGENCY', 'A scheduled fire safety drill will take place at 11:00 AM. Please follow staff instructions.'],
  ];
  const admin = await prisma.user.findFirstOrThrow({ where: { email: `admin@${domain}` } });
  for (const [title, type, body] of notices) {
    await prisma.notice.create({ data: { schoolId: school.id, authorId: admin.id, title, body, type, isPublished: true, publishAt: new Date() } });
  }

  // Diary
  for (const [i, t] of teachers.entries()) {
    const { cls, sections } = classes[i % 3];
    await prisma.diaryEntry.create({
      data: {
        schoolId: school.id, classId: cls.id, sectionId: sections[0].id, subjectId: subjects[i].id, teacherId: t.id,
        title: `${subjects[i].name}: Chapter practice`, body: 'Complete the exercises at the end of the chapter and revise the notes.',
        isHomework: true, dueDate: new Date(Date.now() + 3 * 86_400_000),
      },
    });
    await prisma.assignment.create({
      data: { schoolId: school.id, classId: cls.id, subjectId: subjects[i].id, teacherId: t.id, title: `${subjects[i].name} worksheet`, dueDate: new Date(Date.now() + 5 * 86_400_000) },
    });
  }

  // Learning content (school-scoped courses)
  const course = await prisma.course.create({
    data: {
      schoolId: school.id, title: 'Foundations of Algebra', category: 'Mathematics', description: 'Variables, expressions and equations.',
      modules: { create: [
        { title: 'Variables & Expressions', sortOrder: 1, lessons: { create: [{ title: 'What is a variable?', sortOrder: 1 }, { title: 'Simplifying expressions', sortOrder: 2 }] } },
        { title: 'Linear Equations', sortOrder: 2, lessons: { create: [{ title: 'Solving one-step equations', sortOrder: 1 }, { title: 'Two-step equations', sortOrder: 2 }] } },
      ] },
    },
    include: { modules: { include: { lessons: true } } },
  });
  const firstLesson = course.modules[0].lessons[0];
  const studentUser = await prisma.user.findFirstOrThrow({ where: { email: `student@${domain}` } });
  await prisma.learningProgress.create({ data: { userId: studentUser.id, lessonId: firstLesson.id, completed: true, completedAt: new Date() } });
  await prisma.course.create({ data: { schoolId: school.id, title: 'Introduction to Coding', category: 'Computer Science', description: 'Computational thinking basics.' } });

  await prisma.learningResource.createMany({
    data: [
      { schoolId: school.id, title: 'Photosynthesis Explained', type: 'VIDEO', category: 'Science', area: 'smart-class' },
      { schoolId: school.id, title: 'Fractions Slide Deck', type: 'PRESENTATION', category: 'Mathematics', area: 'smart-class' },
      { schoolId: school.id, title: 'Lesson Plan: Grammar Basics', type: 'LESSON_PLAN', category: 'English', area: 'pedagogy' },
      { schoolId: school.id, title: 'Active Learning Strategies', type: 'DOCUMENT', category: 'Teaching Strategies', area: 'pedagogy' },
      { schoolId: school.id, title: 'Curriculum Map Grade 6', type: 'DOCUMENT', category: 'Curriculum', area: 'cmds' },
    ],
  });

  // Welcome notifications
  await prisma.notification.createMany({
    data: [studentUser.id, admin.id].map((userId) => ({ userId, type: 'SYSTEM' as const, title: 'Welcome', message: 'Your account is ready.' })),
  });
  console.log(`Seeded ${school.name}`);
}

async function main() {
  const hash = await argon2.hash(PASSWORD);
  await seedRbac();
  const roles = Object.fromEntries((await prisma.role.findMany()).map((r) => [r.name, r.id]));
  const demo = process.env.SEED_DEMO_DATA === 'true';
  if (demo) {
    await prisma.user.upsert({
      where: { email: 'superadmin@example.com' }, update: {},
      create: { email: 'superadmin@example.com', roleId: roles.SUPER_ADMIN, passwordHash: hash, firstName: 'Platform', lastName: 'Admin' },
    });
  }
  const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  if (adminEmail && process.env.ADMIN_PASSWORD) {
    const adminHash = await argon2.hash(process.env.ADMIN_PASSWORD);
    await prisma.user.upsert({
      where: { email: adminEmail },
      update: { passwordHash: adminHash, roleId: roles.SUPER_ADMIN, status: 'ACTIVE', schoolId: null },
      create: { email: adminEmail, roleId: roles.SUPER_ADMIN, passwordHash: adminHash, firstName: process.env.ADMIN_FIRST_NAME ?? 'Admin', lastName: process.env.ADMIN_LAST_NAME ?? 'User' },
    });
    console.log(`Admin account ready: ${adminEmail}`);
  }
  if (demo) {
    await seedSchool('one', hash);
    await seedSchool('two', hash);
  }
  console.log(demo ? 'Seed complete (with demo data).' : 'Seed complete (base data only: roles, permissions, modules, admin).');
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
