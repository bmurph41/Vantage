/**
 * H.2 — API Key Authentication Middleware
 *
 * Authenticates requests using Bearer API keys, enforces scopes,
 * rate limiting, and IP allowlists for the white-label /v1/ API.
 */

import { Request, Response, NextFunction } from "express";
import crypto from "crypto";
import { db } from "../db";
import { apiKeys, organizations } from "@shared/schema";
import { eq, and } from "drizzle-orm";

// Simple in-memory rate limiter (per API key)
const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

export interface ApiKeyUser {
  apiKeyId: string;
  orgId: string;
  orgName: string;
  scopes: string[];
  rateLimitPerHour: number;
}

declare global {
  namespace Express {
    interface Request {
      apiKeyUser?: ApiKeyUser;
    }
  }
}

/**
 * Authenticate requests via API key in Authorization header.
 * Sets req.apiKeyUser with org context and scopes.
 */
export async function authenticateApiKey(req: Request, res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer mm_")) {
      return res.status(401).json({
        error: "unauthorized",
        message: "API key required. Use Authorization: Bearer mm_sk_...",
      });
    }

    const rawKey = authHeader.slice(7); // Remove "Bearer "
    const keyPrefix = rawKey.slice(0, 8);

    // Look up by prefix
    const candidates = await db
      .select()
      .from(apiKeys)
      .where(and(eq(apiKeys.keyPrefix, keyPrefix), eq(apiKeys.isActive, true)));

    if (candidates.length === 0) {
      return res.status(401).json({ error: "unauthorized", message: "Invalid API key" });
    }

    // Hash the provided key and compare
    let matchedKey: any = null;
    for (const candidate of candidates) {
      const hash = crypto.createHash("sha256").update(rawKey).digest("hex");
      if (hash === candidate.keyHash) {
        matchedKey = candidate;
        break;
      }
    }

    if (!matchedKey) {
      return res.status(401).json({ error: "unauthorized", message: "Invalid API key" });
    }

    // Check expiration
    if (matchedKey.expiresAt && new Date(matchedKey.expiresAt) < new Date()) {
      return res.status(401).json({ error: "unauthorized", message: "API key has expired" });
    }

    // Check IP allowlist
    const allowlist = matchedKey.ipAllowlist as string[] | null;
    if (allowlist && allowlist.length > 0) {
      const clientIp = req.ip || req.socket.remoteAddress || "";
      if (!allowlist.includes(clientIp)) {
        return res.status(403).json({
          error: "forbidden",
          message: "Request IP not in allowlist",
        });
      }
    }

    // Rate limiting
    const rateLimit = matchedKey.rateLimitPerHour || 1000;
    const now = Date.now();
    const rateKey = matchedKey.id;
    const entry = rateLimitStore.get(rateKey);

    if (entry && now < entry.resetAt) {
      if (entry.count >= rateLimit) {
        res.setHeader("X-RateLimit-Limit", String(rateLimit));
        res.setHeader("X-RateLimit-Remaining", "0");
        res.setHeader("X-RateLimit-Reset", String(Math.ceil(entry.resetAt / 1000)));
        return res.status(429).json({
          error: "rate_limited",
          message: `Rate limit exceeded. ${rateLimit} requests/hour.`,
          retryAfter: Math.ceil((entry.resetAt - now) / 1000),
        });
      }
      entry.count++;
    } else {
      rateLimitStore.set(rateKey, { count: 1, resetAt: now + 3600 * 1000 });
    }

    const remaining = rateLimit - (rateLimitStore.get(rateKey)?.count || 0);
    res.setHeader("X-RateLimit-Limit", String(rateLimit));
    res.setHeader("X-RateLimit-Remaining", String(Math.max(0, remaining)));

    // Get org info
    const [org] = await db
      .select({ id: organizations.id, name: organizations.name })
      .from(organizations)
      .where(eq(organizations.id, matchedKey.orgId));

    // Update lastUsedAt (fire and forget)
    db.update(apiKeys)
      .set({ lastUsedAt: new Date() })
      .where(eq(apiKeys.id, matchedKey.id))
      .then(() => {})
      .catch(() => {});

    req.apiKeyUser = {
      apiKeyId: matchedKey.id,
      orgId: matchedKey.orgId,
      orgName: org?.name || "",
      scopes: (matchedKey.scopes as string[]) || [],
      rateLimitPerHour: rateLimit,
    };

    next();
  } catch (error: any) {
    res.status(500).json({ error: "internal_error", message: error.message });
  }
}

/**
 * Require specific scopes for an endpoint.
 * Usage: requireScope("deals:read") or requireScope("contacts:write")
 */
export function requireScope(...requiredScopes: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.apiKeyUser) {
      return res.status(401).json({ error: "unauthorized" });
    }

    const userScopes = req.apiKeyUser.scopes;

    // Check if key has wildcard scope
    if (userScopes.includes("*")) return next();

    for (const scope of requiredScopes) {
      if (!userScopes.includes(scope)) {
        // Check for category wildcard (e.g., "deals:*" covers "deals:read")
        const [category] = scope.split(":");
        if (!userScopes.includes(`${category}:*`)) {
          return res.status(403).json({
            error: "insufficient_scope",
            message: `This endpoint requires scope: ${scope}`,
            requiredScopes,
            yourScopes: userScopes,
          });
        }
      }
    }

    next();
  };
}
