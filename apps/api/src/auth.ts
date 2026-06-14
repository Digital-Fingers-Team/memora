import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import type { Request, Response, NextFunction } from "express";
import { Types } from "mongoose";
import { env } from "./config";
import { AppError } from "./errors";
import { User, type UserDoc } from "./models";

export type AuthUser = { id: string; email: string; role: "user" | "admin" };

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hash?: string) {
  if (!hash) return false;
  return bcrypt.compare(password, hash);
}

export function signTokens(user: UserDoc) {
  const payload: AuthUser = { id: user._id.toString(), email: user.email, role: user.role };
  const accessToken = jwt.sign(payload, env.JWT_ACCESS_SECRET, { expiresIn: env.JWT_ACCESS_TTL } as jwt.SignOptions);
  const refreshToken = jwt.sign(payload, env.JWT_REFRESH_SECRET, { expiresIn: env.JWT_REFRESH_TTL } as jwt.SignOptions);
  return { accessToken, refreshToken, user: payload };
}

export async function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  const token = header?.startsWith("Bearer ") ? header.slice(7) : undefined;
  if (!token) return next(new AppError(401, "Authentication required", "AUTH_REQUIRED"));

  try {
    const decoded = jwt.verify(token, env.JWT_ACCESS_SECRET) as AuthUser;
    if (!Types.ObjectId.isValid(decoded.id)) throw new Error("Invalid subject");
    req.user = decoded;
    return next();
  } catch {
    return next(new AppError(401, "Invalid or expired access token", "INVALID_TOKEN"));
  }
}

export function requireAdmin(req: Request, _res: Response, next: NextFunction) {
  if (req.user?.role !== "admin") return next(new AppError(403, "Admin access required", "FORBIDDEN"));
  return next();
}

export async function ensureFirstAdmin(email: string) {
  if (env.FIRST_ADMIN_EMAIL && email.toLowerCase() === env.FIRST_ADMIN_EMAIL.toLowerCase()) return "admin";
  const existingAdmin = await User.exists({ role: "admin" });
  return existingAdmin ? "user" : "admin";
}
