"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
} from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter, usePathname } from "next/navigation";
import { AUTH_TOKEN_EVENT } from "@/lib/token";
import { useAuth } from "./useAuth";
import type { UserPayload } from "./auth.schemas";

type AuthState = {
  isReady: boolean;
  isAuthenticated: boolean;
  user: UserPayload | null;
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
  const { user, isLoading } = useAuth();
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
  const isAuthenticated = !!user;
  const isReady = !isLoading;

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
