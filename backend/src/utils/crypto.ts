import crypto from 'node:crypto';

export const randomToken = (bytes = 48) => crypto.randomBytes(bytes).toString('base64url');
export const sha256 = (v: string) => crypto.createHash('sha256').update(v).digest('hex');

const UNITS = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 } as const;
export const parseDurationMs = (s: string): number => {
  const m = /^(\d+)([smhd])$/.exec(s);
  if (!m) throw new Error(`Invalid duration: ${s}`);
  return Number(m[1]) * UNITS[m[2] as keyof typeof UNITS];
};
