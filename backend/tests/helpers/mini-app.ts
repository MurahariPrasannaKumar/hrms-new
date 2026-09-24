import cookieParser from 'cookie-parser';
import express from 'express';
import request from 'supertest';
import { errorHandler, notFoundHandler } from '../../src/middlewares/error';
import { aiRouter } from '../../src/modules/ai/ai.routes';
import { authRouter } from '../../src/modules/auth/auth.routes';
import { filesRouter } from '../../src/modules/files/files.routes';
import { learningRouter } from '../../src/modules/learning/learning.routes';

export const createMiniApp = () => {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  const api = express.Router();
  api.use('/auth', authRouter);
  api.use('/files', filesRouter);
  api.use('/ai', aiRouter);
  api.use(learningRouter);
  app.use('/api/v1', api);
  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
};

const PASSWORD = process.env.SEED_DEMO_PASSWORD ?? 'password';
export const tokenFor = async (app: express.Express, email: string) => {
  const res = await request(app).post('/api/v1/auth/login').send({ identifier: email, password: PASSWORD });
  if (res.status !== 200) throw new Error(`login failed for ${email}: ${res.status}`);
  return res.body.data.accessToken as string;
};
