import { Router } from 'express';
import { academicsRouter } from './modules/academics/academics.routes';
import { aiRouter } from './modules/ai/ai.routes';
import { attendanceRouter } from './modules/attendance/attendance.routes';
import { authRouter } from './modules/auth/auth.routes';
import { dashboardRouter } from './modules/dashboard/dashboard.routes';
import { diaryRouter } from './modules/diary/diary.routes';
import { filesRouter } from './modules/files/files.routes';
import { leaveRouter } from './modules/leave/leave.routes';
import { learningRouter } from './modules/learning/learning.routes';
import { modulesRouter } from './modules/modules/modules.routes';
import { noticesRouter } from './modules/notices/notices.routes';
import { notificationsRouter } from './modules/notifications/notifications.routes';
import { profileRouter } from './modules/profile/profile.routes';
import { parentsRouter } from './modules/parents/parents.routes';
import { progressRouter } from './modules/progress/progress.routes';
import { reportsRouter } from './modules/reports/reports.routes';
import { schoolsRouter } from './modules/schools/schools.routes';
import { settingsRouter } from './modules/settings/settings.routes';
import { searchRouter } from './modules/search/search.routes';
import { securityRouter } from './modules/security/security.routes';
import { studentsRouter } from './modules/students/students.routes';
import { teachersRouter } from './modules/teachers/teachers.routes';
import { usageRouter } from './modules/usage/usage.routes';
import { usersRouter } from './modules/users/users.routes';

export const apiRouter = Router();

// Prefix-mounted routers apply auth internally via router.use(requireAuth).
apiRouter.use('/auth', authRouter);
apiRouter.use('/schools', schoolsRouter);
apiRouter.use('/users', usersRouter);
apiRouter.use('/students', studentsRouter);
apiRouter.use('/teachers', teachersRouter);
apiRouter.use('/attendance', attendanceRouter);
apiRouter.use('/notices', noticesRouter);
apiRouter.use('/notifications', notificationsRouter);
apiRouter.use('/profile', profileRouter);
apiRouter.use('/leave', leaveRouter);
apiRouter.use('/usage', usageRouter);
apiRouter.use('/dashboard', dashboardRouter);
apiRouter.use('/modules', modulesRouter);
apiRouter.use('/security', securityRouter);
apiRouter.use('/search', searchRouter);
apiRouter.use('/reports', reportsRouter);
apiRouter.use('/files', filesRouter);
apiRouter.use('/ai', aiRouter);
apiRouter.use('/settings', settingsRouter);
apiRouter.use('/progress', progressRouter);
apiRouter.use('/parents', parentsRouter);

// Root-mounted routers: they declare full paths (/classes, /diary, /courses ...)
// and MUST attach requireAuth per route, never router.use(requireAuth).
apiRouter.use(academicsRouter); // /academic-years /classes /sections /subjects /exams
apiRouter.use(diaryRouter); // /diary /assignments
apiRouter.use(learningRouter); // /courses /lessons /learning/progress /resources
