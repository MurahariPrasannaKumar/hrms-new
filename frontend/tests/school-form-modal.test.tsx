import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { SchoolFormModal } from "@/components/features/schools/SchoolFormModal";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
const create = vi.fn().mockResolvedValue({ id: "1" });
vi.mock("@/lib/api/admin", () => ({ adminSchoolApi: { create: (b: unknown) => create(b), update: vi.fn() } }));

const wrap = (ui: React.ReactElement) => render(<QueryClientProvider client={new QueryClient()}>{ui}</QueryClientProvider>);

describe("SchoolFormModal", () => {
  it("shows validation errors and does not submit an invalid form", async () => {
    create.mockClear();
    wrap(<SchoolFormModal open onOpenChange={() => {}} />);
    await userEvent.click(screen.getByRole("button", { name: "Save school" }));
    expect(await screen.findByText("Name must be at least 2 characters")).toBeInTheDocument();
    expect(create).not.toHaveBeenCalled();
  });

  it("submits a normalized payload for a valid form", async () => {
    create.mockClear();
    wrap(<SchoolFormModal open onOpenChange={() => {}} />);
    await userEvent.type(screen.getByLabelText("Name"), "Riverside");
    await userEvent.type(screen.getByLabelText("Code"), "RS1");
    await userEvent.click(screen.getByRole("button", { name: "Save school" }));
    await vi.waitFor(() => expect(create).toHaveBeenCalled());
    expect(create.mock.calls[0][0]).toMatchObject({ name: "Riverside", code: "RS1", email: null, status: "ACTIVE" });
  });
});
