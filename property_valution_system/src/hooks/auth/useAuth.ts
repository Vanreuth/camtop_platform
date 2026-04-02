"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@/lib/navigation";
import { authApi } from "./auth.api";
import { auditApi } from "@/hooks/audit/audit.api";
import { toast } from "sonner";
import { usePathname } from "next/navigation";
import type {
  Preferences,
  PreferencesPayload,
  UpdateProfileInput,
  ChangePasswordInput,
  Role,
} from "./auth.schemas";

import { getApiErrorMessage} from "@/utils/helpers";
import { clearTokens } from "@/lib/token";

import {
  hasPermission,
  hasAnyPermission,
  hasAllPermissions,
  hasRole,
  hasAnyRole,
  hasAllRoles,
  hasHierarchyLevel,
  getHighestRole,
  canAccess,
  isSuperAdmin,
  isPropertyManager,
  isRoleActive,
} from "./auth.helpers";
import { useMemo } from "react";



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

const defaultPreferences: Preferences = {
  theme: "light",
  language: "en",
  timezone: "Asia/Phnom_Penh",
  accentColor: "blue",
  borderRadius: "medium",
  fontFamily: "inter",
  fontSize: "medium",
  themePreset: "default",
  themeColor: "default",
};

const normalizeLanguage = (language?: string | null): Preferences["language"] => {
  if (language === "kh" || language === "km") return "kh";
  return "en";
};

const normalizePreferences = (
  preferences?: PreferencesPayload | null
): Preferences => {
  const normalized: Preferences = { ...defaultPreferences };
  if (!preferences) return normalized;

  (Object.keys(preferences) as (keyof PreferencesPayload)[]).forEach((key) => {
    const value = preferences[key];
    if (value === null || value === undefined) return;

    if (key === "language") {
      normalized.language = normalizeLanguage(String(value));
      return;
    }

    (normalized as any)[key] = value;
  });

  return normalized;
};

