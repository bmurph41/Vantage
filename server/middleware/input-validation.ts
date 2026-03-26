/**
 * Input Validation
 * Zod schemas for all request body validation
 */

import { z } from 'zod';
import type { Request, Response, NextFunction } from 'express';
import { ValidationError } from './error-handler';

/**
 * Validation middleware factory
 * Usage: router.post('/route', validate(schema), handler)
 */
export function validate(schema: z.ZodSchema) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const validated = schema.parse(req.body);
      req.body = validated; // Replace with validated data
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        const messages = error.errors.map(err => `${err.path.join('.')}: ${err.message}`);
        next(new ValidationError(messages.join(', ')));
      } else {
        next(error);
      }
    }
  };
}

/**
 * Validate query parameters
 */
export function validateQuery(schema: z.ZodSchema) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const validated = schema.parse(req.query);
      req.query = validated as any;
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        const messages = error.errors.map(err => `${err.path.join('.')}: ${err.message}`);
        next(new ValidationError(messages.join(', ')));
      } else {
        next(error);
      }
    }
  };
}

/**
 * Validate route params
 */
export function validateParams(schema: z.ZodSchema) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const validated = schema.parse(req.params);
      req.params = validated as any;
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        const messages = error.errors.map(err => `${err.path.join('.')}: ${err.message}`);
        next(new ValidationError(messages.join(', ')));
      } else {
        next(error);
      }
    }
  };
}

// ============================================================================
// Common Schemas
// ============================================================================

export const schemas = {
  // Pagination
  pagination: z.object({
    limit: z.coerce.number().min(1).max(100).default(50),
    offset: z.coerce.number().min(0).default(0),
    cursor: z.string().optional()
  }),

  // ID parameter
  id: z.object({
    id: z.coerce.number().int().positive()
  }),

  // Auth
  login: z.object({
    email: z.string().email('Invalid email address'),
    password: z.string().min(8, 'Password must be at least 8 characters')
  }),

  register: z.object({
    email: z.string().email(),
    password: z.string()
      .min(8, 'Password must be at least 8 characters')
      .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
      .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
      .regex(/[0-9]/, 'Password must contain at least one number'),
    name: z.string().min(1, 'Name is required'),
    organizationName: z.string().min(1, 'Organization name is required')
  }),

  passwordReset: z.object({
    token: z.string().min(1, 'Token is required'),
    newPassword: z.string()
      .min(8)
      .regex(/[A-Z]/)
      .regex(/[a-z]/)
      .regex(/[0-9]/)
  }),

  // CRM
  createDeal: z.object({
    name: z.string().min(1, 'Deal name is required'),
    stage: z.enum(['lead', 'qualified', 'proposal', 'negotiation', 'closed_won', 'closed_lost']),
    value: z.number().min(0).optional(),
    probability: z.number().min(0).max(100).optional(),
    expectedCloseDate: z.string().datetime().optional(),
    contactId: z.number().int().positive().optional(),
    companyId: z.number().int().positive().optional(),
    propertyId: z.number().int().positive().optional()
  }),

  updateDeal: z.object({
    name: z.string().min(1).optional(),
    stage: z.enum(['lead', 'qualified', 'proposal', 'negotiation', 'closed_won', 'closed_lost']).optional(),
    value: z.number().min(0).optional(),
    probability: z.number().min(0).max(100).optional(),
    expectedCloseDate: z.string().datetime().optional(),
    contactId: z.number().int().positive().optional(),
    companyId: z.number().int().positive().optional(),
    propertyId: z.number().int().positive().optional(),
    notes: z.string().optional()
  }),

  createContact: z.object({
    firstName: z.string().min(1, 'First name is required'),
    lastName: z.string().min(1, 'Last name is required'),
    email: z.string().email().optional(),
    phone: z.string().optional(),
    title: z.string().optional(),
    companyId: z.number().int().positive().optional()
  }),

  // Due Diligence
  createProject: z.object({
    name: z.string().min(1, 'Project name is required'),
    description: z.string().optional(),
    startDate: z.string().datetime().optional(),
    endDate: z.string().datetime().optional(),
    dealId: z.number().int().positive().optional()
  }),

  createTask: z.object({
    name: z.string().min(1, 'Task name is required'),
    description: z.string().optional(),
    priority: z.enum(['low', 'medium', 'high', 'urgent']).default('medium'),
    dueDate: z.string().datetime().optional(),
    assignedTo: z.number().int().positive().optional(),
    categoryId: z.number().int().positive().optional()
  }),

  updateTask: z.object({
    name: z.string().min(1).optional(),
    description: z.string().optional(),
    status: z.enum(['pending', 'in_progress', 'completed', 'blocked']).optional(),
    priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
    dueDate: z.string().datetime().optional(),
    assignedTo: z.number().int().positive().optional()
  }),

  createRisk: z.object({
    category: z.string().min(1, 'Category is required'),
    description: z.string().min(1, 'Description is required'),
    likelihood: z.number().min(1).max(5),
    impact: z.number().min(1).max(5),
    mitigation: z.string().optional(),
    status: z.enum(['identified', 'analyzing', 'mitigating', 'resolved']).default('identified')
  }),

  // Rent Roll
  createTenant: z.object({
    name: z.string().min(1, 'Tenant name is required'),
    email: z.string().email().optional(),
    phone: z.string().optional(),
    boatName: z.string().optional(),
    boatLength: z.number().min(0).optional(),
    boatType: z.string().optional()
  }),

  createLease: z.object({
    tenantId: z.number().int().positive(),
    storageLocationId: z.number().int().positive(),
    startDate: z.string().datetime(),
    endDate: z.string().datetime().optional(),
    monthlyRate: z.number().min(0),
    depositAmount: z.number().min(0).optional(),
    status: z.enum(['active', 'expired', 'future', 'terminated']).default('active')
  }),

  // Modeling
  createModelingProject: z.object({
    name: z.string().min(1, 'Project name is required'),
    propertyId: z.number().int().positive().optional(),
    acquisitionPrice: z.number().min(0).optional(),
    acquisitionDate: z.string().datetime().optional()
  }),

  createScenario: z.object({
    name: z.string().min(1, 'Scenario name is required'),
    description: z.string().optional(),
    assumptions: z.object({
      revenueGrowth: z.number().optional(),
      expenseGrowth: z.number().optional(),
      exitCapRate: z.number().min(0).max(100).optional()
    }).optional()
  }),

  // File Upload (metadata)
  documentUpload: z.object({
    category: z.string().optional(),
    tags: z.array(z.string()).optional(),
    description: z.string().optional()
  }),

  // Search
  search: z.object({
    q: z.string().min(1, 'Search query is required'),
    type: z.enum(['all', 'deals', 'contacts', 'projects', 'documents']).default('all'),
    limit: z.coerce.number().min(1).max(100).default(20)
  }),

  // Bulk Operations
  bulkDelete: z.object({
    ids: z.array(z.number().int().positive()).min(1, 'At least one ID required')
  }),

  bulkUpdate: z.object({
    ids: z.array(z.number().int().positive()).min(1),
    updates: z.record(z.any())
  })
};

