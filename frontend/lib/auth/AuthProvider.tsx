"use client";

import { useQueryClient } from "@tanstack/react-query";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { authApi } from "@/lib/api/auth";
import { refreshAccessToken, setAccessToken, setAuthFailureHandler } from "@/lib/api/client";
import { hasPermission as checkPermission, hasRole as checkRole } from "@/lib/permissions";
import type { AuthUser, LoginResult, Role } from "./types";

export type SessionStatus = "loading" | "authenticated" | "unauthenticated";

export interface AuthContextValue {
  user: AuthUser | null;
  role: Role | null;
  permissions: string[];
  school: AuthUser["school"];
  session: { status: SessionStatus };
  login: (identifier: string, password: string) => Promise<LoginResult>;
  logout: () => Promise<void>;
  refreshSession: () => Promise<AuthUser | null>;
  hasPermission: (key: string) => boolean;
  hasRole: (...roles: Role[]) => boolean;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [status, setStatus] = useState<SessionStatus>("loading");

  const clear = useCallback(() => {
    setAccessToken(null);
    setUser(null);
    setStatus("unauthenticated");
    qc.clear();
  }, [qc]);

  const refreshSession = useCallback(async () => {
    try {
      const res = await refreshAccessToken();
      const u = res.user as AuthUser;
      setUser(u);
      setStatus("authenticated");
      return u;
    } catch {
      setAccessToken(null);
      setUser(null);
      setStatus("unauthenticated");
      return null;
    }
  }, []);

  useEffect(() => {
    setAuthFailureHandler(clear);
    refreshAccessToken()
      .then((res) => {
        setUser(res.user as AuthUser);
        setStatus("authenticated");
      })
      .catch(() => setStatus("unauthenticated"));
    return () => setAuthFailureHandler(null);
  }, [clear]);

  const login = useCallback(async (identifier: string, password: string) => {
    const res = await authApi.login(identifier, password);
    setAccessToken(res.accessToken);
    setUser(res.user);
    setStatus("authenticated");
    return res;
  }, []);

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } finally {
      clear();
    }
  }, [clear]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      role: user?.role ?? null,
      permissions: user?.permissions ?? [],
      school: user?.school ?? null,
      session: { status },
      login,
      logout,
      refreshSession,
      hasPermission: (k) => checkPermission(user, k),
      hasRole: (...r) => checkRole(user, ...r),
    }),
    [user, status, login, logout, refreshSession],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
