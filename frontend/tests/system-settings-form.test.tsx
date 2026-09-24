import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { SystemSettingsForm } from "@/components/features/settings/SystemSettingsForm";
import { settingsApi } from "@/lib/api/settings";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/lib/api/settings", () => ({
  settingsApi: {
    getSystem: vi.fn().mockResolvedValue({ platformName: "EduSphere", supportEmail: "", defaultLocale: "en", maintenanceMode: false }),
    saveSystem: vi.fn().mockImplementation(async (v) => v),
  },
}));

const renderForm = () =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <SystemSettingsForm />
    </QueryClientProvider>,
  );

describe("SystemSettingsForm", () => {
  it("loads values from the API and saves changes back", async () => {
    renderForm();
    const name = await screen.findByLabelText("Platform name");
    expect(name).toHaveValue("EduSphere");
    await userEvent.clear(name);
    await userEvent.type(name, "Acme Learning");
    await userEvent.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() => expect(settingsApi.saveSystem).toHaveBeenCalled());
    expect(vi.mocked(settingsApi.saveSystem).mock.calls[0][0]).toEqual({
      platformName: "Acme Learning", supportEmail: "", defaultLocale: "en", maintenanceMode: false,
    });
  });

  it("blocks invalid input", async () => {
    renderForm();
    const name = await screen.findByLabelText("Platform name");
    await userEvent.clear(name);
    await userEvent.type(name, "x");
    await userEvent.click(screen.getByRole("button", { name: "Save changes" }));
    expect(await screen.findByText("At least 2 characters")).toBeInTheDocument();
  });
});
