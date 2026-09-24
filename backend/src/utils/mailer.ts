import nodemailer from 'nodemailer';
import { env } from '../config/env';
import { logger } from '../config/logger';

const transport = env.SMTP_HOST
  ? nodemailer.createTransport({
      host: env.SMTP_HOST, port: env.SMTP_PORT, secure: env.SMTP_PORT === 465,
      auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined,
    })
  : null;

export interface Mail { to: string; subject: string; text: string; html?: string }

/** Never throws: a mail failure must not fail the request that triggered it. Logs instead when SMTP is not configured. */
export async function sendMail(mail: Mail): Promise<boolean> {
  if (!transport) {
    logger.info({ to: mail.to, subject: mail.subject }, 'SMTP not configured; email not sent (set SMTP_HOST to enable)');
    return false;
  }
  try {
    await transport.sendMail({ from: env.MAIL_FROM, ...mail });
    return true;
  } catch (err) {
    logger.error({ err, to: mail.to, subject: mail.subject }, 'Failed to send email');
    return false;
  }
}
