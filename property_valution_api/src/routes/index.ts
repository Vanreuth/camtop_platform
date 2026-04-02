import { Router } from "express";
import {authRoutes} from "../modules/auth/auth.routes";
import { userRoutes } from "../modules/user/user.routes";
import {roleRoutes} from "../modules/role/role.routes";
import { permissionRoutes } from "../modules/permission/permission.routes";
import { propertyRoutes } from "../modules/property/property.routes";
import auditRoutes from "../modules/audit/audit.route";
import { propertyTypeRoutes } from "../modules/propertyType/propertyType.routes";
import { propertyValuationRoutes } from "../modules/propertyValuation/propertyValuation.routes";
import {propertyAddressRoutes} from "../modules/propertyAddress/propertyAddress.route";
import notificationRoute from "../modules/notification/notification.routes";
import { indicativeValuationRoutes } from "../modules/indicativeValuation/indicativeValuation.routes";
const rootRoutes = Router();


rootRoutes.use("/auth", authRoutes);
rootRoutes.use("/users", userRoutes);
rootRoutes.use("/roles", roleRoutes);
rootRoutes.use("/audit", auditRoutes);
rootRoutes.use("/permissions", permissionRoutes);
rootRoutes.use("/propertytype", propertyTypeRoutes);
rootRoutes.use("/properties", propertyRoutes);
rootRoutes.use("/property-address", propertyAddressRoutes);
rootRoutes.use("/property-valuations", propertyValuationRoutes);
rootRoutes.use("/property-indicativeValuation", indicativeValuationRoutes);
rootRoutes.use("/notifications", notificationRoute);

export default rootRoutes;
