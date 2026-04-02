"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
} from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { authApi } from "@/hooks/auth/auth.api";
import { useRouter, usePathname } from "next/navigation";
import { AUTH_TOKEN_EVENT } from "@/lib/token";

type AuthState = {
  isReady: boolean;
  isAuthenticated: boolean;
  user: Awaited<ReturnType<typeof authApi.getProfile>>["user"] | null;
};

const AuthContext = createContext<AuthState>({
  isReady: false,
  isAuthenticated: false,
  user: null,
});

const PUBLIC_ROUTES = [
  "/login",
  "/register",
  "/forgot-password",
  "/verify-email",
  "/setup-2fa",
];

function stripLocale(pathname: string) {
  return pathname.replace(/^\/(en|kh|km)(?=\/|$)/, "");
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname() ?? "";
  const queryClient = useQueryClient();
  const normalizedPath = stripLocale(pathname) || "/";
  const isPublicPage = PUBLIC_ROUTES.some((route) =>
    normalizedPath.startsWith(route)
  );

  const redirectToLogin = useCallback(() => {
    if (!pathname?.includes("/dashboard")) return;
    const locale = pathname.split("/").filter(Boolean)[0];
    const safeLocale = locale === "en" || locale === "kh" ? locale : "en";
    router.replace(`/${safeLocale}/login?redirect=${encodeURIComponent(pathname)}`);
  }, [pathname, router]);

  const meQuery = useQuery({
    queryKey: ["auth", "me"],
    queryFn: async () => {
      try {
        return await authApi.getProfile();
      } catch (err: unknown) {
        const status =
          (err as { status?: number; response?: { status?: number } })?.status ??
          (err as { status?: number; response?: { status?: number } })?.response?.status;
        if (status === 401) return null;
        throw err;
      }
    },
    retry: false,
    refetchOnWindowFocus: false,
    staleTime: 1000 * 60 * 5,
  });

  const user = meQuery.data?.user ?? null;
  const isAuthenticated = !!user;
  const isReady = !meQuery.isLoading;

  useEffect(() => {
    if (isPublicPage || !isReady || isAuthenticated) return;
    redirectToLogin();
  }, [isAuthenticated, isPublicPage, isReady, redirectToLogin]);

  useEffect(() => {
    const onTokenChange = (event: Event) => {
      const token = (event as CustomEvent<string | null>).detail ?? null;

      if (!token) {
        queryClient.setQueryData(["auth", "me"], null);
        redirectToLogin();
        return;
      }

      queryClient.invalidateQueries({ queryKey: ["auth", "me"] });
    };

    window.addEventListener(AUTH_TOKEN_EVENT, onTokenChange as EventListener);
    return () => window.removeEventListener(AUTH_TOKEN_EVENT, onTokenChange as EventListener);
  }, [queryClient, redirectToLogin]);

  const value = useMemo(
    () => ({
      isReady,
      isAuthenticated,
      user,
    }),
    [isReady, isAuthenticated, user]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuthState() {
  return useContext(AuthContext);
}
