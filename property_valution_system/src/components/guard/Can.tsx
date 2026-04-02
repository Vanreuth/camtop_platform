"use client";
import { useAuth } from "@/hooks/auth/useAuth";

interface CanProps {
  // Single permission
  permission?: string;
  // Multiple permissions
  permissions?: string[];
  // Require all permissions (AND) or any (OR)
  requireAll?: boolean;

  // Role-based checks
  role?: string;
  roles?: string[];

  // Hierarchy level check
  hierarchyLevel?: number;

  // Combined check (matches backend authorizeAny)
  maxHierarchyLevel?: number;
  requiredPermissions?: string[];
  requireAllPermissions?: boolean;

  // Special checks
  superAdminOnly?: boolean;
  propertyManagerOnly?: boolean;

  // Fallback
  fallback?: React.ReactNode;
  children: React.ReactNode;
}

export const Can: React.FC<CanProps> = ({
  permission,
  permissions,
  requireAll = false,
  role,
  roles,
  hierarchyLevel,
  maxHierarchyLevel,
  requiredPermissions,
  requireAllPermissions = false,
  superAdminOnly = false,
  propertyManagerOnly = false,
  fallback = null,
  children,
}) => {
  const {
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    hasRole,
    hasAnyRole,
    hasHierarchyLevel,
    canAccessAny,
    canAccessAll,
    isSuperAdmin,
    isPropertyManager,
    
  } = useAuth();

  let hasAccess = false;

  // Special role checks
  if (superAdminOnly) {
    hasAccess = isSuperAdmin();
  } else if (propertyManagerOnly) {
    hasAccess = isPropertyManager();
  }
  // Combined check (matches backend)
  else if (maxHierarchyLevel !== undefined && requiredPermissions) {
    hasAccess = requireAllPermissions
      ? canAccessAll(maxHierarchyLevel, requiredPermissions)
      : canAccessAny(maxHierarchyLevel, requiredPermissions);
  }
  // Hierarchy check
  else if (hierarchyLevel !== undefined) {
    hasAccess = hasHierarchyLevel(hierarchyLevel);
  }
  // Permission checks
  else if (permission) {
    hasAccess = hasPermission(permission);
  } else if (permissions) {
    hasAccess = requireAll
      ? hasAllPermissions(permissions)
      : hasAnyPermission(permissions);
  }
  // Role checks
  else if (role) {
    hasAccess = hasRole(role);
  } else if (roles) {
    hasAccess = hasAnyRole(roles);
  }

  return hasAccess ? <>{children}</> : <>{fallback}</>;
};
