#!/usr/bin/env tsx

import jwt from 'jsonwebtoken';
import { env } from '../config/env';

const JWT_SECRET = env.JWT_SECRET;
const JWT_EXPIRES_IN = '24h';

interface TokenPayload {
  id: string;
  email: string;
  role: 'manager' | 'cashier';
  permissions?: string[];
}

function generateToken(payload: TokenPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

console.log('\n=== Ship Store Development JWT Tokens ===\n');
console.log('Generated for testing authentication and RBAC\n');

const managerToken = generateToken({
  id: 'test-manager-001',
  email: 'manager@shipstore.test',
  role: 'manager',
  permissions: ['products:*', 'transactions:*', 'reports:*', 'settings:*']
});

const cashierToken = generateToken({
  id: 'test-cashier-001',
  email: 'cashier@shipstore.test',
  role: 'cashier',
  permissions: ['products:read', 'transactions:create']
});

console.log('MANAGER TOKEN (full access):');
console.log('----------------------------');
console.log(managerToken);
console.log('\nPayload:', jwt.decode(managerToken));

console.log('\n\nCASHIER TOKEN (read/transact only):');
console.log('-----------------------------------');
console.log(cashierToken);
console.log('\nPayload:', jwt.decode(cashierToken));

console.log('\n\nUsage:');
console.log('------');
console.log('curl -H "Authorization: Bearer <TOKEN>" http://localhost:5000/api/products');
console.log('\nExpires in: 24 hours');
console.log('');
