# Dashboard API contract

Base: `/api/v1/dashboard`. Auth: `Authorization: Bearer <access>`. Envelope: `{ success, data, message }`.
Wrong role => `403 FORBIDDEN`. Percentages are numbers 0-100 with one decimal, or `null` when there is no data.
Attendance "attended" = PRESENT + LATE. Dates: `YYYY-MM-DD`; months: `YYYY-MM`.

## GET /admin  (SUPER_ADMIN)
```
stats: { totalSchools, activeSchools, totalStudents, totalTeachers, totalStaff, activeUsers,
         attendanceTodayPct: number|null,
         pendingActions }            // inactive schools + suspended users
charts: {
  studentGrowth: [{ month, count }],     // cumulative, last 6 months
  schoolGrowth:  [{ month, count }],
  attendanceTrend: [{ date, presentPct, total }],  // last 14 days (days with data only)
  userActivity: [{ date, logins }],      // successful logins, 14 entries incl. zeros
  moduleUsage: [{ module, key, schools }] // schools with module enabled
}
recentActivity: [{ id, action, resource, resourceId, schoolId, user: string|null, createdAt }]
```

## GET /school  (SCHOOL_ADMIN; tenant = own school)
```
stats: { totalStudents, totalTeachers, totalClasses, attendanceTodayPct, pendingAssignments }
recentNotices: [{ id, title, type, createdAt }]
upcomingEvents: [{ id, title, type, publishAt, expiresAt }]   // EVENT/HOLIDAY notices not expired
academicPerformance: { averagePct, bySubject: [{ subject, averagePct }] }
charts: { attendanceTrend, studentDistribution: [{ class, count }], classPerformance: [{ class, averagePct }] }
recentActivity: same shape as admin
```

## GET /teacher  (TEACHER)
```
stats: { assignedClasses, totalStudents, pendingAssignments, attendancePending }
classes: [{ classId, className, sectionId, sectionName, studentCount, attendanceMarkedToday }]
charts: { attendanceTrend }
recentDiary: [{ id, title, isHomework, dueDate, createdAt }]
recentNotices: [{ id, title, type, createdAt }]
```

## GET /student  (STUDENT)
```
student: { id, name, admissionNumber, classId, className, sectionId, sectionName }
attendance: { percent, total, present, absent, late, excused }
performance: { averagePct, byClass: [{class, averagePct}], bySubject: [{subject, averagePct}],
               recent: [{ exam, subject, marks, maxMarks, pct }] }
upcomingAssignments: [{ id, title, dueDate, subject, submitted }]
recentDiary, recentNotices
learning: { completedLessons, totalLessons, progressPct }
```

## GET /parent  (PARENT)
```
children: [{ id, name, admissionNumber, classId, className, sectionId, sectionName,
             attendance: {percent,total,present,absent,late,excused}, averagePct, upcomingAssignments: number }]
recentNotices
```
Notices honour targeting: untargeted, or targeted at the viewer's role/class.
