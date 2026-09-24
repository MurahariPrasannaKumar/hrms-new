import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { VBuddyPage } from "@/components/features/ai/VBuddyPage";
import { ApiError } from "@/lib/api/client";

const svc = vi.hoisted(() => ({
  suggestions: vi.fn(),
  conversations: vi.fn(),
  conversation: vi.fn(),
  chat: vi.fn(),
  removeConversation: vi.fn(),
}));
vi.mock("@/lib/api/learning-ai", () => ({ aiService: svc }));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

const renderPage = () =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <VBuddyPage />
    </QueryClientProvider>,
  );

beforeEach(() => {
  vi.clearAllMocks();
  svc.suggestions.mockResolvedValue(["Quiz me on fractions"]);
  svc.conversations.mockResolvedValue([{ id: "c1", title: "Old chat", updatedAt: "2026-01-01" }]);
});

describe("VBuddyPage", () => {
  it("shows suggestions and history", async () => {
    renderPage();
    expect(await screen.findByRole("button", { name: "Quiz me on fractions" })).toBeInTheDocument();
    expect(await screen.findByRole("button", { name: "Old chat" })).toBeInTheDocument();
  });

  it("sends a message and shows the reply, reusing the conversation id", async () => {
    svc.chat
      .mockResolvedValueOnce({ conversationId: "c9", title: "Hi", message: { id: "m1", role: "assistant", content: "Hello there!" } })
      .mockResolvedValueOnce({ conversationId: "c9", title: "Hi", message: { id: "m2", role: "assistant", content: "Second reply" } });
    renderPage();
    const input = await screen.findByLabelText("Message V Buddy");
    await userEvent.type(input, "Hi{Enter}");
    expect(await screen.findByText(/Hello there!/)).toBeInTheDocument();
    expect(svc.chat).toHaveBeenCalledWith("Hi", undefined);
    await userEvent.type(input, "More{Enter}");
    await waitFor(() => expect(svc.chat).toHaveBeenCalledWith("More", "c9"));
    expect(await screen.findByText(/Second reply/)).toBeInTheDocument();
  });

  it("shows a friendly state when the module is disabled for the school", async () => {
    svc.suggestions.mockRejectedValue(new ApiError(403, "MODULE_DISABLED", "disabled"));
    renderPage();
    expect(await screen.findByText(/not enabled for your school/i)).toBeInTheDocument();
  });
});
