import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { attendanceMessage, levelFor } from "@/components/features/attendance/attendance-utils";
import { AttendanceGauge } from "@/components/features/attendance/AttendanceGauge";
import { CheckInCard } from "@/components/features/attendance/CheckInCard";
import { MonthHeatmap } from "@/components/features/attendance/MonthHeatmap";
import { StudentProgressTable } from "@/components/features/progress/StudentProgressTable";
import type { StudentProgressRow, TodayState } from "@/lib/api/attendance-progress";

const today = (over: Partial<TodayState> = {}): TodayState => ({
  date: "2026-03-09", marked: false, status: null, source: null, checkedInAt: null, checkedInTime: null, canCheckIn: true, reason: null, ...over,
});

describe("CheckInCard", () => {
  it("lets the student check in and calls the handler", async () => {
    const onCheckIn = vi.fn();
    render(<CheckInCard today={today()} onCheckIn={onCheckIn} />);
    await userEvent.click(screen.getByRole("button", { name: /mark me present/i }));
    expect(onCheckIn).toHaveBeenCalledTimes(1);
  });

  it("disables the button while the request is pending", () => {
    render(<CheckInCard today={today()} onCheckIn={vi.fn()} pending />);
    expect(screen.getByRole("button", { name: /marking/i })).toBeDisabled();
  });

  it("shows the check-in time once marked and hides the button", () => {
    render(<CheckInCard today={today({ marked: true, status: "PRESENT", source: "SELF", canCheckIn: false, checkedInTime: "09:12" })} onCheckIn={vi.fn()} />);
    expect(screen.getByRole("status")).toHaveTextContent("09:12");
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("says when a teacher overrode the status", () => {
    render(<CheckInCard today={today({ marked: true, status: "ABSENT", source: "TEACHER", canCheckIn: false })} onCheckIn={vi.fn()} />);
    expect(screen.getByRole("status")).toHaveTextContent(/absent.*by your teacher/i);
  });

  it("explains why check-in is not available", () => {
    render(<CheckInCard today={today({ canCheckIn: false, reason: "Your account is not linked to a class and section yet." })} onCheckIn={vi.fn()} />);
    expect(screen.getByRole("status")).toHaveTextContent(/not linked to a class/i);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("uses teacher wording", () => {
    render(<CheckInCard subject="teacher" today={today()} onCheckIn={vi.fn()} />);
    expect(screen.getByRole("button", { name: /check in now/i })).toBeInTheDocument();
  });
});

describe("attendance thresholds and messages", () => {
  it("classifies >=90 good, 75-90 watch, <75 risk", () => {
    expect([levelFor(95), levelFor(90), levelFor(89.9), levelFor(75), levelFor(74.9)]).toEqual(["good", "good", "watch", "watch", "risk"]);
  });

  it("tells a student below 75% how many present days they need", () => {
    // 6 attended of 10 = 60%; need n with (6+n)/(10+n) >= 0.75 -> n = 6
    expect(attendanceMessage({ percentage: 60, present: 6, late: 0, totalDays: 10 })).toBe("6 more present days in a row to reach 75%.");
  });

  it("tells a student above 75% how many days they can miss", () => {
    // 8 attended of 10 = 80%; spare = floor(8/0.75 - 10) = 0 -> right at threshold message
    expect(attendanceMessage({ percentage: 80, present: 8, late: 0, totalDays: 10 })).toMatch(/right at 75%/);
    expect(attendanceMessage({ percentage: 84.6, present: 11, late: 0, totalDays: 13 })).toMatch(/miss 1 more day/);
    expect(attendanceMessage({ percentage: 95, present: 19, late: 0, totalDays: 20 })).toMatch(/Excellent/);
    expect(attendanceMessage({ percentage: 0, present: 0, late: 0, totalDays: 0 })).toMatch(/No attendance recorded/);
  });
});

describe("AttendanceGauge and MonthHeatmap", () => {
  it("exposes the percentage to assistive tech", () => {
    render(<AttendanceGauge percentage={82.5} />);
    expect(screen.getByRole("img", { name: "Attendance: 82.5%" })).toBeInTheDocument();
  });

  it("marks recorded days and leaves others as no record", () => {
    render(<MonthHeatmap month="2026-03" today="2026-03-09" days={[{ date: "2026-03-02", status: "PRESENT" }, { date: "2026-03-03", status: "ABSENT" }]} />);
    const grid = screen.getByRole("grid", { name: "Attendance calendar" });
    expect(within(grid).getByLabelText("2 March: present")).toBeInTheDocument();
    expect(within(grid).getByLabelText("3 March: absent")).toBeInTheDocument();
    expect(within(grid).getByLabelText("4 March: no record")).toBeInTheDocument();
    expect(within(grid).getAllByRole("gridcell")).toHaveLength(31);
  });
});

const rows: StudentProgressRow[] = [
  { studentId: "s1", name: "Anaya Mehta", admissionNumber: "GF1", class: "Grade 6", section: "A", attendancePct: 62.5, avgExamPct: 35, assignmentsSubmitted: 1, assignmentsTotal: 4, lessonsCompleted: 2, riskLevel: "at_risk" },
  { studentId: "s2", name: "Kiara Reddy", admissionNumber: "GF2", class: "Grade 7", section: "B", attendancePct: 96, avgExamPct: null, assignmentsSubmitted: 3, assignmentsTotal: 3, lessonsCompleted: 0, riskLevel: "ok" },
];

describe("StudentProgressTable", () => {
  const props = { page: 1, pageSize: 10, total: 2, onPageChange: vi.fn(), onSortChange: vi.fn() };

  it("renders metrics, risk badges and blanks for missing data", () => {
    render(<StudentProgressTable rows={rows} onSelect={vi.fn()} {...props} />);
    expect(screen.getByText("62.5%")).toBeInTheDocument();
    expect(screen.getByText("1/4")).toBeInTheDocument();
    expect(screen.getAllByText("At risk")[0]).toHaveAttribute("data-risk", "at_risk");
    expect(screen.getByText("On track")).toBeInTheDocument();
    expect(screen.getByLabelText("No data")).toBeInTheDocument();
  });

  it("opens the student's detail from the name and the View action", async () => {
    const onSelect = vi.fn();
    render(<StudentProgressTable rows={rows} onSelect={onSelect} {...props} />);
    await userEvent.click(screen.getByRole("button", { name: /^Anaya Mehta/ }));
    await userEvent.click(screen.getByRole("button", { name: "View progress for Kiara Reddy" }));
    expect(onSelect.mock.calls).toEqual([["s1"], ["s2"]]);
  });

  it("shows an empty state with guidance", () => {
    render(<StudentProgressTable rows={[]} onSelect={vi.fn()} {...props} total={0} />);
    expect(screen.getByText("No students found")).toBeInTheDocument();
  });

  it("sorts when a sortable header is clicked", async () => {
    const onSortChange = vi.fn();
    render(<StudentProgressTable rows={rows} onSelect={vi.fn()} {...props} onSortChange={onSortChange} />);
    await userEvent.click(screen.getByRole("button", { name: /Attendance/ }));
    expect(onSortChange).toHaveBeenCalledWith(expect.objectContaining({ by: "attendancePct" }));
  });
});
