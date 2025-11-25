#!/bin/bash

echo "=== MarinaMatch Security Check ==="
echo ""

echo "1. Running npm audit..."
npm audit --production 2>/dev/null || echo "   Note: Some vulnerabilities may be reported"
echo ""

echo "2. Checking for hardcoded secrets..."
SECRETS_FOUND=$(grep -r --include="*.ts" --include="*.tsx" --include="*.js" -E "(password|secret|api.?key|token)\s*[:=]\s*['\"][^'\"]{8,}" server/ client/src/ 2>/dev/null | grep -v "node_modules" | grep -v ".d.ts" | wc -l)
if [ "$SECRETS_FOUND" -gt 0 ]; then
  echo "   WARNING: Potential hardcoded secrets found: $SECRETS_FOUND occurrences"
  grep -r --include="*.ts" --include="*.tsx" --include="*.js" -E "(password|secret|api.?key|token)\s*[:=]\s*['\"][^'\"]{8,}" server/ client/src/ 2>/dev/null | grep -v "node_modules" | grep -v ".d.ts"
else
  echo "   OK: No obvious hardcoded secrets found"
fi
echo ""

echo "3. Checking for eval() usage..."
EVAL_FOUND=$(grep -r --include="*.ts" --include="*.tsx" --include="*.js" "\beval\s*(" server/ client/src/ 2>/dev/null | grep -v "node_modules" | wc -l)
if [ "$EVAL_FOUND" -gt 0 ]; then
  echo "   WARNING: eval() usage found: $EVAL_FOUND occurrences"
else
  echo "   OK: No eval() usage found"
fi
echo ""

echo "4. Checking environment variable validation..."
if [ -f "server/config/env.ts" ]; then
  echo "   OK: Environment validation file exists"
else
  echo "   WARNING: server/config/env.ts not found"
fi
echo ""

echo "5. Checking security middleware..."
if grep -q "helmet" server/middleware/security.ts 2>/dev/null; then
  echo "   OK: Helmet middleware configured"
else
  echo "   WARNING: Helmet not found"
fi

if grep -q "cors" server/middleware/security.ts 2>/dev/null; then
  echo "   OK: CORS middleware configured"
else
  echo "   WARNING: CORS not found"
fi

if grep -q "rateLimit" server/middleware/security.ts 2>/dev/null; then
  echo "   OK: Rate limiting configured"
else
  echo "   WARNING: Rate limiting not found"
fi
echo ""

echo "6. Checking auth middleware..."
if [ -f "server/modules/auth/auth.middleware.ts" ]; then
  echo "   OK: Auth middleware exists"
else
  echo "   WARNING: Auth middleware not found"
fi
echo ""

echo "7. Checking audit logging..."
if [ -f "server/services/audit-service.ts" ]; then
  echo "   OK: Audit service exists"
else
  echo "   WARNING: Audit service not found"
fi
echo ""

echo "=== Security Check Complete ==="
