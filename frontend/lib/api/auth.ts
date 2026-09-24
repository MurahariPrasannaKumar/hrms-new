import type { AuthUser, LoginResult } from "@/lib/auth/types";
import { http, unwrap } from "./client";

export const authApi = {
  login: (identifier: string, password: string) => unwrap<LoginResult>(http.post("/auth/login", { identifier, password })),
  logout: () => unwrap<null>(http.post("/auth/logout")),
  me: () => unwrap<AuthUser>(http.get("/auth/me")),
  forgotPassword: (email: string) => unwrap<null>(http.post("/auth/forgot-password", { email })),
  resetPassword: (token: string, password: string) => unwrap<null>(http.post("/auth/reset-password", { token, password })),
  changePassword: (currentPassword: string, newPassword: string) =>
    unwrap<null>(http.post("/auth/change-password", { currentPassword, newPassword })),
};
