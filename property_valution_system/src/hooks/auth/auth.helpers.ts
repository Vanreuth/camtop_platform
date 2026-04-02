import type { Role } from "./auth.schemas";

export const isRoleActive = (role?: Role | null) => !!role && role.isActive !== false;

export const hasPermission = (permissions: string[], permission: string): boolean =>
  permissions.includes(permission);

export const hasAnyPermission = (permissions: string[], required: string[]): boolean =>
  required.length === 0 ? true : required.some((p) => permissions.includes(p));

export const hasAllPermissions = (permissions: string[], required: string[]): boolean =>
  required.length === 0 ? true : required.every((p) => permissions.includes(p));

export const hasRole = (roles: Role[], roleCode: string): boolean =>
  roles.some((r) => isRoleActive(r) && r.roleCode === roleCode);

export const hasAnyRole = (roles: Role[], codes: string[]): boolean =>
  codes.length === 0 ? true : codes.some((c) => hasRole(roles, c));

export const hasAllRoles = (roles: Role[], codes: string[]): boolean =>
  codes.length === 0 ? true : codes.every((c) => hasRole(roles, c));

export const hasHierarchyLevel = (roles: Role[], maxLevel: number): boolean => {
  const map: Record<string, number> = {
    SUPER_ADMIN: 1,
    PROP_MGR: 2,
    PROPERTY_MANAGER: 2,
    DATA_ENTRY: 3,
    VIEWER: 4,
    USER: 5,
  };

  return roles.some((r) => {
    if (!isRoleActive(r)) return false;
    const lv = r.hierarchyLevel ?? map[r.roleCode] ?? 999;
    return lv <= maxLevel;
  });
};

export const getHighestRole = (roles: Role[]): Role | null => {
  const active = roles.filter(isRoleActive);
  if (!active.length) return null;

  return active.reduce((best, cur) => {
    const bestLv = best.hierarchyLevel ?? 999;
    const curLv = cur.hierarchyLevel ?? 999;
    return curLv < bestLv ? cur : best;
  });
};

export const canAccess = (args: {
  roles: Role[];
  permissions: string[];
  maxHierarchyLevel: number;
  requiredPermissions?: string[];
  requireAll?: boolean;
}) => {
  const { roles, permissions, maxHierarchyLevel, requiredPermissions = [], requireAll = false } = args;

  if (!hasHierarchyLevel(roles, maxHierarchyLevel)) return false;
  if (!requiredPermissions.length) return true;

  return requireAll
    ? hasAllPermissions(permissions, requiredPermissions)
    : hasAnyPermission(permissions, requiredPermissions);
};

export const isSuperAdmin = (roles: Role[]): boolean => hasRole(roles, "SUPER_ADMIN");

export const isPropertyManager = (roles: Role[]): boolean =>
  hasAnyRole(roles, ["PROP_MGR", "PROPERTY_MANAGER"]);
