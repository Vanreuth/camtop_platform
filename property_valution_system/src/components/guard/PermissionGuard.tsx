"use client";

import React, { useEffect } from "react";
import { useAuth } from "@/hooks/auth/useAuth";
import { useRouter } from "next/navigation";
import { Loader2, ArrowLeft, Home, Mail, Phone, TriangleAlertIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

interface PermissionGuardProps {
  // permissions
  permission?: string;
  permissions?: string[];
  requireAll?: boolean;

  // roles
  role?: string;
  roles?: string[];

  // hierarchy
  hierarchyLevel?: number;

  // backend-aligned combined (authorize / authorizeAny)
  maxHierarchyLevel?: number;
  requiredPermissions?: string[];
  requireAllPermissions?: boolean;

  // ui
  fallback?: React.ReactNode;
  redirectTo?: string;
  children: React.ReactNode;
  errorMessage?: string;

  // ✅ Support contact (optional override)
  supportEmail?: string;
  supportPhone?: string;
}

const DEFAULT_SUPPORT_EMAIL = "support@camtopproperty.site";
// Optional phone; set if you have
const DEFAULT_SUPPORT_PHONE = "";

export const PermissionGuard: React.FC<PermissionGuardProps> = ({
  permission,
  permissions,
  requireAll = false,

  role,
  roles,

  hierarchyLevel,

  maxHierarchyLevel,
  requiredPermissions,
  requireAllPermissions = true,

  fallback,
  redirectTo,
  errorMessage,
  children,

  supportEmail = DEFAULT_SUPPORT_EMAIL,
  supportPhone = DEFAULT_SUPPORT_PHONE,
}) => {
  const {
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    hasRole,
    hasAnyRole,
    hasHierarchyLevel,
    canAccessAll,
    canAccessAny,
    isLoading,
    isAuthenticated,
  } = useAuth();

  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !isAuthenticated && redirectTo) {
      router.push(redirectTo);
    }
  }, [isLoading, isAuthenticated, redirectTo, router]);

  // --------------------
  // Loading UI
  // --------------------
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-10 h-10 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Checking access…</p>
        </div>
      </div>
    );
  }

  // If not authenticated: either redirecting or intentionally hidden
  if (!isAuthenticated) return null;

  const hasAnyRule =
    !!permission ||
    !!permissions?.length ||
    !!role ||
    !!roles?.length ||
    hierarchyLevel !== undefined ||
    (maxHierarchyLevel !== undefined && !!requiredPermissions?.length);

  const hasAccess = (() => {
    // No rules => allow access
    if (!hasAnyRule) return true;

    // 1) Combined check (backend aligned)
    if (maxHierarchyLevel !== undefined && requiredPermissions?.length) {
      return requireAllPermissions
        ? canAccessAll(maxHierarchyLevel, requiredPermissions)
        : canAccessAny(maxHierarchyLevel, requiredPermissions);
    }

    // 2) Hierarchy only
    if (hierarchyLevel !== undefined) {
      return hasHierarchyLevel(hierarchyLevel);
    }

    // 3) Permissions only
    if (permission) return hasPermission(permission);
    if (permissions?.length) {
      return requireAll
        ? hasAllPermissions(permissions)
        : hasAnyPermission(permissions);
    }

    // 4) Roles only
    if (role) return hasRole(role);
    if (roles?.length) return hasAnyRole(roles);

    return false;
  })();

  // No rules => allow access
  if (!hasAnyRule) return <>{children}</>;

  // --------------------
  // Denied UI (better UX)
  // --------------------
  if (!hasAccess) {
    // If user provided a fallback, respect it
    if (fallback) return <>{fallback}</>;

    const detail = errorMessage ?? "You do not have permission to access this page.";

    // Provide context for support (optional but helpful)
    const requestSummary = {
      permission,
      permissions,
      role,
      roles,
      hierarchyLevel,
      maxHierarchyLevel,
      requiredPermissions,
      requireAllPermissions,
    };

    const supportSubject = encodeURIComponent("Camtop Access Request");
    const supportBody = encodeURIComponent(
      `Hello Camtop Support,\n\nI cannot access a page in the system.\n\nDetails:\n${JSON.stringify(
        requestSummary,
        null,
        2
      )}\n\nPlease help.\n`
    );

    return (
      <div className="min-h-[500px] flex items-center justify-center p-4">
        <div className="w-full max-w-2xl rounded-2xl border bg-background shadow-sm">
          <div className="p-6 sm:p-8">
            <div className="flex items-start gap-4">
              <div className="flex-1">
                 <TriangleAlertIcon className="mx-auto h-12 w-12 text-destructive" />
                <h1 className="text-xl font-semibold">Access denied</h1>
                <p className="mt-1 text-sm text-muted-foreground">{detail}</p>

                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-xl border p-4">
                    <p className="text-sm font-medium">What you can do</p>
                    <ul className="mt-2 space-y-1 text-sm text-muted-foreground list-disc pl-5">
                      <li>Go back and try a different page</li>
                      <li>Request access from an administrator</li>
                      <li>Contact Camtop Support for help</li>
                    </ul>
                  </div>

                  <div className="rounded-xl border p-4">
                    <p className="text-sm font-medium">Camtop Support</p>

                    <div className="mt-3 space-y-2">
                      <a
                        className="flex items-center gap-2 text-sm hover:underline"
                        href={`mailto:${supportEmail}?subject=${supportSubject}&body=${supportBody}`}
                      >
                        <Mail className="h-4 w-4" />
                        {supportEmail}
                      </a>

                      {supportPhone ? (
                        <a
                          className="flex items-center gap-2 text-sm hover:underline"
                          href={`tel:${supportPhone}`}
                        >
                          <Phone className="h-4 w-4" />
                          {supportPhone}
                        </a>
                      ) : null}

                      <p className="text-xs text-muted-foreground">
                        Include a screenshot and your account email for faster support.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                  <Button
                    variant="outline"
                    onClick={() => router.back()}
                    className="gap-2"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    Go back
                  </Button>

                  <Button
                    onClick={() => router.push("/dashboard")}
                    className="gap-2"
                  >
                    <Home className="h-4 w-4" />
                    Go to dashboard
                  </Button>
                </div>
              </div>
            </div>
          </div>

          <div className="border-t px-6 py-4 text-xs text-muted-foreground">
            If you believe this is a mistake, your administrator may need to grant the required
            role/permission.
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};
