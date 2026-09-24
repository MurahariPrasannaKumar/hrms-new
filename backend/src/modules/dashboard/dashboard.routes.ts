/**
 * Dashboard API (all under /api/v1/dashboard, envelope { success, data, message }).
 * Full contract with field notes: backend/docs/dashboard-contract.md
 *
 * GET /admin   (SUPER_ADMIN) -> {
 *   stats: { totalSchools, activeSchools, totalStudents, totalTeachers, totalStaff, activeUsers,
 *            attendanceTodayPct: number|null, pendingActions },
 *   charts: { studentGrowth: {month:'YYYY-MM',count}[], schoolGrowth: same,
 *             attendanceTrend: {date:'YYYY-MM-DD',presentPct,total}[], userActivity: {date,logins}[],
 *             moduleUsage: {module,key,schools}[] },
 *   recentActivity: {id,action,resource,resourceId,schoolId,user:string|null,createdAt}[] }
 * GET /school  (SCHOOL_ADMIN) -> {
 *   stats: { totalStudents, totalTeachers, totalClasses, attendanceTodayPct, pendingAssignments },
 *   recentNotices: {id,title,type,createdAt}[], upcomingEvents: {id,title,type,publishAt,expiresAt}[],
 *   academicPerformance: { averagePct: number|null, bySubject: {subject,averagePct}[] },
 *   charts: { attendanceTrend, studentDistribution: {class,count}[], classPerformance: {class,averagePct}[] },
 *   recentActivity }
 * GET /teacher (TEACHER) -> {
 *   stats: { assignedClasses, totalStudents, pendingAssignments, attendancePending },
 *   classes: {classId,className,sectionId,sectionName,studentCount,attendanceMarkedToday}[],
 *   charts: { attendanceTrend }, recentDiary, recentNotices }
 * GET /student (STUDENT) -> { student, attendance:{percent,total,present,absent,late,excused},
 *   performance:{averagePct,byClass,bySubject,recent}, upcomingAssignments, recentDiary, recentNotices,
 *   learning:{completedLessons,totalLessons,progressPct} }
 * GET /parent  (PARENT) -> { children: {id,name,admissionNumber,classId,className,sectionId,sectionName,
 *   attendance,averagePct,upcomingAssignments:number}[], recentNotices }
 */
import { Router } from 'express';
import { requireAuth, requireRole } from '../../middlewares/auth';
import { asyncHandler } from '../../utils/http';
import { dashboardController as c } from './dashboard.controller';

export const dashboardRouter = Router();
dashboardRouter.use(requireAuth);

dashboardRouter.get('/admin', requireRole('SUPER_ADMIN'), asyncHandler(c.admin));
dashboardRouter.get('/school', requireRole('SCHOOL_ADMIN'), asyncHandler(c.school));
dashboardRouter.get('/teacher', requireRole('TEACHER'), asyncHandler(c.teacher));
dashboardRouter.get('/student', requireRole('STUDENT'), asyncHandler(c.student));
dashboardRouter.get('/parent', requireRole('PARENT'), asyncHandler(c.parent));
