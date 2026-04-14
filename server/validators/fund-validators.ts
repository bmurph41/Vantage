import { z } from 'zod';

const dateString = z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/));

export const createCapitalCallSchema = z.object({
  totalAmount: z.number().positive('Capital call amount must be positive'),
  purpose: z.string().min(1).max(500),
  dueDate: dateString,
  callNumber: z.number().int().positive().optional(),
  notes: z.string().max(1000).optional(),
  dealAllocationId: z.string().uuid().optional(),
});

export const processDistributionSchema = z.object({
  totalProceeds: z.number().positive('Distribution amount must be positive'),
  distributionType: z.enum(['return_of_capital', 'income', 'gain', 'liquidation']),
  dealAllocationId: z.string().uuid().optional(),
  notes: z.string().max(1000).optional(),
  yearsHeld: z.number().positive().optional(),
});

export const createInvestorSchema = z.object({
  name: z.string().min(1).max(200),
  email: z.string().email().optional(),
  commitmentAmount: z.number().positive('Commitment must be positive'),
  ownershipPercentage: z.number().min(0).max(100).optional(),
  investorType: z.enum(['lp', 'gp', 'co_invest']).optional(),
});

export const periodLockSchema = z.object({
  periodLabel: z.string().min(1).max(200),
  periodStart: dateString,
  periodEnd: dateString,
});

export const fundCreateSchema = z.object({
  name: z.string().min(1).max(200),
  targetSize: z.number().positive().optional(),
  hardCap: z.number().positive().optional(),
  managementFeeRate: z.number().min(0).max(10).optional(),
  carriedInterest: z.number().min(0).max(50).optional(),
  preferredReturn: z.number().min(0).max(30).optional(),
  vintage: z.number().int().min(2000).max(2100).optional(),
}).passthrough();

export const fundUpdateSchema = fundCreateSchema.partial().passthrough();

export const capitalMovementSchema = z.object({
  movementType: z.enum(['call', 'distribution', 'return_of_capital', 'fee', 'other']),
  amount: z.number({ required_error: 'Amount is required' }),
  movementDate: dateString.optional(),
  description: z.string().max(1000).optional(),
  fundInvestorId: z.string().uuid().optional(),
}).passthrough();

export const distributionDraftSchema = z.object({
  totalAmount: z.number().positive('Distribution amount must be positive'),
  distributionType: z.string().min(1).max(100).optional(),
  notes: z.string().max(2000).optional(),
}).passthrough();

export const unlockPeriodSchema = z.object({
  reason: z.string().min(1, 'Unlock reason is required').max(500),
});
