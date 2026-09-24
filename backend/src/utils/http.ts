import type { NextFunction, Request, RequestHandler, Response } from 'express';

export const asyncHandler =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>): RequestHandler =>
  (req, res, next) => {
    fn(req, res, next).catch(next);
  };

export const ok = <T>(res: Response, data: T, message = 'Success', status = 200, meta?: unknown) =>
  res.status(status).json({ success: true, data, message, ...(meta ? { meta } : {}) });
