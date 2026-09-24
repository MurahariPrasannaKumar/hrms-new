import 'dotenv/config';
import { defineConfig } from 'vitest/config';

// Tests always run against TEST_DATABASE_URL; DATABASE_URL is overridden before any module loads.
export default defineConfig({
  test: {
    environment: 'node',
    fileParallelism: false,
    testTimeout: 20_000,
    globalSetup: ['./tests/global-setup.ts'],
    env: { NODE_ENV: 'test', DATABASE_URL: process.env.TEST_DATABASE_URL ?? '' },
  },
});
