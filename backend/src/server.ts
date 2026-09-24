import { createApp } from './app';
import { prisma } from './config/database';
import { env } from './config/env';
import { logger } from './config/logger';
import { startNoticePublisher } from './modules/notices/notices.publisher';

const server = createApp().listen(env.PORT, () => logger.info(`API listening on :${env.PORT}`));
const publisher = startNoticePublisher();

const shutdown = async () => {
  clearInterval(publisher);
  server.close();
  await prisma.$disconnect();
  process.exit(0);
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
