import type { NextFunction, Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import { ZodError } from 'zod';
import { isProd } from '../config/env';
import { logger } from '../config/logger';
import { ApiError } from '../utils/ApiError';

const fail = (res: Response, status: number, code: string, message: string, details: unknown[] = []) =>
  res.status(status).json({ success: false, error: { code, message, details } });

export const notFoundHandler = (req: Request, res: Response) =>
  fail(res, 404, 'NOT_FOUND', `Route ${req.method} ${req.path} not found`);

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const errorHandler = (err: unknown, req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof ZodError) {
    return fail(res, 400, 'VALIDATION_ERROR', 'Invalid request', err.issues.map((i) => ({ path: i.path.join('.'), message: i.message })));
  }
  if (err instanceof ApiError) {
    return fail(res, err.status, err.code, err.message, err.details ? [err.details] : []);
  }
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') return fail(res, 409, 'CONFLICT', 'A record with these values already exists', [err.meta]);
    if (err.code === 'P2025') return fail(res, 404, 'NOT_FOUND', 'Record not found');
    if (err.code === 'P2003') return fail(res, 400, 'BAD_REFERENCE', 'Referenced record does not exist');
  }
  logger.error({ err, path: req.path }, 'Unhandled error');
  return fail(res, 500, 'INTERNAL_ERROR', isProd ? 'Internal server error' : err instanceof Error ? err.message : 'Internal server error');
};
