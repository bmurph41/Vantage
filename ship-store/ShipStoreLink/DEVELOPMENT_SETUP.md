# Development Setup for Ship Store

## Environment Variables for Local Development

For local development and testing, you need to set up environment variables. Ship Store uses strict environment validation to prevent security vulnerabilities.

### Required Environment Variables

#### Database (Auto-configured in Replit)
```bash
DATABASE_URL=postgresql://...
SESSION_SECRET=<random-secret>
```

#### JWT Authentication for Parent App Integration

**Option 1: Use Development Secret (Recommended for Local Testing)**
```bash
# For local development only - DO NOT use in production
DEVELOPMENT_JWT_SECRET=my-local-dev-secret-for-testing
```

**Option 2: Use Production-like Secret (Recommended for Staging)**
```bash
# Same secret your parent app uses - for realistic testing
JWT_SECRET=shared-secret-with-parent-app
```

### Optional Environment Variables
```bash
# CORS Configuration (default: localhost)
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:5000

# Stripe (if testing payment features locally)
STRIPE_SECRET_KEY=sk_test_...
VITE_STRIPE_PUBLIC_KEY=pk_test_...
```

## Setting Environment Variables in Replit

1. Click on "Tools" in the left sidebar
2. Click on "Secrets"
3. Add each environment variable as a secret
4. Restart your application

## Testing JWT Authentication

### Generate a Test JWT Token

You can use the provided utility function to generate test tokens:

```typescript
import { generateToken } from './server/middleware/auth';

const testToken = generateToken({
  id: 'user-123',
  email: 'test@example.com',
  role: 'manager',
  permissions: ['pos:read', 'inventory:write']
});

console.log('Test Token:', testToken);
```

### Test API Calls with Authentication

```bash
# Example: Get products (requires auth)
curl -H "Authorization: Bearer YOUR_TOKEN_HERE" \
     http://localhost:5000/api/products
```

## Security Notes

⚠️ **IMPORTANT**: 
- `DEVELOPMENT_JWT_SECRET` is **ONLY** for local development
- The application will **REFUSE TO START** if you try to use `DEVELOPMENT_JWT_SECRET` in production
- Always use `JWT_SECRET` (shared with parent app) in staging and production
- Never commit secrets to version control
- Rotate secrets regularly in production

## Troubleshooting

### "Missing required environment variables: JWT_SECRET or DEVELOPMENT_JWT_SECRET"
**Solution**: Set either `JWT_SECRET` or `DEVELOPMENT_JWT_SECRET` in your Replit secrets

### "CRITICAL: Cannot use DEVELOPMENT_JWT_SECRET in production!"
**Solution**: Set `JWT_SECRET` instead when `NODE_ENV=production`

### "Invalid NODE_ENV: staging"
**Solution**: Use only "development", "production", or "test" for NODE_ENV
