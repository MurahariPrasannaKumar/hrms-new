"use client";

import { useQuery } from "@tanstack/react-query";
import { Activity, AlertTriangle, BarChart3, CalendarCheck, GraduationCap, Plus, School, UserCog, Users } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Line, LineChart, Tooltip, XAxis, YAxis } from "recharts";
import { PageHeader } from "@/components/layout/PageHeader";
import { dashboardApi } from "@/lib/api/dashboard";
import { useAuth } from "@/lib/auth";
import { ChartCard } from "./ChartCard";
import { QuickAction } from "./QuickAction";
import { RecentActivity } from "./RecentActivity";
import { StatCard } from "./StatCard";
import { AttendanceTrendChart, COLORS, DashboardError, DashboardSkeleton, Reveal, pct, shortDate, toActivity } from "./shared";

export function AdminDashboard() {
  const { user } = useAuth();
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ["dashboard", "admin"], queryFn: dashboardApi.admin });

  return (
    <div className="space-y-6">
      <PageHeader title={`Welcome back, ${user?.firstName ?? ""}`} description="Platform overview across all schools" />
      {isLoading && <DashboardSkeleton />}
      {error && <DashboardError error={error} onRetry={() => refetch()} />}
      {data && (
        <>
          <Reveal>
            <section aria-label="Platform summary" className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              <StatCard label="Total schools" value={data.stats.totalSchools} icon={School} tint="indigo" hint={`${data.stats.activeSchools} active`} />
              <StatCard label="Total students" value={data.stats.totalStudents} icon={GraduationCap} tint="teal" />
              <StatCard label="Total teachers" value={data.stats.totalTeachers} icon={Users} tint="sky" />
              <StatCard label="Total staff" value={data.stats.totalStaff} icon={UserCog} tint="violet" />
              <StatCard label="Active users" value={data.stats.activeUsers} icon={Activity} tint="emerald" />
              <StatCard label="Attendance today" value={pct(data.stats.attendanceTodayPct)} icon={CalendarCheck} tint="amber" />
              <StatCard label="Pending actions" value={data.stats.pendingActions} icon={AlertTriangle} tint="rose" hint="Inactive schools + suspended users" />
              <StatCard label="Active schools" value={data.stats.activeSchools} icon={School} tint="orange" />
            </section>
          </Reveal>

          <Reveal index={1}>
            <section aria-label="Quick actions" className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <QuickAction label="Add school" href="/admin/schools" icon={Plus} tint="indigo" />
              <QuickAction label="Add user" href="/admin/users" icon={UserCog} tint="teal" />
              <QuickAction label="View schools" href="/admin/schools" icon={School} tint="sky" />
              <QuickAction label="View reports" href="/admin/reports" icon={BarChart3} tint="amber" />
            </section>
          </Reveal>

          <Reveal index={2} className="grid gap-4 lg:grid-cols-2">
            <ChartCard title="Student growth" description="Cumulative, last 6 months">
              <LineChart data={data.charts.studentGrowth} margin={{ left: -16, right: 8 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="month" fontSize={12} />
                <YAxis allowDecimals={false} fontSize={12} />
                <Tooltip />
                <Line type="monotone" dataKey="count" name="Students" stroke={COLORS.primary} strokeWidth={2} />
              </LineChart>
            </ChartCard>
            <ChartCard title="School growth" description="Cumulative, last 6 months">
              <BarChart data={data.charts.schoolGrowth} margin={{ left: -16, right: 8 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="month" fontSize={12} />
                <YAxis allowDecimals={false} fontSize={12} />
                <Tooltip />
                <Bar dataKey="count" name="Schools" fill={COLORS.teal} radius={[6, 6, 0, 0]} />
              </BarChart>
            </ChartCard>
            <AttendanceTrendChart data={data.charts.attendanceTrend} title="Attendance trends" />
            <ChartCard title="User activity" description="Successful logins, last 14 days">
              <BarChart data={data.charts.userActivity} margin={{ left: -16, right: 8 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="date" tickFormatter={shortDate} fontSize={12} />
                <YAxis allowDecimals={false} fontSize={12} />
                <Tooltip labelFormatter={(l) => shortDate(String(l))} />
                <Bar dataKey="logins" name="Logins" fill={COLORS.primary} radius={[6, 6, 0, 0]} />
              </BarChart>
            </ChartCard>
          </Reveal>

          <Reveal index={3} className="grid gap-4 lg:grid-cols-2">
            <ChartCard title="Module usage" description="Schools with each module enabled" height={320}>
              <BarChart data={data.charts.moduleUsage} layout="vertical" margin={{ left: 24, right: 8 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" allowDecimals={false} fontSize={12} />
                <YAxis type="category" dataKey="module" width={100} fontSize={12} />
                <Tooltip />
                <Bar dataKey="schools" name="Schools" fill={COLORS.sky} radius={[0, 6, 6, 0]} />
              </BarChart>
            </ChartCard>
            <RecentActivity items={toActivity(data.recentActivity)} />
          </Reveal>
        </>
      )}
    </div>
  );
}
