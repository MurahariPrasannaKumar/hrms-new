import { PERMISSIONS, ROLES } from '../config/permissions';

type Method = 'get' | 'post' | 'put' | 'patch' | 'delete';
interface Endpoint {
  method: Method;
  path: string; // OpenAPI-style, relative to /api/v1
  tag: string;
  summary: string;
  perm?: string; // permission key required
  roles?: string; // role restriction note
  body?: string; // request body schema name
  list?: boolean; // paginated list
  query?: string[]; // extra query params
  public?: boolean;
}

const E = (method: Method, path: string, tag: string, summary: string, extra: Partial<Endpoint> = {}): Endpoint => ({
  method, path, tag, summary, ...extra,
});

const dashboardRoles: Record<string, string> = {
  admin: 'SUPER_ADMIN', school: 'SCHOOL_ADMIN', teacher: 'TEACHER', student: 'STUDENT', parent: 'PARENT',
};

const endpoints: Endpoint[] = [
  // Auth
  E('post', '/auth/login', 'Auth', 'Log in with email/username + password', { public: true, body: 'Login' }),
  E('post', '/auth/refresh', 'Auth', 'Rotate refresh token (cookie or body) and issue a new access token', { public: true, body: 'Refresh' }),
  E('post', '/auth/logout', 'Auth', 'Revoke the current session', { public: true }),
  E('post', '/auth/forgot-password', 'Auth', 'Request a password reset (always 200)', { public: true, body: 'ForgotPassword' }),
  E('post', '/auth/reset-password', 'Auth', 'Reset password with a token', { public: true, body: 'ResetPassword' }),
  E('post', '/auth/change-password', 'Auth', 'Change own password (SUPER_ADMIN / SCHOOL_ADMIN only; other users ask an admin)', { body: 'ChangePassword' }),
  E('get', '/auth/me', 'Auth', 'Current user profile, permissions, school and enabled modules'),
  // Schools
  E('get', '/schools', 'Schools', 'List schools (search/filter/sort/paginate)', { perm: 'schools.read', list: true, query: ['status'] }),
  E('post', '/schools', 'Schools', 'Create a school', { perm: 'schools.create', body: 'School' }),
  E('get', '/schools/{id}', 'Schools', 'Get a school', { perm: 'schools.read' }),
  E('patch', '/schools/{id}', 'Schools', 'Update a school (activate/deactivate via status)', { perm: 'schools.update', body: 'School' }),
  E('delete', '/schools/{id}', 'Schools', 'Delete a school', { perm: 'schools.delete' }),
  // Users
  E('get', '/users', 'Users', 'List users', { perm: 'users.read', list: true, query: ['role', 'schoolId', 'status'] }),
  E('post', '/users', 'Users', 'Create a user', { perm: 'users.create', body: 'User' }),
  E('get', '/users/{id}', 'Users', 'Get a user', { perm: 'users.read' }),
  E('patch', '/users/{id}', 'Users', 'Update a user', { perm: 'users.update', body: 'User' }),
  E('delete', '/users/{id}', 'Users', 'Deactivate a user and revoke sessions', { perm: 'users.delete' }),
  E('post', '/users/{id}/reset-password', 'Users', 'Admin sets a new password for a user (signs them out everywhere)', { perm: 'users.update' }),
  E('get', '/teachers/me/classes', 'Teachers', 'Classes/sections assigned to the signed-in teacher', { roles: 'TEACHER' }),
  E('get', '/parents', 'Students', 'List parents in the school (parent picker)', { perm: 'students.create', query: ['search', 'schoolId'] }),
  E('post', '/diary/{id}/complete', 'Diary', 'Mark a diary entry done for the caller', { perm: 'diary.read' }),
  E('delete', '/diary/{id}/complete', 'Diary', 'Unmark a diary entry', { perm: 'diary.read' }),
  // Settings
  E('get', '/settings/system', 'Settings', 'Platform settings', { perm: 'settings.manage', roles: 'SUPER_ADMIN' }),
  E('put', '/settings/system', 'Settings', 'Save platform settings', { perm: 'settings.manage', roles: 'SUPER_ADMIN' }),
  E('get', '/settings/school', 'Settings', 'School profile + timezone/locale (own school; super admin passes schoolId)', { perm: 'settings.manage', query: ['schoolId'] }),
  E('put', '/settings/school', 'Settings', 'Save school profile + timezone/locale', { perm: 'settings.manage', query: ['schoolId'] }),
  // Students
  E('get', '/students', 'Students', 'List students (role-scoped)', { perm: 'students.read', list: true, query: ['classId', 'sectionId', 'status'] }),
  E('post', '/students', 'Students', 'Create a student (optional login)', { perm: 'students.create', body: 'Student' }),
  E('get', '/students/me', 'Students', 'Own profile (STUDENT role only)'),
  E('get', '/students/{id}', 'Students', 'Student profile with attendance summary, results, assignments', { perm: 'students.read' }),
  E('patch', '/students/{id}', 'Students', 'Update a student', { perm: 'students.update', body: 'Student' }),
  E('delete', '/students/{id}', 'Students', 'Delete a student', { perm: 'students.delete' }),
  // Teachers
  E('get', '/teachers', 'Teachers', 'List teachers', { perm: 'teachers.read', list: true }),
  E('post', '/teachers', 'Teachers', 'Create a teacher (user + profile)', { perm: 'teachers.create', body: 'Teacher' }),
  E('get', '/teachers/{id}', 'Teachers', 'Teacher detail with workload', { perm: 'teachers.read' }),
  E('patch', '/teachers/{id}', 'Teachers', 'Update a teacher', { perm: 'teachers.update', body: 'Teacher' }),
  E('delete', '/teachers/{id}', 'Teachers', 'Deactivate a teacher (soft delete, sessions revoked)', { perm: 'teachers.delete' }),
  E('put', '/teachers/{id}/subjects', 'Teachers', 'Replace subject assignments', { perm: 'teachers.update' }),
  E('put', '/teachers/{id}/classes', 'Teachers', 'Replace class/section assignments', { perm: 'teachers.update' }),
  // Academics
  ...['academic-years', 'classes', 'sections', 'subjects', 'exams'].flatMap((r) => [
    E('get', `/${r}`, 'Academics', `List ${r}`, { perm: 'academics.read', list: true }),
    E('post', `/${r}`, 'Academics', `Create in ${r}`, { perm: 'academics.manage' }),
    E('patch', `/${r}/{id}`, 'Academics', `Update in ${r}`, { perm: 'academics.manage' }),
    E('delete', `/${r}/{id}`, 'Academics', `Delete from ${r}`, { perm: 'academics.manage' }),
  ]),
  E('get', '/exams/{id}/results', 'Academics', 'Exam results', { perm: 'academics.read' }),
  E('put', '/exams/{id}/results', 'Academics', 'Enter/replace exam results', { perm: 'academics.manage' }),
  // Attendance
  E('get', '/attendance', 'Attendance', 'List attendance records', { perm: 'attendance.read', list: true, query: ['sectionId', 'classId', 'studentId', 'date', 'from', 'to'] }),
  E('get', '/attendance/section-roster', 'Attendance', 'Students of a section with their status for a date', { perm: 'attendance.read', query: ['sectionId', 'date'] }),
  E('get', '/attendance/summary', 'Attendance', 'Monthly totals and percentage', { perm: 'attendance.read' }),
  E('post', '/attendance', 'Attendance', 'Bulk mark attendance for a section/date', { perm: 'attendance.create', body: 'AttendanceBulk' }),
  E('patch', '/attendance/{id}', 'Attendance', 'Update one attendance record', { perm: 'attendance.update' }),
  E('post', '/attendance/check-in', 'Attendance', 'STUDENT marks themselves present for today (school timezone); 409 if already marked', { roles: 'STUDENT' }),
  E('get', '/attendance/me', 'Attendance', 'Own attendance overview (PARENT: a linked child via studentId): today, overall %, month days, 6-month trend, streaks', { roles: 'STUDENT, PARENT', query: ['month', 'studentId'] }),
  E('post', '/attendance/teacher/check-in', 'Attendance', 'TEACHER checks in for today; 409 if already checked in', { roles: 'TEACHER' }),
  E('get', '/attendance/teacher/me', 'Attendance', 'Teacher own attendance overview (same shape as /attendance/me)', { roles: 'TEACHER', query: ['month'] }),
  E('get', '/progress/summary', 'Progress', 'Risk counts, averages, lowest/highest attendance', { perm: 'reports.read', query: ['schoolId', 'classId', 'sectionId'] }),
  E('get', '/progress/students', 'Progress', 'Student progress table (attendance, exams, assignments, learning, risk)', { perm: 'reports.read', list: true, query: ['classId', 'sectionId', 'risk'] }),
  E('get', '/progress/students/{id}', 'Progress', 'Detailed progress for one student', { perm: 'reports.read', query: ['month'] }),
  E('get', '/progress/teachers', 'Progress', 'Teacher activity table (admins only)', { perm: 'reports.read', list: true }),
  E('get', '/progress/teachers/{id}', 'Progress', 'Detailed activity for one teacher (admins only)', { perm: 'reports.read', query: ['month'] }),
  // Notices
  E('get', '/notices', 'Notices', 'List notices visible to the caller', { perm: 'notices.read', list: true, query: ['type', 'status'] }),
  E('get', '/notices/{id}', 'Notices', 'Get a notice', { perm: 'notices.read' }),
  E('post', '/notices', 'Notices', 'Create / publish / schedule a notice', { perm: 'notices.create', body: 'Notice' }),
  E('patch', '/notices/{id}', 'Notices', 'Update a notice', { perm: 'notices.update', body: 'Notice' }),
  E('delete', '/notices/{id}', 'Notices', 'Delete a notice', { perm: 'notices.delete' }),
  // Diary
  E('get', '/diary', 'Diary', 'List diary entries', { perm: 'diary.read', list: true }),
  E('get', '/diary/{id}', 'Diary', 'Get a diary entry', { perm: 'diary.read' }),
  E('post', '/diary', 'Diary', 'Create a diary entry (optional fileId attachment)', { perm: 'diary.manage', body: 'Diary' }),
  E('patch', '/diary/{id}', 'Diary', 'Update a diary entry', { perm: 'diary.manage', body: 'Diary' }),
  E('delete', '/diary/{id}', 'Diary', 'Delete a diary entry', { perm: 'diary.manage' }),
  E('get', '/assignments', 'Diary', 'List assignments', { perm: 'assignments.read', list: true }),
  E('get', '/assignments/{id}', 'Diary', 'Get an assignment', { perm: 'assignments.read' }),
  E('post', '/assignments', 'Diary', 'Create an assignment (optional fileId)', { perm: 'assignments.manage' }),
  E('patch', '/assignments/{id}', 'Diary', 'Update an assignment', { perm: 'assignments.manage' }),
  E('delete', '/assignments/{id}', 'Diary', 'Delete an assignment', { perm: 'assignments.manage' }),
  E('post', '/assignments/{id}/submissions', 'Diary', 'Submit work (STUDENT)', { perm: 'assignments.read' }),
  E('get', '/assignments/{id}/submissions', 'Diary', 'List submissions', { perm: 'assignments.read' }),
  E('patch', '/assignments/{id}/submissions/{submissionId}', 'Diary', 'Grade a submission', { perm: 'assignments.manage' }),
  // Notifications
  E('get', '/notifications', 'Notifications', 'Own notifications (meta.unreadCount included)', { list: true }),
  E('patch', '/notifications/read-all', 'Notifications', 'Mark all as read'),
  E('patch', '/notifications/{id}/read', 'Notifications', 'Mark one as read'),
  // Learning
  E('get', '/courses', 'Learning', 'List courses', { perm: 'learning.read', list: true }),
  E('post', '/courses', 'Learning', 'Create a course with modules/lessons', { perm: 'learning.manage' }),
  E('get', '/courses/{id}', 'Learning', 'Course with per-lesson progress and completionPercent', { perm: 'learning.read' }),
  E('patch', '/courses/{id}', 'Learning', 'Update a course', { perm: 'learning.manage' }),
  E('delete', '/courses/{id}', 'Learning', 'Delete a course', { perm: 'learning.manage' }),
  E('post', '/lessons/{id}/complete', 'Learning', 'Mark a lesson complete', { perm: 'learning.read' }),
  E('get', '/learning/progress', 'Learning', 'Own progress across courses', { perm: 'learning.read' }),
  E('get', '/learning/certificates', 'Learning', 'Certificates (placeholder)', { perm: 'learning.read' }),
  E('get', '/learning/paths', 'Learning', 'Learning paths', { perm: 'learning.read' }),
  E('post', '/learning/paths', 'Learning', 'Create a learning path', { perm: 'learning.manage' }),
  E('delete', '/learning/paths/{id}', 'Learning', 'Delete a learning path', { perm: 'learning.manage' }),
  E('get', '/resources', 'Learning', 'Resources for Smart Class / Pedagogy / CMDS', { perm: 'learning.read', list: true, query: ['area', 'category', 'type'] }),
  E('get', '/resources/categories', 'Learning', 'Resource categories', { perm: 'learning.read' }),
  E('post', '/resources', 'Learning', 'Create a resource', { perm: 'learning.manage' }),
  E('get', '/resources/{id}', 'Learning', 'Get a resource', { perm: 'learning.read' }),
  E('patch', '/resources/{id}', 'Learning', 'Update a resource', { perm: 'learning.manage' }),
  E('delete', '/resources/{id}', 'Learning', 'Delete a resource', { perm: 'learning.manage' }),
  // Dashboard
  ...Object.entries(dashboardRoles).map(([r, role]) => E('get', `/dashboard/${r}`, 'Dashboard', `${r} dashboard aggregates`, { roles: role })),
  // Modules
  E('get', '/modules/enabled', 'Modules', 'Module keys available to the caller school'),
  E('get', '/modules', 'Modules', 'All modules (optionally per school)', { perm: 'modules.manage', query: ['schoolId'] }),
  E('patch', '/modules/{key}', 'Modules', 'Enable/disable a module platform-wide', { perm: 'modules.manage' }),
  E('put', '/modules/school/{schoolId}/{key}', 'Modules', 'Enable/disable a module for one school', { perm: 'modules.manage' }),
  // Security
  E('get', '/security/audit-logs', 'Security', 'Audit logs', { perm: 'audit_logs.read', list: true, query: ['userId', 'action', 'resource', 'from', 'to', 'schoolId'] }),
  E('get', '/security/login-activity', 'Security', 'Login attempts', { perm: 'security.read', list: true }),
  E('get', '/security/failed-logins', 'Security', 'Failed login attempts', { perm: 'security.read', list: true }),
  E('get', '/security/sessions', 'Security', 'Active sessions', { perm: 'security.read', list: true }),
  E('delete', '/security/sessions/{id}', 'Security', 'Revoke a session', { perm: 'security.read' }),
  // Search / Reports
  E('get', '/search', 'Search', 'Global categorized search', { query: ['q'] }),
  E('get', '/reports/{type}', 'Reports', 'Report (?format=csv to export)', { perm: 'reports.read', query: ['from', 'to', 'format'] }),
  // Files
  E('post', '/files', 'Files', 'Upload a file (multipart/form-data, field "file")'),
  E('get', '/files/{id}', 'Files', 'Download a file'),
  E('delete', '/files/{id}', 'Files', 'Delete a file'),
  // AI
  E('get', '/ai/v-buddy/suggestions', 'AI', 'Suggested questions', { perm: 'ai.use' }),
  E('post', '/ai/v-buddy/chat', 'AI', 'Chat with V Buddy (needs module v-buddy)', { perm: 'ai.use' }),
  E('get', '/ai/v-buddy/conversations', 'AI', 'Own conversations', { perm: 'ai.use' }),
  E('get', '/ai/v-buddy/conversations/{id}', 'AI', 'Conversation with messages', { perm: 'ai.use' }),
  E('delete', '/ai/v-buddy/conversations/{id}', 'AI', 'Delete a conversation', { perm: 'ai.use' }),
  E('post', '/ai/v-buddy/study-plan', 'AI', 'Generate a study plan', { perm: 'ai.use' }),
  E('post', '/ai/instasolve', 'AI', 'Solve a question (needs module instasolve)', { perm: 'ai.use' }),
];

