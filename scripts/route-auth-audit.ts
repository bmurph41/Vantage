/**
 * Route Authentication Audit Script V2
 * 
 * This script analyzes routes.ts to identify:
 * 1. Routes with explicit authentication (authenticateUser middleware)
 * 2. Routes protected by route-level middleware (app.use("/api/dd", authenticateUser, ...))
 * 3. Routes without authentication (potentially unprotected)
 * 4. Public routes that should be unauthenticated (health checks, public APIs)
 * 
 * IMPORTANT: This script now detects both:
 * - Inline middleware: app.get("/api/something", authenticateUser, (req, res) => ...)
 * - Route-level middleware: app.use("/api/dd", authenticateUser, ...) which protects all /api/dd/* routes
 * 
 * Usage: npx tsx scripts/route-auth-audit.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface RouteInfo {
  lineNumber: number;
  method: string;
  path: string;
  hasInlineAuth: boolean;
  hasRouteLevelAuth: boolean;
  hasRoleCheck: boolean;
  roleRequired?: string;
  protectedBy?: string;
  rawLine: string;
}

interface RouteLevelMiddleware {
  lineNumber: number;
  pathPrefix: string;
  hasAuth: boolean;
  rawLine: string;
}

const INTENTIONALLY_PUBLIC_PATTERNS = [
  /^\/health/,
  /^\/metrics$/,
  /^\/api\/config$/,
  /^\/api\/packs\/catalog$/,
  /^\/api\/shared\//,
  /^\/api\/auth\/(login|register|logout|verify|magic-link|forgot-password|reset-password|me|session)/,
  /^\/api\/webhooks?\//,
  /^\/api\/stripe\/webhook/,
  /^\/login/,
  /^\/api\/public\//,
  /^\/api\/auth$/,
];

const SENSITIVE_PATTERNS = [
  { pattern: /\/api\/admin\//, description: 'Admin routes' },
  { pattern: /\/api\/organization\//, description: 'Organization settings' },
  { pattern: /\/api\/users\//, description: 'User management' },
  { pattern: /\/api\/crm\//, description: 'CRM data' },
  { pattern: /\/api\/dd\//, description: 'Due diligence data' },
  { pattern: /\/api\/modeling\//, description: 'Financial modeling' },
  { pattern: /\/api\/vdr\//, description: 'Virtual data room' },
  { pattern: /\/api\/fk\//, description: 'Financial kernel' },
  { pattern: /\/api\/integrations\//, description: 'Third-party integrations' },
  { pattern: /\/api\/email-marketing\//, description: 'Email marketing' },
  { pattern: /\/api\/documents?\//, description: 'Documents' },
  { pattern: /\/api\/files?\//, description: 'File access' },
  { pattern: /\/api\/exports?\//, description: 'Data exports' },
];

function parseRouteLevelMiddleware(content: string): RouteLevelMiddleware[] {
  const lines = content.split('\n');
  const middleware: RouteLevelMiddleware[] = [];
  
  const useRegex = /app\.use\s*\(\s*["'`]([^"'`]+)["'`]/i;
  
  lines.forEach((line, index) => {
    const match = line.match(useRegex);
    if (match) {
      const hasAuth = line.includes('authenticateUser') || line.includes('requireAuth');
      middleware.push({
        lineNumber: index + 1,
        pathPrefix: match[1],
        hasAuth,
        rawLine: line.trim(),
      });
    }
  });
  
  return middleware;
}

function parseRoutes(filePath: string): { routes: RouteInfo[], middleware: RouteLevelMiddleware[] } {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  const routes: RouteInfo[] = [];
  
  const middleware = parseRouteLevelMiddleware(content);
  const authPrefixes = middleware
    .filter(m => m.hasAuth)
    .map(m => m.pathPrefix)
    .sort((a, b) => b.length - a.length);
  
  const routeRegex = /app\.(get|post|put|patch|delete)\s*\(\s*["'`]([^"'`]+)["'`]/i;
  
  lines.forEach((line, index) => {
    const match = line.match(routeRegex);
    if (match) {
      const routePath = match[2];
      const hasInlineAuth = line.includes('authenticateUser') || line.includes('requireAuth');
      const hasRoleCheck = line.includes('requireRole') || line.includes('requirePermission');
      
      const protectingPrefix = authPrefixes.find(prefix => routePath.startsWith(prefix));
      const hasRouteLevelAuth = !!protectingPrefix;
      
      let roleRequired: string | undefined;
      const roleMatch = line.match(/requireRole\s*\(\s*["'`]([^"'`]+)["'`]/);
      if (roleMatch) {
        roleRequired = roleMatch[1];
      }
      
      routes.push({
        lineNumber: index + 1,
        method: match[1].toUpperCase(),
        path: routePath,
        hasInlineAuth,
        hasRouteLevelAuth,
        hasRoleCheck,
        roleRequired,
        protectedBy: protectingPrefix,
        rawLine: line.trim(),
      });
    }
  });
  
  return { routes, middleware };
}

function isIntentionallyPublic(path: string): boolean {
  return INTENTIONALLY_PUBLIC_PATTERNS.some(pattern => pattern.test(path));
}

function getSensitivityInfo(path: string): { isSensitive: boolean; description?: string } {
  for (const { pattern, description } of SENSITIVE_PATTERNS) {
    if (pattern.test(path)) {
      return { isSensitive: true, description };
    }
  }
  return { isSensitive: false };
}

function generateReport(routes: RouteInfo[], middleware: RouteLevelMiddleware[]): void {
  const hasAnyAuth = (r: RouteInfo) => r.hasInlineAuth || r.hasRouteLevelAuth;
  
  const authenticated = routes.filter(hasAnyAuth);
  const unauthenticated = routes.filter(r => !hasAnyAuth(r));
  const intentionallyPublic = unauthenticated.filter(r => isIntentionallyPublic(r.path));
  const potentiallyUnprotected = unauthenticated.filter(r => !isIntentionallyPublic(r.path));
  const sensitiveUnprotected = potentiallyUnprotected.filter(r => getSensitivityInfo(r.path).isSensitive);
  
  const inlineAuthOnly = routes.filter(r => r.hasInlineAuth && !r.hasRouteLevelAuth);
  const routeLevelAuthOnly = routes.filter(r => !r.hasInlineAuth && r.hasRouteLevelAuth);
  const bothAuth = routes.filter(r => r.hasInlineAuth && r.hasRouteLevelAuth);
  
  console.log('='.repeat(80));
  console.log('ROUTE AUTHENTICATION AUDIT REPORT V2');
  console.log('='.repeat(80));
  console.log(`Generated: ${new Date().toISOString()}`);
  console.log('');
  
  console.log('SUMMARY');
  console.log('-'.repeat(40));
  console.log(`Total routes analyzed: ${routes.length}`);
  console.log(`Routes with authentication: ${authenticated.length} (${(authenticated.length/routes.length*100).toFixed(1)}%)`);
  console.log(`  - Route-level middleware only: ${routeLevelAuthOnly.length}`);
  console.log(`  - Inline middleware only: ${inlineAuthOnly.length}`);
  console.log(`  - Both (redundant): ${bothAuth.length}`);
  console.log(`Routes without authentication: ${unauthenticated.length}`);
  console.log(`  - Intentionally public: ${intentionallyPublic.length}`);
  console.log(`  - Needs review: ${potentiallyUnprotected.length}`);
  console.log(`  - CRITICAL (sensitive unprotected): ${sensitiveUnprotected.length}`);
  console.log('');
  
  console.log('ROUTE-LEVEL AUTHENTICATION MIDDLEWARE');
  console.log('-'.repeat(40));
  const authMiddleware = middleware.filter(m => m.hasAuth);
  authMiddleware.forEach(m => {
    const coveredRoutes = routes.filter(r => r.path.startsWith(m.pathPrefix) && r.hasRouteLevelAuth);
    console.log(`Line ${m.lineNumber}: ${m.pathPrefix} (protects ${coveredRoutes.length} routes)`);
  });
  console.log('');
  
  if (sensitiveUnprotected.length > 0) {
    console.log('🚨 CRITICAL: SENSITIVE ROUTES WITHOUT AUTHENTICATION');
    console.log('-'.repeat(60));
    sensitiveUnprotected.forEach(route => {
      const sensitivity = getSensitivityInfo(route.path);
      console.log(`Line ${route.lineNumber}: ${route.method} ${route.path}`);
      console.log(`  Category: ${sensitivity.description}`);
    });
    console.log('');
  } else {
    console.log('✅ All sensitive routes are protected by authentication middleware');
    console.log('');
  }
  
  if (potentiallyUnprotected.length > 0) {
    console.log('ROUTES NEEDING REVIEW (not matching known public patterns)');
    console.log('-'.repeat(40));
    
    const byPrefix: Record<string, RouteInfo[]> = {};
    potentiallyUnprotected.forEach(route => {
      const prefix = route.path.split('/').slice(0, 3).join('/');
      if (!byPrefix[prefix]) byPrefix[prefix] = [];
      byPrefix[prefix].push(route);
    });
    
    Object.entries(byPrefix)
      .sort((a, b) => b[1].length - a[1].length)
      .slice(0, 15)
      .forEach(([prefix, routes]) => {
        console.log(`\n${prefix} (${routes.length} routes)`);
        routes.slice(0, 3).forEach(r => {
          console.log(`  Line ${r.lineNumber}: ${r.method} ${r.path}`);
        });
        if (routes.length > 3) {
          console.log(`  ... and ${routes.length - 3} more`);
        }
      });
  }
  
  const jsonReport = {
    generatedAt: new Date().toISOString(),
    summary: {
      totalRoutes: routes.length,
      authenticatedRoutes: authenticated.length,
      routeLevelAuthOnly: routeLevelAuthOnly.length,
      inlineAuthOnly: inlineAuthOnly.length,
      bothAuth: bothAuth.length,
      unauthenticatedRoutes: unauthenticated.length,
      intentionallyPublic: intentionallyPublic.length,
      needsReview: potentiallyUnprotected.length,
      criticalUnprotected: sensitiveUnprotected.length,
    },
    authMiddleware: authMiddleware.map(m => ({
      line: m.lineNumber,
      prefix: m.pathPrefix,
      coveredRoutes: routes.filter(r => r.path.startsWith(m.pathPrefix)).length,
    })),
    criticalRoutes: sensitiveUnprotected.map(r => ({
      line: r.lineNumber,
      method: r.method,
      path: r.path,
      category: getSensitivityInfo(r.path).description,
    })),
    needsReview: potentiallyUnprotected.map(r => ({
      line: r.lineNumber,
      method: r.method,
      path: r.path,
    })),
  };
  
  fs.writeFileSync('route-auth-audit.json', JSON.stringify(jsonReport, null, 2));
  console.log('\n\nFull report written to: route-auth-audit.json');
}

const routesPath = path.join(__dirname, '../server/routes.ts');
const { routes, middleware } = parseRoutes(routesPath);
generateReport(routes, middleware);
