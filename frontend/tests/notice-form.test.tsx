import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { NoticeForm, noticeSchema, toNoticeInput } from "@/components/features/notices/NoticeForm";

let mockRole = "SCHOOL_ADMIN";
vi.mock("@/lib/auth", () => ({ useAuth: () => ({ user: { role: mockRole } }) }));
vi.mock("@/lib/api/admin", () => ({ adminSchoolApi: { list: vi.fn().mockResolvedValue({ items: [{ id: "s1", name: "Test School" }], meta: {} }) } }));
vi.mock("@/lib/api/people", () => ({ academicsApi: { classes: { list: vi.fn().mockResolvedValue({ items: [], meta: {} }) } } }));
vi.mock("@/lib/api/learning-ai", () => ({ classesLookup: vi.fn().mockResolvedValue([{ id: "cls1", name: "Grade 6", sections: [] }]) }));

const renderForm = (onSubmit = vi.fn()) => {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <NoticeForm onSubmit={onSubmit} />
    </QueryClientProvider>,
  );
  return onSubmit;
};

describe("NoticeForm", () => {
  it("blocks submission and shows errors when required fields are empty", async () => {
    const onSubmit = renderForm();
    await userEvent.click(screen.getByRole("button", { name: /Publish and notify everyone|Schedule notice/ }));
    expect(await screen.findByText("Title is required")).toBeInTheDocument();
    expect(screen.getByText("Message is required")).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("submits a publish-now notice with role and class targets", async () => {
    const onSubmit = renderForm();
    await userEvent.type(screen.getByLabelText("Title"), "Sports day");
    await userEvent.type(screen.getByLabelText("Message"), "Bring your kit.");
    await userEvent.click(screen.getByLabelText("Students"));
    await userEvent.click(await screen.findByLabelText("Grade 6"));
    await userEvent.click(screen.getByRole("button", { name: /Publish and notify everyone|Schedule notice/ }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    expect(onSubmit.mock.calls[0][0]).toMatchObject({
      title: "Sports day", type: "GENERAL", publish: true, targets: [{ roleName: "STUDENT" }, { classId: "cls1" }],
    });
  });

  it("requires a publish time when scheduling", async () => {
    const onSubmit = renderForm();
    await userEvent.type(screen.getByLabelText("Title"), "Later");
    await userEvent.type(screen.getByLabelText("Message"), "Body");
    await userEvent.selectOptions(screen.getByLabelText("Publishing"), "schedule");
    await userEvent.click(screen.getByRole("button", { name: /Publish and notify everyone|Schedule notice/ }));
    expect(await screen.findByText("Pick a publish date and time")).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });
});

describe("NoticeForm for platform admins", () => {
  it("must pick a school and sends it with the notice", async () => {
    mockRole = "SUPER_ADMIN";
    const onSubmit = renderForm();
    await userEvent.type(screen.getByLabelText("Title"), "Closed");
    await userEvent.type(screen.getByLabelText("Message"), "School is closed.");
    await userEvent.click(screen.getByRole("button", { name: /Publish and notify everyone/ }));
    expect(await screen.findByText("Choose the school this notice is for")).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
    await userEvent.selectOptions(await screen.findByLabelText("School"), "s1");
    await userEvent.click(screen.getByRole("button", { name: /Publish and notify everyone/ }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    expect(onSubmit.mock.calls[0][0]).toMatchObject({ schoolId: "s1", publish: true });
    mockRole = "SCHOOL_ADMIN";
  });
});

describe("noticeSchema", () => {
  it("rejects expiry before publish time and maps drafts to publish:false", () => {
    const base = { title: "t", body: "b", type: "GENERAL" as const, roles: [], classIds: [] };
    expect(noticeSchema.safeParse({ ...base, mode: "schedule", publishAt: "2030-01-02T10:00", expiresAt: "2030-01-01T10:00" }).success).toBe(false);
    expect(toNoticeInput({ ...base, mode: "draft" }).publish).toBe(false);
  });
});
