import jwt from "jsonwebtoken";
import { config } from "../config.js";

export const signJwt = (payload: Record<string, unknown>) =>
  jwt.sign(payload, config.jwt.secret, { expiresIn: config.jwt.expiresIn });

export const verifyJwt = (token: string) =>
  jwt.verify(token, config.jwt.secret) as Record<string, unknown>;

export const authGuard = async (token?: string) => {
  if (!token) throw new Error("missing token");
  return verifyJwt(token);
};