/**
 * Custom validators
 */
export const validators = {
  /**
   * Validate date is in future
   */
  futureDate: z.string().refine(
    (date) => new Date(date) > new Date(),
    { message: 'Date must be in the future' }
  ),

  /**
   * Validate date is in past
   */
  pastDate: z.string().refine(
    (date) => new Date(date) < new Date(),
    { message: 'Date must be in the past' }
  ),

  /**
   * Validate phone number (basic)
   */
  phone: z.string().regex(
    /^[\d\s\-\(\)\+]+$/,
    { message: 'Invalid phone number format' }
  ),

  /**
   * Validate URL
   */
  url: z.string().url({ message: 'Invalid URL format' }),

  /**
   * Validate slug (lowercase, hyphens, alphanumeric)
   */
  slug: z.string().regex(
    /^[a-z0-9-]+$/,
    { message: 'Slug must contain only lowercase letters, numbers, and hyphens' }
  )
};

// ============================================================================
// Input Sanitization
// ============================================================================

/**
 * Strip HTML tags and script content from a string
 */
function sanitizeString(input: string): string {
  return input
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<[^>]*>/g, '')
    .trim();
}

/**
 * Recursively sanitize all string values in an object
 */
function deepSanitize(obj: any): any {
  if (typeof obj === 'string') return sanitizeString(obj);
  if (Array.isArray(obj)) return obj.map(deepSanitize);
  if (obj && typeof obj === 'object') {
    const result: any = {};
    for (const [key, value] of Object.entries(obj)) {
      result[key] = deepSanitize(value);
    }
    return result;
  }
  return obj;
}

/**
 * Middleware that sanitizes all string values in req.body
 * to prevent XSS and HTML injection attacks.
 */
export function sanitizeBody(req: any, _res: any, next: any) {
  if (req.body && typeof req.body === 'object') {
    req.body = deepSanitize(req.body);
  }
  next();
}

/**
 * Example usage in routes:
 * 
 * import { validate, validateQuery, schemas } from '../middleware/input-validation';
 * 
 * router.post('/deals', 
 *   validate(schemas.createDeal), 
 *   async (req, res) => {
 *     // req.body is now validated and typed
 *     const deal = await createDeal(req.body);
 *     res.json(deal);
 *   }
 * );
 * 
 * router.get('/deals', 
 *   validateQuery(schemas.pagination), 
 *   async (req, res) => {
 *     const { limit, offset } = req.query;
 *     // ...
 *   }
 * );
 */
