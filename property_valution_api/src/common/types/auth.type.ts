import type { Request } from "express";

/** Role info attached to req.user */
export interface RoleData {
  id: number;
  roleCode: string;
  roleName?: string;
  hierarchyLevel: number;
  isActive?: boolean;
}

/** User attached to req.user by authenticate middleware */
export interface AuthUser {
  id: number;
  username: string;
  email: string;
  status: string;
  roles: RoleData[];
  permissions: string[];
}

/** Express request type with authenticated user */
export interface AuthRequest extends Request {
  user?: AuthUser;
}

/** JWT payload (use id everywhere) */
export interface JwtPayload {
  id: number;
  email: string;
  username: string;
  type: "access" | "refresh";
  iat?: number;
  exp?: number;
}