const str = { type: 'string' };
const uuid = { type: 'string', format: 'uuid' };

const bodies: Record<string, object> = {
  Login: { type: 'object', required: ['identifier', 'password'], properties: { identifier: { ...str, example: 'admin@schoolone.com' }, password: { type: 'string', format: 'password' } } },
  Refresh: { type: 'object', properties: { refreshToken: str } },
  ForgotPassword: { type: 'object', required: ['email'], properties: { email: { type: 'string', format: 'email' } } },
  ResetPassword: { type: 'object', required: ['token', 'password'], properties: { token: str, password: { type: 'string', format: 'password' } } },
  ChangePassword: { type: 'object', required: ['currentPassword', 'newPassword'], properties: { currentPassword: str, newPassword: str } },
  School: { type: 'object', properties: { name: str, code: str, email: str, phone: str, address: str, city: str, state: str, country: str, postalCode: str, principal: str, establishedYear: { type: 'integer' }, status: { type: 'string', enum: ['ACTIVE', 'INACTIVE'] } } },
  User: { type: 'object', properties: { email: str, password: str, firstName: str, lastName: str, role: { type: 'string', enum: [...ROLES] }, schoolId: { ...uuid, description: 'Ignored for non-super-admins' }, status: { type: 'string', enum: ['ACTIVE', 'INACTIVE', 'SUSPENDED'] }, extraPermissions: { type: 'array', items: { type: 'string', enum: [...PERMISSIONS] } } } },
  Student: { type: 'object', properties: { admissionNumber: str, firstName: str, lastName: str, dateOfBirth: { type: 'string', format: 'date' }, gender: { type: 'string', enum: ['MALE', 'FEMALE', 'OTHER'] }, classId: uuid, sectionId: uuid, parentId: uuid, login: { type: 'object', properties: { email: str, password: str } } } },
  Teacher: { type: 'object', properties: { email: str, password: str, firstName: str, lastName: str, employeeId: str, qualification: str } },
  AttendanceBulk: { type: 'object', required: ['sectionId', 'date', 'records'], properties: { sectionId: uuid, date: { type: 'string', format: 'date' }, records: { type: 'array', items: { type: 'object', properties: { studentId: uuid, status: { type: 'string', enum: ['PRESENT', 'ABSENT', 'LATE', 'EXCUSED'] }, remark: str } } } } },
  Notice: { type: 'object', properties: { title: str, body: str, type: { type: 'string', enum: ['GENERAL', 'ACADEMIC', 'EVENT', 'EMERGENCY', 'HOLIDAY'] }, publish: { type: 'boolean' }, publishAt: { type: 'string', format: 'date-time' }, expiresAt: { type: 'string', format: 'date-time' }, targets: { type: 'array', items: { type: 'object', properties: { roleName: str, classId: uuid } } } } },
  Diary: { type: 'object', properties: { classId: uuid, sectionId: uuid, subjectId: uuid, title: str, body: str, isHomework: { type: 'boolean' }, dueDate: { type: 'string', format: 'date-time' }, fileId: { ...uuid, description: 'File in the same school (see /files)' } } },
};

