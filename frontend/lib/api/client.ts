import axios, { AxiosError, type AxiosRequestConfig, type InternalAxiosRequestConfig } from "axios";

export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";

export interface PageMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  [key: string]: unknown;
}
export interface Paged<T> {
  items: T[];
  meta: PageMeta;
}
export interface ListParams {
  page?: number;
  pageSize?: number;
  search?: string;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
  [key: string]: string | number | boolean | undefined;
}

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details: unknown[] = [],
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export function toApiError(err: unknown): ApiError {
  if (err instanceof ApiError) return err;
  if (axios.isAxiosError(err)) {
    const body = err.response?.data as
      | { error?: { code?: string; message?: string; details?: unknown[] } }
      | undefined;
    if (body?.error) {
      return new ApiError(err.response?.status ?? 0, body.error.code ?? "ERROR", body.error.message ?? "Request failed", body.error.details ?? []);
    }
    if (!err.response) return new ApiError(0, "NETWORK_ERROR", "Cannot reach the server. Check your connection.");
    return new ApiError(err.response.status, "HTTP_ERROR", err.message);
  }
  return new ApiError(0, "UNKNOWN", err instanceof Error ? err.message : "Something went wrong");
}

let accessToken: string | null = null;
export const setAccessToken = (t: string | null) => {
  accessToken = t;
};
export const getAccessToken = () => accessToken;

let onAuthFailure: (() => void) | null = null;
export const setAuthFailureHandler = (fn: (() => void) | null) => {
  onAuthFailure = fn;
};

export const http = axios.create({ baseURL: API_URL, withCredentials: true });

http.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  if (accessToken) config.headers.set("Authorization", `Bearer ${accessToken}`);
  return config;
});

export interface RefreshResult {
  accessToken: string;
  refreshToken: string;
  user: unknown;
}

let refreshing: Promise<RefreshResult> | null = null;
/** Single-flight: concurrent 401s share one refresh call. */
export function refreshAccessToken(): Promise<RefreshResult> {
  if (!refreshing) {
    refreshing = axios
      .post(`${API_URL}/auth/refresh`, {}, { withCredentials: true })
      .then((r) => {
        const data = r.data.data as RefreshResult;
        accessToken = data.accessToken;
        return data;
      })
      .finally(() => {
        refreshing = null;
      });
  }
  return refreshing;
}

const NO_REFRESH = ["/auth/login", "/auth/refresh", "/auth/logout"];

http.interceptors.response.use(
  (r) => r,
  async (error: AxiosError) => {
    const original = error.config as (AxiosRequestConfig & { _retry?: boolean }) | undefined;
    const url = original?.url ?? "";
    if (error.response?.status === 401 && original && !original._retry && !NO_REFRESH.some((p) => url.includes(p))) {
      original._retry = true;
      try {
        await refreshAccessToken();
        return http(original);
      } catch {
        accessToken = null;
        onAuthFailure?.();
      }
    }
    return Promise.reject(toApiError(error));
  },
);

export async function unwrap<T>(req: Promise<{ data: { data: T } }>): Promise<T> {
  return (await req).data.data;
}

export async function unwrapPage<T>(req: Promise<{ data: { data: T[]; meta?: PageMeta } }>): Promise<Paged<T>> {
  const { data } = await req;
  const items = data.data ?? [];
  return { items, meta: data.meta ?? { page: 1, pageSize: items.length, total: items.length, totalPages: 1 } };
}

export const cleanParams = (p?: ListParams) =>
  p ? Object.fromEntries(Object.entries(p).filter(([, v]) => v !== undefined && v !== "")) : undefined;
