import { Router } from "express";
import { RoleController } from "./role.controller";
import { validate } from "../../middleware/validation.middleware";
import {
	getRolesQuerySchema,
	createRoleSchema,
  updateRoleSchema,
  roleIdParamSchema,
  assignRolesSchema,
} from "./role.dto";
import { authenticate, authorizeRole } from "../../middleware/auth.middleware";

export const roleRoutes = Router();

// protect all role routes (example)
roleRoutes.use(authenticate);

// list roles
roleRoutes.get("/", validate(getRolesQuerySchema, "query"), RoleController.getAllRoles);

// get by id
roleRoutes.get("/:id", validate(roleIdParamSchema, "params"), RoleController.getRoleById);

// create role (example: super admin hierarchy level 1)
roleRoutes.post("/", authorizeRole(1), validate(createRoleSchema), RoleController.create);

// update role
roleRoutes.put("/:id", authorizeRole(1), validate(updateRoleSchema), RoleController.update);

// delete role
roleRoutes.delete("/:id", authorizeRole(1), RoleController.remove);

// assign role to user
roleRoutes.post("/assign", authorizeRole(1), validate(assignRolesSchema), RoleController.assign);

// revoke role from user
roleRoutes.delete("/revoke/:userId/:roleId", authorizeRole(1), RoleController.revoke);