const paginationParams = [
  { name: 'page', in: 'query', schema: { type: 'integer', minimum: 1, default: 1 } },
  { name: 'pageSize', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 100, default: 20 } },
  { name: 'search', in: 'query', schema: str },
  { name: 'sortBy', in: 'query', schema: str },
  { name: 'sortOrder', in: 'query', schema: { type: 'string', enum: ['asc', 'desc'] } },
];

const buildOperation = (e: Endpoint) => {
  const pathParams = [...e.path.matchAll(/\{(\w+)\}/g)].map((m) => ({ name: m[1], in: 'path', required: true, schema: str }));
  const extra = (e.query ?? []).map((name) => ({ name, in: 'query', schema: str }));
  const notes = [e.perm && `Requires permission \`${e.perm}\`.`, e.roles && `Role: ${e.roles}.`].filter(Boolean).join(' ');
  const hasBody = ['post', 'put', 'patch'].includes(e.method) && !e.public;
  return {
    tags: [e.tag],
    summary: e.summary,
    ...(notes ? { description: notes } : {}),
    ...(e.public ? { security: [] } : {}),
    parameters: [...pathParams, ...(e.list ? paginationParams : []), ...extra],
    ...(e.body
      ? { requestBody: { required: true, content: { 'application/json': { schema: { $ref: `#/components/schemas/${e.body}` } } } } }
      : hasBody
        ? { requestBody: { content: { 'application/json': { schema: { type: 'object', additionalProperties: true } } } } }
        : {}),
    responses: {
      200: { description: 'Success', content: { 'application/json': { schema: { $ref: e.list ? '#/components/schemas/PaginatedResponse' : '#/components/schemas/SuccessResponse' } } } },
      400: { $ref: '#/components/responses/ValidationError' },
      ...(e.public ? {} : { 401: { $ref: '#/components/responses/Unauthorized' } }),
      ...(e.perm || e.roles ? { 403: { $ref: '#/components/responses/Forbidden' } } : {}),
      404: { $ref: '#/components/responses/NotFound' },
    },
  };
};

