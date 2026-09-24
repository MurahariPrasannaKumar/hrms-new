"use client";

import { useState } from "react";
import { FormField } from "@/components/forms/FormField";
import { NativeSelect } from "@/components/forms/NativeSelect";
import { PageHeader } from "@/components/layout/PageHeader";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAssignableClasses } from "@/hooks/useLookups";
import { useAuth } from "@/lib/auth";
import { isoDay } from "@/lib/format";
import { useCan } from "../shared";
import { AttendanceReport } from "./AttendanceReport";
import { AttendanceWorkflow } from "./AttendanceWorkflow";
import { MyAttendanceView } from "./MyAttendanceView";

function History() {
  const classes = useAssignableClasses();
  const [classId, setClassId] = useState("");
  const [sectionId, setSectionId] = useState("");
  const [month, setMonth] = useState(isoDay().slice(0, 7));
  const all = classes.data ?? [];
  return (
    <div className="space-y-4">
      <div className="grid gap-4 rounded-2xl border bg-card p-4 shadow-sm sm:grid-cols-3">
        <FormField id="hist-class" label="Class">
          <NativeSelect id="hist-class" placeholder="All classes" value={classId} options={all.map((c) => ({ value: c.id, label: c.name }))} onChange={(e) => { setClassId(e.target.value); setSectionId(""); }} />
        </FormField>
        <FormField id="hist-section" label="Section">
          <NativeSelect id="hist-section" placeholder="All sections" disabled={!classId} value={sectionId} options={(all.find((c) => c.id === classId)?.sections ?? []).map((s) => ({ value: s.id, label: s.name }))} onChange={(e) => setSectionId(e.target.value)} />
        </FormField>
        <FormField id="hist-month" label="Month">
          <Input id="hist-month" type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
        </FormField>
      </div>
      <AttendanceReport sectionId={sectionId || undefined} month={month || undefined} />
    </div>
  );
}

export function AttendancePage() {
  const can = useCan();
  const { user } = useAuth();
  const canMark = can("attendance.create");
  const isParent = user?.role === "PARENT";
  const isTeacher = user?.role === "TEACHER";

  if (user?.role === "STUDENT" || isParent) {
    return (
      <>
        <PageHeader title="Attendance" description={isParent ? "Track your child's attendance." : "Mark your attendance and track your percentage."} />
        <MyAttendanceView />
      </>
    );
  }
  if (!canMark) {
    return (
      <>
        <PageHeader title="Attendance" description="Attendance records." />
        <AttendanceReport />
      </>
    );
  }
  return (
    <>
      <PageHeader title="Attendance" description="Mark daily attendance and review history." />
      <Tabs defaultValue={isTeacher ? "mine" : "mark"}>
        <TabsList>
          {isTeacher && <TabsTrigger value="mine">My attendance</TabsTrigger>}
          <TabsTrigger value="mark">Mark attendance</TabsTrigger>
          <TabsTrigger value="history">History &amp; reports</TabsTrigger>
        </TabsList>
        {isTeacher && <TabsContent value="mine" className="mt-4"><MyAttendanceView mode="teacher" /></TabsContent>}
        <TabsContent value="mark" className="mt-4"><AttendanceWorkflow /></TabsContent>
        <TabsContent value="history" className="mt-4"><History /></TabsContent>
      </Tabs>
    </>
  );
}
