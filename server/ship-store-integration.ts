import jwt from 'jsonwebtoken';
import { createProxyMiddleware } from 'http-proxy-middleware';
import type { Request, Response } from 'express';

// Ship Store JWT token generation
export function generateShipStoreToken(user: { 
  id: string | number; 
  email: string; 
  role?: string;
}): string {
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET is not configured');
  }

  // Map MarinaMatch roles to Ship Store roles (manager/cashier)
  // Default to 'manager' for admin/owner roles, 'cashier' for others
  let shipStoreRole = 'cashier';
  
  if (user.role) {
    const role = user.role.toLowerCase();
    if (['admin', 'owner', 'manager', 'editor'].includes(role)) {
      shipStoreRole = 'manager';
    }
  }

  const payload = {
    id: String(user.id), // CRITICAL: Use stable user ID
    email: user.email,
    role: shipStoreRole,
  };

  return jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: '24h',
  });
}

// Reverse proxy middleware for Ship Store API
export const shipStoreProxy = createProxyMiddleware({
  target: 'http://localhost:5001',
  changeOrigin: true,
  pathRewrite: {
    '^/api/ship-store': '/api', // Remove /ship-store prefix when forwarding
  },
  onError: (err, req, res) => {
    console.error('Ship Store proxy error:', err);
    const response = res as Response;
    response.status(503).json({
      error: 'Ship Store service unavailable',
      message: err.message,
    });
  },
  logLevel: 'warn',
});

// JWT token generation endpoint
export function shipStoreTokenEndpoint(req: Request, res: Response) {
  try {
    // Get user from session (assuming MarinaMatch uses session auth)
    const user = (req as any).user;
    
    if (!user || !user.id || !user.email) {
      return res.status(401).json({
        error: 'Authentication required',
        message: 'You must be logged in to access Ship Store',
      });
    }

    const token = generateShipStoreToken({
      id: user.id,
      email: user.email,
      role: user.role,
    });

    res.json({
      token,
      expiresIn: '24h',
    });
  } catch (error) {
    console.error('Error generating Ship Store token:', error);
    res.status(500).json({
      error: 'Token generation failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