const paths: Record<string, Record<string, object>> = {};
for (const e of endpoints) {
  (paths[e.path] ??= {})[e.method] = buildOperation(e);
}

const errorResponse = (description: string) => ({
  description,
  content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } },
});

export const openApiDocument = {
  openapi: '3.0.3',
  info: {
    title: 'EduSphere API',
    version: '0.1.0',
    description:
      'Multi-tenant school management REST API. All routes are under `/api/v1`. Authenticate with `POST /auth/login`, then send `Authorization: Bearer <accessToken>`. ' +
      'The school (tenant) is always derived from the token; only SUPER_ADMIN may target another school via `schoolId`.',
  },
  servers: [{ url: '/api/v1' }],
  tags: [...new Set(endpoints.map((e) => e.tag))].map((name) => ({ name })),
  security: [{ bearerAuth: [] }],
  paths,
  components: {
    securitySchemes: { bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' } },
    schemas: {
      ...bodies,
      SuccessResponse: { type: 'object', properties: { success: { type: 'boolean', example: true }, data: {}, message: { ...str, example: 'Success' } } },
      PaginatedResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: true },
          data: { type: 'array', items: {} },
          message: str,
          meta: { type: 'object', properties: { page: { type: 'integer' }, pageSize: { type: 'integer' }, total: { type: 'integer' }, totalPages: { type: 'integer' } } },
        },
      },
      ErrorResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: false },
          error: { type: 'object', properties: { code: { ...str, example: 'VALIDATION_ERROR' }, message: str, details: { type: 'array', items: {} } } },
        },
      },
    },
    responses: {
      Unauthorized: errorResponse('Missing or invalid token'),
      Forbidden: errorResponse('Insufficient permission or wrong role'),
      NotFound: errorResponse('Not found (also returned for records of other tenants)'),
      ValidationError: errorResponse('Invalid request'),
    },
  },
};
