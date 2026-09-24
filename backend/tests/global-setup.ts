import 'dotenv/config';
import { execSync } from 'node:child_process';

export default function setup() {
  const url = process.env.TEST_DATABASE_URL;
  if (!url) throw new Error('TEST_DATABASE_URL is required to run tests (never run tests against the real database)');
  const env = { ...process.env, DATABASE_URL: url, SEED_DEMO_DATA: 'true', NODE_ENV: 'test' };
  execSync('npx prisma migrate deploy', { env, stdio: 'inherit' });
  execSync('npx tsx prisma/seed.ts', { env, stdio: 'inherit' });
}
