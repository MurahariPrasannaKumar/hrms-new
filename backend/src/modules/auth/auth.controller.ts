import type { CookieOptions, Request, Response } from 'express';
import { env, isProd } from '../../config/env';
import { audit } from '../../utils/audit';
import { ApiError } from '../../utils/ApiError';
import { parseDurationMs } from '../../utils/crypto';
import { ok } from '../../utils/http';
import { authService, buildProfile } from './auth.service';

const COOKIE = 'refresh_token';
const cookieOptions = (): CookieOptions => ({
  httpOnly: true,
  secure: isProd,
  sameSite: 'lax',
  path: '/api/v1/auth',
  maxAge: parseDurationMs(env.JWT_REFRESH_EXPIRES_IN),
});
const ctx = (req: Request) => ({ ip: req.ip, userAgent: req.headers['user-agent'] });
const readRefresh = (req: Request): string | undefined => req.cookies?.[COOKIE] ?? req.body?.refreshToken;

export const authController = {
  async login(req: Request, res: Response) {
    const { identifier, password } = req.body;
    const result = await authService.login(identifier, password, ctx(req));
    res.cookie(COOKIE, result.refreshToken, cookieOptions());
    await audit(req, { userId: result.user.id, schoolId: result.user.schoolId, action: 'LOGIN', resource: 'AUTH' });
    ok(res, result, 'Login successful');
  },

  async refresh(req: Request, res: Response) {
    const token = readRefresh(req);
    if (!token) throw ApiError.unauthorized('Refresh token missing');
    const result = await authService.refresh(token, ctx(req));
    res.cookie(COOKIE, result.refreshToken, cookieOptions());
    ok(res, result, 'Token refreshed');
  },

  async logout(req: Request, res: Response) {
    await authService.logout(readRefresh(req));
    res.clearCookie(COOKIE, { ...cookieOptions(), maxAge: undefined });
    ok(res, null, 'Logged out');
  },

  async forgotPassword(req: Request, res: Response) {
    await authService.forgotPassword(req.body.email);
    ok(res, null, 'If the account exists, a reset link has been sent');
  },

  async resetPassword(req: Request, res: Response) {
    await authService.resetPassword(req.body.token, req.body.password);
    ok(res, null, 'Password has been reset');
  },

  async changePassword(req: Request, res: Response) {
    await authService.changePassword(req.user!.id, req.body.currentPassword, req.body.newPassword);
    await audit(req, { action: 'CHANGE_PASSWORD', resource: 'USER', resourceId: req.user!.id });
    ok(res, null, 'Password changed');
  },

  async me(req: Request, res: Response) {
    ok(res, await buildProfile(req.user!.id));
  },
};
