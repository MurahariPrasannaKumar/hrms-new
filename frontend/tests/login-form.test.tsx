import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { LoginForm } from "@/components/forms/LoginForm";
import { ApiError } from "@/lib/api/client";

describe("LoginForm", () => {
  it("shows validation errors and does not submit empty values", async () => {
    const onLogin = vi.fn();
    render(<LoginForm onLogin={onLogin} />);
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));
    expect(await screen.findByText("Email or username is required")).toBeInTheDocument();
    expect(screen.getByText("Password is required")).toBeInTheDocument();
    expect(onLogin).not.toHaveBeenCalled();
  });

  it("submits valid credentials", async () => {
    const onLogin = vi.fn().mockResolvedValue(undefined);
    render(<LoginForm onLogin={onLogin} />);
    await userEvent.type(screen.getByLabelText("Email or username"), "admin@schoolone.com");
    await userEvent.type(screen.getByLabelText("Password"), "secret");
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));
    await waitFor(() => expect(onLogin).toHaveBeenCalledWith({ identifier: "admin@schoolone.com", password: "secret" }));
  });

  it("displays server errors", async () => {
    const onLogin = vi.fn().mockRejectedValue(new ApiError(401, "UNAUTHORIZED", "Invalid credentials"));
    render(<LoginForm onLogin={onLogin} />);
    await userEvent.type(screen.getByLabelText("Email or username"), "x@y.z");
    await userEvent.type(screen.getByLabelText("Password"), "bad");
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Invalid credentials");
  });

});
