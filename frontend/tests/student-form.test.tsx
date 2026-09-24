import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { StudentForm } from "@/components/features/students/StudentForm";

const classes = [
  { id: "c6", name: "Grade 6", sections: [{ id: "c6a", name: "A" }, { id: "c6b", name: "B" }] },
  { id: "c7", name: "Grade 7", sections: [{ id: "c7a", name: "A" }] },
];

const setup = (props: Partial<Parameters<typeof StudentForm>[0]> = {}) => {
  const onSubmit = vi.fn();
  render(<StudentForm classes={classes} parents={[{ id: "p1", name: "Krish Mehta" }]} onSubmit={onSubmit} onCancel={vi.fn()} {...props} />);
  return onSubmit;
};

describe("StudentForm", () => {
  it("shows validation errors and does not submit an empty form", async () => {
    const onSubmit = setup();
    await userEvent.click(screen.getByRole("button", { name: "Add student" }));
    expect(await screen.findByText("First name is required")).toBeInTheDocument();
    expect(screen.getByText("Admission number is required")).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("rejects an invalid email", async () => {
    setup();
    await userEvent.type(screen.getByLabelText("Email"), "nope");
    await userEvent.click(screen.getByRole("button", { name: "Add student" }));
    expect(await screen.findByText("Enter a valid email")).toBeInTheDocument();
  });

  it("only offers sections of the selected class and submits clean values", async () => {
    const onSubmit = setup();
    const section = screen.getByLabelText("Section");
    expect(section).toBeDisabled();
    await userEvent.type(screen.getByLabelText("First name"), "Dev");
    await userEvent.type(screen.getByLabelText("Last name"), "Sharma");
    await userEvent.type(screen.getByLabelText("Admission number"), "GF1");
    await userEvent.selectOptions(screen.getByLabelText("Class"), "c6");
    expect(section).toBeEnabled();
    expect([...section.querySelectorAll("option")].map((o) => o.textContent)).toEqual(["Unassigned", "A", "B"]);
    await userEvent.selectOptions(section, "c6b");
    await userEvent.click(screen.getByRole("button", { name: "Add student" }));
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit.mock.calls[0][0]).toMatchObject({
      firstName: "Dev", lastName: "Sharma", admissionNumber: "GF1", classId: "c6", sectionId: "c6b", status: "ACTIVE", email: undefined, parentId: undefined,
    });
  });

  it("sends null to clear class links when editing", async () => {
    const onSubmit = setup({ initial: { id: "s1", admissionNumber: "GF1", firstName: "Dev", lastName: "Sharma", classId: "c6", sectionId: "c6a", status: "ACTIVE" } });
    await userEvent.selectOptions(screen.getByLabelText("Class"), "");
    await userEvent.click(screen.getByRole("button", { name: "Save changes" }));
    expect(onSubmit.mock.calls[0][0]).toMatchObject({ classId: null, sectionId: null });
  });
});
