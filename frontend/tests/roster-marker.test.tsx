import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { RosterMarker } from "@/components/features/attendance/RosterMarker";
import type { RosterStudent } from "@/lib/api/people";

const students: RosterStudent[] = [
  { id: "s1", firstName: "Anaya", lastName: "Mehta", admissionNumber: "A1", status: "PRESENT", remark: null },
  { id: "s2", firstName: "Kiara", lastName: "Reddy", admissionNumber: "A2", status: "EXCUSED", remark: null },
];

const group = (name: string) => screen.getByRole("group", { name: `Attendance for ${name}` });

describe("RosterMarker", () => {
  it("starts from the existing status of each student", () => {
    render(<RosterMarker students={students} onSave={vi.fn()} />);
    expect(group("Anaya Mehta").querySelector('[aria-pressed="true"]')).toHaveTextContent("Present");
    expect(group("Kiara Reddy").querySelector('[aria-pressed="true"]')).toHaveTextContent("Excused");
  });

  it("marks all absent then saves every student", async () => {
    const onSave = vi.fn();
    render(<RosterMarker students={students} onSave={onSave} />);
    await userEvent.click(screen.getByRole("button", { name: "Mark all absent" }));
    await userEvent.click(screen.getByRole("button", { name: "Save attendance" }));
    expect(onSave).toHaveBeenCalledWith([
      { studentId: "s1", status: "ABSENT" },
      { studentId: "s2", status: "ABSENT" },
    ]);
  });

  it("lets a single student be changed after a bulk action", async () => {
    const onSave = vi.fn();
    render(<RosterMarker students={students} onSave={onSave} />);
    await userEvent.click(screen.getByRole("button", { name: "Mark all present" }));
    const late = [...group("Kiara Reddy").querySelectorAll("button")].find((b) => b.textContent === "Late")!;
    await userEvent.click(late);
    await userEvent.click(screen.getByRole("button", { name: "Save attendance" }));
    expect(onSave).toHaveBeenCalledWith([
      { studentId: "s1", status: "PRESENT" },
      { studentId: "s2", status: "LATE" },
    ]);
  });

  it("shows an empty state and disables saving while pending", () => {
    const { rerender } = render(<RosterMarker students={[]} onSave={vi.fn()} />);
    expect(screen.getByText("No students in this section")).toBeInTheDocument();
    rerender(<RosterMarker students={students} saving onSave={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Saving…" })).toBeDisabled();
  });
});
