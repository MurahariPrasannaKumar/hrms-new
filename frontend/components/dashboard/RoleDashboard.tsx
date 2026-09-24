"use client";

import { useAuth } from "@/lib/auth";
import { AdminDashboard } from "./AdminDashboard";
import { ParentDashboard } from "./ParentDashboard";
import { SchoolDashboard } from "./SchoolDashboard";
import { StaffDashboard } from "./StaffDashboard";
import { StudentDashboard } from "./StudentDashboard";
import { TeacherDashboard } from "./TeacherDashboard";

/** Dispatches to the dashboard matching the signed-in role. */
export function RoleDashboard() {
  const { role } = useAuth();
  switch (role) {
    case "SUPER_ADMIN": return <AdminDashboard />;
    case "SCHOOL_ADMIN": return <SchoolDashboard />;
    case "TEACHER": return <TeacherDashboard />;
    case "STUDENT": return <StudentDashboard />;
    case "PARENT": return <ParentDashboard />;
    case "STAFF": return <StaffDashboard />;
    default: return null;
  }
}
