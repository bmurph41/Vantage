/**
 * MarinaMatch Zod Validators
 * 
 * Strict input validation schemas for all API endpoints.
 * Rejects unknown fields by default for security.
 * 
 * USAGE:
 * import { validateBody, documentUploadSchema } from './validators';
 * 
 * app.post('/api/documents', validateBody(documentUploadSchema), handler);
 */

import { z } from 'zod';
import { Request, Response, NextFunction, RequestHandler } from 'express';

// ============================================================================
// ZOD CONFIGURATION
// ============================================================================

// By default, Zod strips unknown keys. We want to reject them for security.
const strict = <T extends z.ZodRawShape>(schema: z.ZodObject<T>) =>
  schema.strict();

// ============================================================================
// COMMON SCHEMAS
// ============================================================================

// UUID validation
export const uuidSchema = z.string().uuid();

// Pagination
export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

// Sort order
export const sortOrderSchema = z.enum(['asc', 'desc']).default('desc');

// Date range
export const dateRangeSchema = z.object({
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
}).refine(
  (data) => {
    if (data.startDate && data.endDate) {
      return data.startDate <= data.endDate;
    }
    return true;
  },
  { message: 'startDate must be before or equal to endDate' }
);

// Email
export const emailSchema = z.string().email().max(255).toLowerCase().trim();

// Safe string (no special characters that could be used for injection)
export const safeStringSchema = z.string()
  .min(1)
  .max(500)
  .regex(/^[a-zA-Z0-9\s\-_.,!?@#$%&*()[\]{}'"/:;+=]+$/, 'Invalid characters');

// Filename validation (prevent path traversal)
export const filenameSchema = z.string()
  .min(1)
  .max(255)
  .regex(/^[a-zA-Z0-9\-_. ()[\]]+$/, 'Invalid filename characters')
  .refine(
    (val) => !val.includes('..') && !val.includes('/') && !val.includes('\\'),
    'Invalid filename'
  );

// ============================================================================
// AUTH SCHEMAS
// ============================================================================

export const loginSchema = strict(z.object({
  email: emailSchema,
  password: z.string().min(8).max(128),
  rememberMe: z.boolean().optional().default(false),
}));

export const registerSchema = strict(z.object({
  email: emailSchema,
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .max(128)
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
  displayName: z.string().min(1).max(255).trim(),
  organizationName: z.string().min(1).max(255).trim().optional(),
}));

export const changePasswordSchema = strict(z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string()
    .min(8, 'Password must be at least 8 characters')
    .max(128)
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
}));

// ============================================================================
// DOCUMENT SCHEMAS
// ============================================================================

export const documentTypeSchema = z.enum([
  'pnl',
  'rent_roll',
  'lease',
  'tax_return',
  'appraisal',
  'environmental',
  'survey',
  'insurance',
  'other',
]);

export const classificationSchema = z.enum([
  'public',
  'internal',
  'confidential',
  'restricted',
]);

export const documentUploadSchema = strict(z.object({
  documentType: documentTypeSchema.optional(),
  classification: classificationSchema.optional().default('confidential'),
  description: z.string().max(1000).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
}));

export const documentUpdateSchema = strict(z.object({
  documentType: documentTypeSchema.optional(),
  classification: classificationSchema.optional(),
  description: z.string().max(1000).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
}));

export const documentQuerySchema = z.object({
  documentType: documentTypeSchema.optional(),
  classification: classificationSchema.optional(),
  status: z.enum(['pending', 'quarantine', 'approved', 'rejected']).optional(),
  uploadedBy: uuidSchema.optional(),
  ...paginationSchema.shape,
  ...dateRangeSchema.shape,
});

export const documentApprovalSchema = strict(z.object({
  status: z.enum(['approved', 'rejected']),
  reason: z.string().max(1000).optional(),
}));

// ============================================================================
// USER SCHEMAS
// ============================================================================

export const userInviteSchema = strict(z.object({
  email: emailSchema,
  roleIds: z.array(uuidSchema).min(1).max(10),
  sendInviteEmail: z.boolean().optional().default(true),
}));

export const userUpdateSchema = strict(z.object({
  displayName: z.string().min(1).max(255).trim().optional(),
  status: z.enum(['active', 'inactive', 'suspended']).optional(),
}));

export const userRoleAssignmentSchema = strict(z.object({
  roleId: uuidSchema,
  assign: z.boolean(), // true = assign, false = revoke
}));

// ============================================================================
// ORGANIZATION SCHEMAS
// ============================================================================

export const organizationUpdateSchema = strict(z.object({
  name: z.string().min(1).max(255).trim().optional(),
  settings: z.record(z.string(), z.unknown()).optional(),
  documentRetentionDays: z.number().int().min(30).max(3650).optional(),
}));

// ============================================================================
// INTEGRATION SCHEMAS
// ============================================================================

export const integrationTypeSchema = z.enum([
  'quickbooks',
  'marina_management',
  'other',
]);

export const oauthCallbackSchema = strict(z.object({
  code: z.string().min(1).max(2000),
  state: z.string().min(1).max(500),
  realmId: z.string().max(100).optional(), // QuickBooks specific
  error: z.string().optional(),
  error_description: z.string().optional(),
}));

export const integrationConnectSchema = strict(z.object({
  type: integrationTypeSchema,
  redirectPath: z.string().max(500).optional(),
}));

