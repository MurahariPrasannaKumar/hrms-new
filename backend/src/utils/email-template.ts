import { env } from '../config/env';

export interface EmailContent {
  /** Small label above the heading, e.g. "Leave management". */
  category?: string;
  heading: string;
  greetingName?: string;
  /** Body text. Blank lines start a new paragraph, single newlines become line breaks. */
  message: string;
  /** Key facts shown as a table (dates, type, reason...). */
  details?: { label: string; value: string }[];
  /** Button linking into the platform. `path` is relative to the frontend, e.g. "/school/leave". */
  action?: { label: string; path: string };
}

const BRAND = '#c8593a';
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string);
const paragraphs = (s: string) =>
  s.split(/\n{2,}/).map((p) => `<p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:#374151;">${esc(p.trim()).replace(/\n/g, '<br>')}</p>`).join('');

const baseUrl = () => (env.FRONTEND_URL || env.CORS_ORIGIN.split(',')[0]).trim().replace(/\/$/, '');

/** Branded, table-based HTML (works in Gmail/Outlook) plus a plain-text alternative. */
export function renderEmail(c: EmailContent): { html: string; text: string } {
  const link = c.action ? `${baseUrl()}${c.action.path}` : null;
  const details = c.details?.length
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:6px 0 20px;border:1px solid #eee5df;border-radius:10px;border-collapse:separate;overflow:hidden;">${c.details
        .map((d, i) => `<tr><td style="padding:10px 14px;width:34%;font-size:13px;color:#6b7280;background:#faf7f4;${i ? 'border-top:1px solid #eee5df;' : ''}">${esc(d.label)}</td><td style="padding:10px 14px;font-size:14px;color:#111827;${i ? 'border-top:1px solid #eee5df;' : ''}">${esc(d.value).replace(/\n/g, '<br>')}</td></tr>`)
        .join('')}</table>`
    : '';
  const button = link
    ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 6px;"><tr><td style="border-radius:8px;background:${BRAND};"><a href="${esc(link)}" style="display:inline-block;padding:11px 22px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;">${esc(c.action!.label)}</a></td></tr></table>`
    : '';

  const html = `<!doctype html><html><body style="margin:0;padding:0;background:#f4f1ee;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f1ee;padding:24px 12px;"><tr><td align="center">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#ffffff;border-radius:14px;overflow:hidden;font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
<tr><td style="background:${BRAND};padding:18px 28px;font-size:20px;font-weight:700;color:#ffffff;letter-spacing:.3px;">EduSphere</td></tr>
<tr><td style="padding:28px;">
${c.category ? `<p style="margin:0 0 6px;font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:${BRAND};font-weight:600;">${esc(c.category)}</p>` : ''}
<h1 style="margin:0 0 18px;font-size:21px;line-height:1.3;color:#111827;">${esc(c.heading)}</h1>
${c.greetingName ? `<p style="margin:0 0 14px;font-size:15px;color:#374151;">Hi ${esc(c.greetingName)},</p>` : ''}
${paragraphs(c.message)}
${details}
${button}
</td></tr>
<tr><td style="padding:16px 28px;background:#faf7f4;border-top:1px solid #eee5df;font-size:12px;line-height:1.5;color:#9ca3af;">This is an automated message from EduSphere. Please do not reply to this email.</td></tr>
</table></td></tr></table></body></html>`;

  const text = [
    c.greetingName ? `Hi ${c.greetingName},` : '',
    '',
    c.message,
    ...(c.details?.length ? ['', ...c.details.map((d) => `${d.label}: ${d.value}`)] : []),
    ...(link ? ['', `${c.action!.label}: ${link}`] : []),
    '',
    '— EduSphere',
  ].join('\n');

  return { html, text };
}
