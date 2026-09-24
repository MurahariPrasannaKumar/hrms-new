import type { NotificationType } from '@prisma/client';
import { prisma } from '../../config/database';
import { logger } from '../../config/logger';
import { renderEmail } from '../../utils/email-template';
import { sendMail } from '../../utils/mailer';

/** Where a notification of this type leads when the sender gave no explicit link. */
const DEFAULT_LINK: Partial<Record<NotificationType, string>> = { ASSIGNMENT: '/assignments', NOTICE: '/notices', ATTENDANCE: '/attendance' };

const ROLE_AREA: Record<string, string> = {
  SUPER_ADMIN: '/admin', SCHOOL_ADMIN: '/school', TEACHER: '/teacher', STAFF: '/staff', STUDENT: '/student', PARENT: '/parent',
};

export type ChannelName = 'IN_APP' | 'EMAIL' | 'PUSH' | 'SMS';

export interface NotificationPayload {
  type: NotificationType;
  title: string;
  message: string;
  /** Page to open when the notification is clicked, relative to the recipient's role area, e.g. "/leave". */
  link?: string;
  /** Email-only extras (the in-app notification stores just title and message). */
  email?: { category?: string; details?: { label: string; value: string }[]; action?: { label: string; path: string } };
}

export interface NotificationChannel {
  readonly name: ChannelName;
  send(userIds: string[], payload: NotificationPayload): Promise<void>;
}

class InAppChannel implements NotificationChannel {
  readonly name = 'IN_APP' as const;
  async send(userIds: string[], payload: NotificationPayload) {
    if (!userIds.length) return;
    await prisma.notification.createMany({
      data: userIds.map((userId) => ({
        userId, type: payload.type, title: payload.title, message: payload.message, link: payload.link ?? DEFAULT_LINK[payload.type] ?? null,
      })),
    });
  }
}

class EmailChannel implements NotificationChannel {
  readonly name = 'EMAIL' as const;
  async send(userIds: string[], payload: NotificationPayload) {
    const users = await prisma.user.findMany({ where: { id: { in: userIds }, status: 'ACTIVE' }, select: { email: true, firstName: true, role: { select: { name: true } } } });
    // Small batches so a notice to a whole school does not open hundreds of SMTP connections at once.
    const send = (u: (typeof users)[number]) => {
      // `{area}` in an action path becomes the recipient's role area (/school, /teacher, ...).
      const action = payload.email?.action && { ...payload.email.action, path: payload.email.action.path.replace('{area}', ROLE_AREA[u.role.name] ?? '') };
      const { html, text } = renderEmail({ ...payload.email, action, heading: payload.title, greetingName: u.firstName, message: payload.message });
      return sendMail({ to: u.email, subject: payload.title, text, html });
    };
    for (let i = 0; i < users.length; i += 10) await Promise.all(users.slice(i, i + 10).map(send));
  }
}

/** Placeholder for future providers: swap in a real implementation via register(). */
class StubChannel implements NotificationChannel {
  constructor(readonly name: Exclude<ChannelName, 'IN_APP' | 'EMAIL'>) {}
  async send(userIds: string[], payload: NotificationPayload) {
    logger.debug({ channel: this.name, count: userIds.length, title: payload.title }, 'Channel not configured; skipped');
  }
}

export class NotificationService {
  private channels = new Map<ChannelName, NotificationChannel>();

  constructor(channels: NotificationChannel[]) {
    channels.forEach((c) => this.register(c));
  }

  register(channel: NotificationChannel) {
    this.channels.set(channel.name, channel);
  }

  async notify(userIds: string[], payload: NotificationPayload, via: ChannelName[] = ['IN_APP']) {
    const unique = [...new Set(userIds)];
    if (!unique.length) return;
    await Promise.all(
      via.map((name) =>
        this.channels
          .get(name)
          ?.send(unique, payload)
          .catch((err) => logger.error({ err, channel: name }, 'Notification channel failed')),
      ),
    );
  }
}

export const notificationService = new NotificationService([
  new InAppChannel(),
  new EmailChannel(),
  new StubChannel('PUSH'),
  new StubChannel('SMS'),
]);
