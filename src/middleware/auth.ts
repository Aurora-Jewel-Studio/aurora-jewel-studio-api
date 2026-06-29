import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

function getJwtSecret() {
  const secret = process.env.ADMIN_JWT_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("ADMIN_JWT_SECRET must be set to at least 32 characters.");
  }
  return secret;
}

export interface AuthRequest extends Request {
  adminEmail?: string;
}

/**
 * Middleware to protect admin-only routes.
 * Expects: Authorization: Bearer <jwt_token>
 */
export function requireAdmin(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): void {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({ error: "Missing or invalid authorization header" });
    return;
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, getJwtSecret()) as { email: string };
    req.adminEmail = decoded.email;
    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired token" });
    return;
  }
}

/**
 * Generate a JWT token for an admin user.
 */
export function generateAdminToken(email: string): string {
  return jwt.sign({ email }, getJwtSecret(), { expiresIn: "7d" });
}
