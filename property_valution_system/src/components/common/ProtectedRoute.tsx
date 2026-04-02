"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "@/lib/navigation";
import { useAuth } from "@/hooks/auth/useAuth";
import { Loader2 } from "lucide-react";

interface AuthLayoutProps {
  children: React.ReactNode;
  allowedRoles?: string[]; // Optional: for role-based access control later
}

export function AuthLayout({ children, allowedRoles }: AuthLayoutProps) {
  const { user, isLoading, isError, error } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    // 1. If fetching is done and we have no user (or an error occurred), redirect.
    if (!isLoading && (!user || isError)) {
      const status = (error as any)?.response?.status;

      // If backend explicitly says "Unauthorized", show the 401 page
      if (status === 401) {
        router.replace("/error/401");
        return;
      }

      // Otherwise, default to login with redirect
      const returnUrl = encodeURIComponent(pathname);
      router.replace(`/login?redirect=${returnUrl}`);
    }
    
    // 2. Optional: Role-based check
    if (!isLoading && user && allowedRoles) {
      const roles = user.roles ?? [];
      const hasRole = roles.some((r: { roleCode: string }) =>
        allowedRoles.includes(r.roleCode)
      );
        if (!hasRole) {
            router.replace("/error/403");
        }
    }
  }, [user, isLoading, isError, error, router, pathname, allowedRoles]);

  // --- State 1: Loading ---
  // Show a centered loading spinner while we verify the session
  if (isLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground animate-pulse">
            Verifying session...
          </p>
        </div>
      </div>
    );
  }

  // --- State 2: Unauthenticated ---
  // Return null to prevent "flash" of content while the useEffect triggers the redirect
  if (!user) {
    return null; 
  }

  // --- State 3: Authenticated ---
  return <>{children}</>;
}