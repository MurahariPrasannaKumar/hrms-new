export const ROLES = ['SUPER_ADMIN', 'SCHOOL_ADMIN', 'TEACHER', 'STUDENT', 'PARENT', 'STAFF'] as const;
export type RoleName = (typeof ROLES)[number];

export const PERMISSIONS = [
  'students.read', 'students.create', 'students.update', 'students.delete',
  'teachers.read', 'teachers.create', 'teachers.update', 'teachers.delete',
  'attendance.read', 'attendance.create', 'attendance.update',
  'academics.read', 'academics.manage',
  'assignments.read', 'assignments.manage',
  'diary.read', 'diary.manage',
  'notices.read', 'notices.create', 'notices.update', 'notices.delete',
  'users.read', 'users.create', 'users.update', 'users.delete',
  'schools.read', 'schools.create', 'schools.update', 'schools.delete',
  'modules.manage',
  'learning.read', 'learning.manage',
  'ai.use',
  'reports.read',
  'settings.manage',
  'security.read',
  'audit_logs.read',
  'leave.apply', 'leave.manage',
] as const;
export type PermissionKey = (typeof PERMISSIONS)[number];

export const ROLE_PERMISSIONS: Record<RoleName, PermissionKey[]> = {
  SUPER_ADMIN: [...PERMISSIONS],
  SCHOOL_ADMIN: PERMISSIONS.filter((p) => !p.startsWith('schools.') && p !== 'modules.manage' && p !== 'leave.apply'),
  TEACHER: [
    'students.read', 'students.update', 'attendance.read', 'attendance.create', 'attendance.update',
    'academics.read', 'academics.manage', 'assignments.read', 'assignments.manage', 'diary.read', 'diary.manage',
    'notices.read', 'learning.read', 'learning.manage', 'ai.use', 'reports.read', 'leave.apply',
  ],
  STUDENT: [
    'attendance.read', 'academics.read', 'assignments.read', 'diary.read',
    'notices.read', 'learning.read', 'ai.use',
  ],
  PARENT: ['students.read', 'attendance.read', 'academics.read', 'assignments.read', 'diary.read', 'notices.read'],
  STAFF: ['students.read', 'notices.read', 'attendance.read', 'leave.apply'],
};

export const MODULES = [
  { key: 'dashboard', name: 'Dashboard' },
  { key: 'academics', name: 'Academics' },
  { key: 'attendance', name: 'Attendance' },
  { key: 'diary', name: 'Digital Diary' },
  { key: 'noticeboard', name: 'Noticeboard' },
  { key: 'school', name: 'School' },
  { key: 'security', name: 'Security' },
  { key: 'student', name: 'Student' },
  { key: 'pedagogy', name: 'Pedagogy' },
  { key: 'v-buddy', name: 'V Buddy' },
  { key: 'instasolve', name: 'Instasolve' },
  { key: 'smart-class', name: 'Smart Class' },
  { key: 'cmds', name: 'CMDS 2.0' },
  { key: 'learn', name: 'Learn 2.0' },
] as const;