export const webhookPayloadSchema = z.object({
  // Flexible to accommodate different webhook providers
  // Specific validation should be done in the handler
}).passthrough();

// ============================================================================
// MODEL/VALUATION SCHEMAS
// ============================================================================

export const modelCreateSchema = strict(z.object({
  name: z.string().min(1).max(255).trim(),
  description: z.string().max(2000).optional(),
  type: z.enum(['acquisition', 'disposition', 'refinance', 'hold']).optional(),
  assumptions: z.record(z.string(), z.unknown()).optional(),
}));

export const modelUpdateSchema = strict(z.object({
  name: z.string().min(1).max(255).trim().optional(),
  description: z.string().max(2000).optional(),
  assumptions: z.record(z.string(), z.unknown()).optional(),
}));

export const modelApplyDataSchema = strict(z.object({
  documentIds: z.array(uuidSchema).min(1).max(50),
  dataMapping: z.record(z.string(), z.string()).optional(),
  overwriteExisting: z.boolean().optional().default(false),
}));

// ============================================================================
// AUDIT LOG SCHEMAS
// ============================================================================

export const auditLogQuerySchema = z.object({
  action: z.string().optional(),
  resourceType: z.string().optional(),
  resourceId: uuidSchema.optional(),
  actorUserId: uuidSchema.optional(),
  ...paginationSchema.shape,
  ...dateRangeSchema.shape,
});

// ============================================================================
// CRM SCHEMAS
// ============================================================================

export const contactCreateSchema = strict(z.object({
  firstName: z.string().min(1).max(100).trim(),
  lastName: z.string().min(1).max(100).trim(),
  email: emailSchema.optional(),
  phone: z.string().max(20).optional(),
  company: z.string().max(255).optional(),
  title: z.string().max(100).optional(),
  notes: z.string().max(5000).optional(),
  tags: z.array(z.string().max(50)).max(20).optional(),
}));

export const dealCreateSchema = strict(z.object({
  name: z.string().min(1).max(255).trim(),
  stage: z.enum(['prospect', 'qualification', 'proposal', 'negotiation', 'closed_won', 'closed_lost']),
  value: z.number().min(0).optional(),
  contactIds: z.array(uuidSchema).max(50).optional(),
  expectedCloseDate: z.coerce.date().optional(),
  notes: z.string().max(5000).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
}));

// ============================================================================
// VALIDATION MIDDLEWARE
// ============================================================================

/**
 * Validate request body against schema
 */
export function validateBody<T extends z.ZodTypeAny>(
  schema: T
): RequestHandler {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);

    if (!result.success) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid request body',
          details: formatZodErrors(result.error),
        },
        requestId: req.requestId,
      });
      return;
    }

    // Replace body with validated data (includes defaults and transformations)
    req.body = result.data;
    next();
  };
}

/**
 * Validate request query parameters against schema
 */
export function validateQuery<T extends z.ZodTypeAny>(
  schema: T
): RequestHandler {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.query);

    if (!result.success) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid query parameters',
          details: formatZodErrors(result.error),
        },
        requestId: req.requestId,
      });
      return;
    }

    // Replace query with validated data
    req.query = result.data as any;
    next();
  };
}

/**
 * Validate request params against schema
 */
export function validateParams<T extends z.ZodTypeAny>(
  schema: T
): RequestHandler {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.params);

    if (!result.success) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid URL parameters',
          details: formatZodErrors(result.error),
        },
        requestId: req.requestId,
      });
      return;
    }

    req.params = result.data as any;
    next();
  };
}

/**
 * Combined validation for body, query, and params
 */
export function validate<
  B extends z.ZodTypeAny,
  Q extends z.ZodTypeAny,
  P extends z.ZodTypeAny
>(schemas: {
  body?: B;
  query?: Q;
  params?: P;
}): RequestHandler {
  return (req: Request, res: Response, next: NextFunction): void => {
    const errors: Array<{ location: string; issues: any[] }> = [];

    if (schemas.body) {
      const result = schemas.body.safeParse(req.body);
      if (!result.success) {
        errors.push({ location: 'body', issues: result.error.issues });
      } else {
        req.body = result.data;
      }
    }

    if (schemas.query) {
      const result = schemas.query.safeParse(req.query);
      if (!result.success) {
        errors.push({ location: 'query', issues: result.error.issues });
      } else {
        req.query = result.data as any;
      }
    }

    if (schemas.params) {
      const result = schemas.params.safeParse(req.params);
      if (!result.success) {
        errors.push({ location: 'params', issues: result.error.issues });
      } else {
        req.params = result.data as any;
      }
    }

    if (errors.length > 0) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Request validation failed',
          details: errors,
        },
        requestId: req.requestId,
      });
      return;
    }

    next();
  };
}

/**
 * Format Zod errors for API response
 */
function formatZodErrors(error: z.ZodError): Array<{
  path: string;
  message: string;
}> {
  return error.issues.map((issue) => ({
    path: issue.path.join('.'),
    message: issue.message,
  }));
}

// ============================================================================
// PARAM SCHEMAS
// ============================================================================

export const idParamSchema = z.object({
  id: uuidSchema,
});

export const slugParamSchema = z.object({
  slug: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/),
});

// ============================================================================
// EXPORTS
// ============================================================================

export { z };
