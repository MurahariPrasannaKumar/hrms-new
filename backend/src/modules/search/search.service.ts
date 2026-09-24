import type { Request } from 'express';
import { optionalSchoolScope } from '../../middlewares/tenant';
import { getOwnStudentIds } from '../../utils/actor';
import { buildNoticeVisibility } from '../notices/notices.service';
import { searchRepository as repo } from './search.repository';

export const searchService = {
  async search(req: Request, q: { q: string; limit: number; schoolId?: string }) {
    const user = req.user!;
    const has = (p: string) => user.permissions.includes(p as never);
    const schoolId = optionalSchoolScope(req, q.schoolId);
    const empty = Promise.resolve([] as never[]);

    const own = await getOwnStudentIds(user);
    const studentWhere = { ...(schoolId ? { schoolId } : {}), ...(own ? { id: { in: own } } : {}) };
    const noticeWhere = has('notices.read') ? await buildNoticeVisibility(req, schoolId) : null;

    const [students, teachers, schools, notices, courses, resources] = await Promise.all([
      has('students.read') ? repo.students(q.q, studentWhere, q.limit) : empty,
      has('teachers.read') ? repo.teachers(q.q, schoolId, q.limit) : empty,
      user.role === 'SUPER_ADMIN' ? repo.schools(q.q, q.limit) : empty,
      noticeWhere ? repo.notices(q.q, noticeWhere, q.limit) : empty,
      has('learning.read') ? repo.courses(q.q, schoolId, q.limit) : empty,
      has('learning.read') ? repo.resources(q.q, schoolId, q.limit) : empty,
    ]);

    return { students, teachers, schools, notices, courses, resources };
  },
};
