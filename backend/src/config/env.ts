import 'dotenv/config';
import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(4000),
  DATABASE_URL: z.string().min(1),
  JWT_ACCESS_SECRET: z.string().min(16),
  JWT_REFRESH_SECRET: z.string().min(16),
  JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),
  CORS_ORIGIN: z.string().default('http://localhost:3000'),
  STORAGE_PROVIDER: z.enum(['local', 's3']).default('local'),
  UPLOAD_DIR: z.string().default('./uploads'),
  AI_PROVIDER: z.string().default('mock'),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().default(587),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  /** Public URL of the web app, used for links in emails. Falls back to the first CORS origin. */
  FRONTEND_URL: z.string().optional(),
  MAIL_FROM: z.string().default('EduSphere <no-reply@edusphere.local>'),
  /** Use "none" when the frontend and API are on different sites (e.g. vercel.app + onrender.com). Requires HTTPS. */
  COOKIE_SAMESITE: z.enum(['lax', 'strict', 'none']).default('lax'),
  SEED_DEMO_PASSWORD: z.string().default('password'),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  console.error('Invalid environment configuration:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}
export const env = parsed.data;
export const isProd = env.NODE_ENV === 'production';
