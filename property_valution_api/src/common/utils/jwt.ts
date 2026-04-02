import jwt from "jsonwebtoken";
import { JwtPayload } from "../types/auth.type";
import config from "../../config/index";

export const generateAccessToken = (
  payload: Omit<JwtPayload, "type">
): string => {
  return jwt.sign({ ...payload, type: "access" }, config.jwt.secret, {
    expiresIn: config.jwt.expiresIn,
  });
};

export const generateRefreshToken = (payload: Omit<JwtPayload, "type">) =>
  jwt.sign({ ...payload, type: "refresh" }, config.jwt.refreshSecret, {
    expiresIn: config.jwt.refreshExpiresIn,
  });

export const verifyAccessToken = (token: string): JwtPayload => {
  const decoded = jwt.verify(token, config.jwt.secret) as JwtPayload;

  if(!decoded?.id) throw new Error("Invalid token payload");
 
  return decoded;
};

export const verifyRefreshToken = (token: string): JwtPayload => {
  const decoded = jwt.verify(token, config.jwt.refreshSecret) as JwtPayload;

  if (!decoded?.id) throw new Error("Invalid token: missing id");
  if (decoded.type !== "refresh") throw new Error("Invalid token: not refresh token");

  return decoded;
};

export const getRefreshTokenExpiry = (): Date => {
  const expiryTime = config.jwt.refreshExpiresIn || "7d";
  const num = parseInt(expiryTime, 10);

  if (expiryTime.endsWith("d")) return new Date(Date.now() + num * 24 * 60 * 60 * 1000);
  if (expiryTime.endsWith("h")) return new Date(Date.now() + num * 60 * 60 * 1000);
  if (expiryTime.endsWith("m")) return new Date(Date.now() + num * 60 * 1000);

  return new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
};
