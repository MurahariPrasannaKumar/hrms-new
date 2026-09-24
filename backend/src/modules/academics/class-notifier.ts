import type { NotificationType } from '@prisma/client';
import { prisma } from '../../config/database';
import { logger } from '../../config/logger';
import { renderEmail } from '../../utils/email-template';
import { sendMail } from '../../utils/mailer';
import { notificationService, type NotificationPayload } from '../notifications/notification.service';

interface Recipient { email: string | null; firstName: string; userId: string | null }

const recipientSelect = { email: true, firstName: true, userId: true } as const;

/**
 * Delivers to students through the platform (in-app notification + email) when they have a login,
 * and by plain email when they only have a contact address on their student record.
 */
export async function deliverToStudents(students: Recipient[], payload: { type: NotificationType; title: string; message: string; link?: string; email?: NotificationPayload['email'] }) {
  const withLogin = students.filter((s) => s.userId).map((s) => s.userId as string);
  await notificationService.notify(withLogin, { ...payload, email: { category: 'Classes', action: { label: 'Open EduSphere', path: '{area}/dashboard' }, ...payload.email } }, ['IN_APP', 'EMAIL']);
  const emailOnly = students.filter((s) => !s.userId && s.email);
  await Promise.all(emailOnly.map((s) => {
    const { html, text } = renderEmail({ category: 'Classes', action: { label: 'Sign in to EduSphere', path: '/login' }, heading: payload.title, greetingName: s.firstName, message: payload.message });
    return sendMail({ to: s.email as string, subject: payload.title, text, html });
  }));
  return { inApp: new Set(withLogin).size, emailOnly: emailOnly.length };
}

export const classNotifier = {
  /** A class was created: notify every active student already enrolled in it. Fire-and-forget. */
  classCreated(classId: string) {
    void (async () => {
      const cls = await prisma.class.findUnique({
        where: { id: classId },
        select: { name: true, academicYear: { select: { name: true } }, school: { select: { name: true } } },
      });
      if (!cls) return;
      const students = await prisma.student.findMany({ where: { classId, status: 'ACTIVE' }, select: recipientSelect });
      await deliverToStudents(students, {
        type: 'ANNOUNCEMENT', link: '/academics', title: `New class: ${cls.name}`,
        message: `A new class, ${cls.name} (${cls.academicYear.name}), has been created at ${cls.school.name}. You are enrolled in it.`,
      });
    })().catch((err) => logger.error({ err, classId }, 'Class-created notification failed'));
  },

  /** A student was placed in (or moved to) a class/section: tell them. Fire-and-forget. */
  studentAssigned(studentId: string) {
    void (async () => {
      const st = await prisma.student.findUnique({
        where: { id: studentId },
        select: { ...recipientSelect, class: { select: { name: true } }, section: { select: { name: true } } },
      });
      if (!st?.class) return;
      const where = st.section ? `${st.class.name}, Section ${st.section.name}` : st.class.name;
      await deliverToStudents([st], { type: 'SYSTEM', link: '/academics', title: `You have been added to ${st.class.name}`, message: `You have been enrolled in ${where}.` });
    })().catch((err) => logger.error({ err, studentId }, 'Student-assigned notification failed'));
  },

  /** Teacher/admin broadcast to every active student of a class (optionally one section). Awaited so the UI can show counts. */
  async broadcast(classId: string, sectionId: string | undefined, sender: string, subject: string, message: string) {
    const cls = await prisma.class.findUnique({ where: { id: classId }, select: { name: true } });
    const students = await prisma.student.findMany({
      where: { classId, status: 'ACTIVE', ...(sectionId ? { sectionId } : {}) },
      select: recipientSelect,
    });
    const result = await deliverToStudents(students, {
      type: 'ANNOUNCEMENT', link: '/academics', title: `${cls?.name ?? 'Class'}: ${subject}`, message: `${message}\n\nFrom: ${sender}`,
    });
    return { students: students.length, ...result };
  },
};
