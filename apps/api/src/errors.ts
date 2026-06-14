import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";

export class AppError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public code = "APP_ERROR",
    public details?: unknown
  ) {
    super(message);
  }
}

export function notFound(_req: Request, _res: Response, next: NextFunction) {
  next(new AppError(404, "Route not found", "NOT_FOUND"));
}

export function errorHandler(error: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (error instanceof ZodError) {
    return res.status(400).json({
      error: { message: "Validation failed", code: "VALIDATION_ERROR", details: error.flatten() }
    });
  }

  if (error instanceof AppError) {
    return res.status(error.statusCode).json({
      error: { message: error.message, code: error.code, details: error.details }
    });
  }

  const message = error instanceof Error ? error.message : "Unexpected error";
  return res.status(500).json({ error: { message, code: "INTERNAL_ERROR" } });
}
