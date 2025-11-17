import jwt from "jsonwebtoken";
import type { Request, Response, NextFunction } from "express";

// Extended Request type with user information
export interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
    permissions?: string[];
  };
}

import { env } from "../config/env";

// JWT secret - shared with parent app for token verification
// This is validated at startup and will fail fast if not provided
const JWT_SECRET = env.JWT_SECRET;

/**
 * Middleware to validate JWT tokens from parent application
 * Tokens should be passed in Authorization header: Bearer <token>
 */
export function authenticate(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ message: "Authentication required" });
    }

    const token = authHeader.substring(7); // Remove "Bearer " prefix

    const decoded = jwt.verify(token, JWT_SECRET) as {
      id: string;
      email: string;
      role: string;
      permissions?: string[];
    };

    req.user = decoded;
    next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      return res.status(401).json({ message: "Token expired" });
    }
    if (error instanceof jwt.JsonWebTokenError) {
      return res.status(401).json({ message: "Invalid token" });
    }
    return res.status(500).json({ message: "Authentication error" });
  }
}

/**
 * Middleware to check if user has specific role
 * @param roles - Array of allowed roles
 */
export function requireRole(...roles: string[]) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ message: "Authentication required" });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ 
        message: "Insufficient permissions",
        required: roles,
        current: req.user.role
      });
    }

    next();
  };
}

/**
 * Middleware to check if user has specific permission
 * @param permissions - Array of required permissions
 */
export function requirePermission(...permissions: string[]) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ message: "Authentication required" });
    }

    const userPermissions = req.user.permissions || [];
    const hasPermission = permissions.some(p => userPermissions.includes(p));

    if (!hasPermission) {
      return res.status(403).json({ 
        message: "Insufficient permissions",
        required: permissions
      });
    }

    next();
  };
}

/**
 * Optional authentication - adds user to request if token present but doesn't require it
 */
export function optionalAuth(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;

    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.substring(7);
      const decoded = jwt.verify(token, JWT_SECRET) as {
        id: string;
        email: string;
        role: string;
        permissions?: string[];
      };
      req.user = decoded;
    }
    next();
  } catch (error) {
    // Ignore auth errors for optional auth
    next();
  }
}

/**
 * Utility function to generate JWT token (for testing/parent app integration)
 */
export function generateToken(user: { id: string; email: string; role: string; permissions?: string[] }) {
  return jwt.sign(user, JWT_SECRET, { expiresIn: '24h' });
}
