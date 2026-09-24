import { Router } from 'express';
import { requireAuth, requirePermission, requireRole } from '../../middlewares/auth';
import { validate } from '../../middlewares/validate';
import { asyncHandler } from '../../utils/http';
import { attendanceController as c } from './attendance.controller';
import {
  idParamSchema, listAttendanceSchema, markAttendanceSchema, meSchema, rosterSchema, summarySchema, updateRecordSchema,
} from './attendance.validation';

export const attendanceRouter = Router();
attendanceRouter.use(requireAuth);
// Self-service (own data only; ownership is resolved from the token, never from the client)
attendanceRouter.post('/check-in', requireRole('STUDENT'), asyncHandler(c.studentCheckIn));
attendanceRouter.get('/me', requireRole('STUDENT', 'PARENT'), validate(meSchema, 'query'), asyncHandler(c.me));
attendanceRouter.post('/teacher/check-in', requireRole('TEACHER'), asyncHandler(c.teacherCheckIn));
attendanceRouter.get('/teacher/me', requireRole('TEACHER'), validate(meSchema, 'query'), asyncHandler(c.teacherMe));
attendanceRouter.get('/', requirePermission('attendance.read'), validate(listAttendanceSchema, 'query'), asyncHandler(c.list));
attendanceRouter.get('/section-roster', requirePermission('attendance.create'), validate(rosterSchema, 'query'), asyncHandler(c.roster));
attendanceRouter.get('/summary', requirePermission('attendance.read'), validate(summarySchema, 'query'), asyncHandler(c.summary));
attendanceRouter.post('/', requirePermission('attendance.create'), validate(markAttendanceSchema), asyncHandler(c.mark));
attendanceRouter.patch(
  '/:id', requirePermission('attendance.update'), validate(idParamSchema, 'params'), validate(updateRecordSchema), asyncHandler(c.update),
);