export function useAuth() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const pathname = usePathname() ?? "";
  const normalizedPath = stripLocale(pathname) || "/";
  const isPublicPage = PUBLIC_ROUTES.some((route) =>
    normalizedPath.startsWith(route)
  );
  // -----------------------
  // ME query (source of truth)
  // -----------------------
  const meQuery = useQuery({
    queryKey: ["auth", "me"],
    queryFn: async () => {
      try {
        return await authApi.getProfile();
      } catch (err: any) {
        // If unauthorized, treat as logged out (do not toast)
        const status = err?.status ?? err?.response?.status;
        if (status === 401) return null;
        throw err;
      }
    },
    enabled: !isPublicPage,
    retry: false,
    refetchOnWindowFocus: false,
    staleTime: 1000 * 60 * 5,
  });
  
  const data = meQuery.data;
  const user = data?.user ?? null;
  const roles: Role[] = data?.roles ?? [];
  const permissions: string[] = data?.permissions ?? [];
  const preferences = normalizePreferences(data?.preferences ?? null);

  const invalidateMe = async () => {
    await queryClient.invalidateQueries({ queryKey: ["auth", "me"] });
  };

  const tryLogLoginSession = async () => {
    try {
      await auditApi.logLoginSession();
    } catch {
      // Non-blocking: login should not fail if audit endpoint is unavailable/forbidden.
    }
  };

 // Register
 const register = useMutation({
  mutationFn: authApi.register,
});

  // Login
  const login = useMutation({
    mutationFn: authApi.login,
    onSuccess: async () => {
      await invalidateMe();
      await tryLogLoginSession();
    },
  });

  // Google Auth
  const googleAuth = useMutation({
    mutationFn: authApi.googleAuth,
    onSuccess: async () => {
      toast.success("Signed in with Google");
      await invalidateMe();
      await tryLogLoginSession();
      router.push("/dashboard");
    },
    onError: (err: any) => toast.error(getApiErrorMessage(err, "Google sign-in failed")),
  });

  // Logout
  const logout = useMutation({
    mutationFn: authApi.logout,
    onSuccess: () => {
      clearTokens();
      queryClient.removeQueries({ queryKey: ["auth", "me"] });
      window.location.href = "/login";
    },
    onError: (err: any) => toast.error(getApiErrorMessage(err, "Logout failed")),
  });
   
  // Update Profile
  const updateProfile = useMutation({
    mutationFn: (input: Partial<UpdateProfileInput>) => authApi.updateProfile(input),
    onSuccess: async () => {
      toast.success("Profile updated");
      await invalidateMe();
    },
    onError: (err: any) => toast.error(getApiErrorMessage(err, "Update profile failed")),
  });

  // Update Preferences
  const updatePreferences = useMutation({
    mutationFn: (prefs: PreferencesPayload) => authApi.updatePreferences(prefs),
    onSuccess: async () => {
      toast.success("Preferences updated");
      await invalidateMe();
    },
    onError: (err: any) => toast.error(getApiErrorMessage(err, "Update preferences failed")),
  });

  // Change Password
  const changePassword = useMutation({
    mutationFn: ({ userId, passwordData }: { userId: number; passwordData: ChangePasswordInput }) =>
      authApi.changePassword(userId, passwordData),
    onSuccess: () => toast.success("Password changed successfully"),
    onError: (err: any) => toast.error(getApiErrorMessage(err, "Password change failed")),
  });

  const resendVerification = useMutation({
    mutationFn: (email: string) => authApi.resendVerification(email),
    onSuccess: (res) => toast.success(res.message || "Verification email resent"),
    onError: (err: any) => toast.error(getApiErrorMessage(err, "Resend failed")),
  });

  const access = useMemo(() => ({
    hasPermission: (p: string) => hasPermission(permissions, p),
    hasAnyPermission: (ps: string[]) => hasAnyPermission(permissions, ps),
    hasAllPermissions: (ps: string[]) => hasAllPermissions(permissions, ps),
    hasRole: (code: string) => hasRole(roles, code),
    hasAnyRole: (codes: string[]) => hasAnyRole(roles, codes),
    hasAllRoles: (codes: string[]) => hasAllRoles(roles, codes),
    hasHierarchyLevel: (max: number) => hasHierarchyLevel(roles, max),
    highestRole: getHighestRole(roles),
    canAccessAny: (maxHierarchyLevel: number, requiredPermissions: string[]) =>
      canAccess({ roles, permissions, maxHierarchyLevel, requiredPermissions, requireAll: false }),
    canAccessAll: (maxHierarchyLevel: number, requiredPermissions: string[]) =>
      canAccess({ roles, permissions, maxHierarchyLevel, requiredPermissions, requireAll: true }),
    isSuperAdmin: () => isSuperAdmin(roles),
    isPropertyManager: () => isPropertyManager(roles),
    isRoleActive: (role: Role | null | undefined) => isRoleActive(role),
  }), [permissions, roles]); // Only re-create if permissions/roles change

  return {
    user,
    roles,
    permissions,
    preferences,
    isAuthenticated: !!user,
    
    // Query state
    isLoading: meQuery.isLoading,
    isError: meQuery.isError,
    error: meQuery.error,
    refetchMe: meQuery.refetch,

    // Actions (Mutations are stable, no memo needed)
    register: register.mutateAsync,
    login: login.mutateAsync,
    loginWithGoogle: googleAuth.mutateAsync,
    logout: logout.mutateAsync,
    updateProfile: updateProfile.mutateAsync,
    updatePreferences: updatePreferences.mutateAsync,
    changePassword: changePassword.mutateAsync,
    resendVerification: resendVerification.mutateAsync,

    // Mutation states
    isRegistering: register.isPending,
    isLoggingIn: login.isPending,
    isGoogleAuthing: googleAuth.isPending,
    isLoggingOut: logout.isPending,
    isUpdatingProfile: updateProfile.isPending,
    isUpdatingPreferences: updatePreferences.isPending,
    isChangingPassword: changePassword.isPending,
    isResendingVerification: resendVerification.isPending,
    
    // Spread access helpers
    ...access,
  };
}
