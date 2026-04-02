import axios, { AxiosError, InternalAxiosRequestConfig } from "axios";
import {
  clearTokens,
  getAccessToken,
  hydrateAccessTokenFromStorage,
  setAccessToken,
  setRefreshToken,
} from "@/lib/token";

if (typeof window !== "undefined") {
  hydrateAccessTokenFromStorage();
}

export class ApiError extends Error {
  status: number;
  data?: any;

  constructor(message: string, status: number, data?: any) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.data = data;
  }
}

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL,
  withCredentials: true, // ✅ send refresh cookie
  headers: { "Content-Type": "application/json" },
});

/** Attach access token */
api.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token) {
    config.headers = config.headers ?? {};
    (config.headers as any).Authorization = `Bearer ${token}`;
  }

  // If sending FormData, remove Content-Type so browser sets it correctly with boundary
  if (config.data instanceof FormData && config.headers) {
    if (typeof (config.headers as any).delete === "function") {
      (config.headers as any).delete("Content-Type");
    } else {
      delete (config.headers as Record<string, unknown>)["Content-Type"];
    }
  }

  return config;
});

const REFRESH_PATH = "/auth/refresh";
const SKIP_REFRESH_PATHS = new Set([
  "/auth/logout",
  "/auth/logoutall",
  REFRESH_PATH,
]);
const PUBLIC_AUTH_PATHS = [
  "/login",
  "/register",
  "/forgot-password",
  "/verify-email",
  "/setup-2fa",
];

function pathOnly(url?: string) {
  const raw = url ?? "";
  if (!raw) return "";

  try {
    return new URL(raw, "http://localhost").pathname;
  } catch {
    return raw.split("?")[0];
  }
}

function stripLocale(pathname: string) {
  return pathname.replace(/^\/(en|kh|km)(?=\/|$)/, "");
}

function redirectToLogin() {
  if (typeof window === "undefined") return;

  const pathname = window.location.pathname || "/";
  const normalizedPath = stripLocale(pathname);
  const isPublicAuthPage = PUBLIC_AUTH_PATHS.some((route) =>
    normalizedPath.startsWith(route)
  );

  if (isPublicAuthPage) return;

  const locale = pathname.split("/").filter(Boolean)[0];
  const safeLocale = locale === "en" || locale === "kh" ? locale : "en";
  const redirect = `${pathname}${window.location.search || ""}`;
  window.location.replace(
    `/${safeLocale}/login?redirect=${encodeURIComponent(redirect)}`
  );
}

let isRefreshing = false;
let waiters: Array<(token: string | null) => void> = [];

function notify(token: string | null) {
  waiters.forEach((cb) => cb(token));
  waiters = [];
}

function pickToken(
  payload: unknown,
  key: "accessToken" | "refreshToken"
): string | null {
  const data = payload as {
    accessToken?: string;
    refreshToken?: string;
    token?: string;
    tokens?: { accessToken?: string; refreshToken?: string };
    data?: {
      accessToken?: string;
      refreshToken?: string;
      token?: string;
      tokens?: { accessToken?: string; refreshToken?: string };
      data?: { accessToken?: string; refreshToken?: string; token?: string };
    };
  };

  if (key === "accessToken") {
    return (
      data?.accessToken ??
      data?.token ??
      data?.tokens?.accessToken ??
      data?.data?.accessToken ??
      data?.data?.token ??
      data?.data?.tokens?.accessToken ??
      data?.data?.data?.accessToken ??
      data?.data?.data?.token ??
      null
    );
  }

  return (
    data?.refreshToken ??
    data?.tokens?.refreshToken ??
    data?.data?.refreshToken ??
    data?.data?.tokens?.refreshToken ??
    data?.data?.data?.refreshToken ??
    null
  );
}

api.interceptors.response.use(
  (res) => res,
  async (error: AxiosError<any>) => {
    const original = error.config as
      | (InternalAxiosRequestConfig & { _retry?: boolean })
      | undefined;

    if (!error.response || !original) throw error;

    const status = error.response.status;
    const p = pathOnly(original.url);

    // Never refresh on these
    if (SKIP_REFRESH_PATHS.has(p)) throw error;

    // Only refresh on 401 once
    if (status !== 401 || original._retry) throw error;

    original._retry = true;

    // If refresh is running, wait
    if (isRefreshing) {
      const newToken = await new Promise<string | null>((resolve) =>
        waiters.push(resolve)
      );
      if (!newToken) throw error;
      (original.headers as any).Authorization = `Bearer ${newToken}`;
      return api(original);
    }

    isRefreshing = true;

    try {
      // ✅ Refresh should rely on HttpOnly cookie + withCredentials
      // Sending refreshToken in body can cause backend 400 on strict DTO validation.
      const refreshRes = await api.post(REFRESH_PATH, {});

      const newToken = pickToken(refreshRes?.data, "accessToken");
      const newRefreshToken = pickToken(refreshRes?.data, "refreshToken");

      setAccessToken(newToken);
      if (newRefreshToken) setRefreshToken(newRefreshToken);
      notify(newToken);

      if (!newToken) throw error;

      (original.headers as any).Authorization = `Bearer ${newToken}`;
      return api(original);
    } catch (refreshErr) {
      const refreshStatus =
        (refreshErr as AxiosError<unknown>)?.response?.status ?? 0;
      const shouldLogout = refreshStatus >= 400 && refreshStatus < 500;

      if (shouldLogout) {
        clearTokens();
        notify(null);
        redirectToLogin();
        // Keep downstream auth handling consistent (treat as original 401 flow).
        throw error;
      } else {
        notify(getAccessToken());
      }
      throw refreshErr;
    } finally {
      isRefreshing = false;
    }
  }
);

export default api;
