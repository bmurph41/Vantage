/**
 * Loan-to-Capital Stack Sync Service
 * 
 * Bridge pattern: when loans are created/updated/deleted via debt-inputs.tsx,
 * this service syncs the data into capitalStacks + debtTranches tables so
 * the existing Pro Forma engine (which reads from those tables) works correctly.
 * 
 * This is Phase 1 plumbing — eventually Pro Forma will read loans directly.
 * 
 * ⚠ IMPORTANT: DebtScheduleService reads `t.principal` from debtTranches,
 *   BUT there's a bug where it reads `t.amount` (undefined). 
 *   This sync writes to `principal` (correct field). You must also apply
 *   the one-line fix in debt-schedule-service.ts:
 *     Line 159: change `t.amount` → `t.principal`
 *     Line 267-268: change `t.amount` → `t.principal`
 */

import { db } from '../db';
import {
  loans,
  capitalStacks,
  debtTranches,
  modelingProjects,
} from '@shared/schema';
import { eq, and } from 'drizzle-orm';

/**
 * Sync all loans for a project into the capital stack system.
 * Call this after any loan CREATE, UPDATE, or DELETE.
 */
export async function syncLoansToCapitalStack(
  projectId: string,
  orgId: string,
  userId?: string,
): Promise<{ capitalStackId: string; trancheCount: number }> {

  // 1. Get all loans for this project
  const projectLoans = await db.select()
    .from(loans)
    .where(and(eq(loans.projectId, projectId), eq(loans.orgId, orgId)))
    .orderBy(loans.ordinal);

  // 2. Get the project to read purchase price
  const [project] = await db.select()
    .from(modelingProjects)
    .where(and(eq(modelingProjects.id, projectId), eq(modelingProjects.orgId, orgId)))
    .limit(1);

  const purchasePrice = parseFloat(project?.purchasePrice?.toString() || '0');

  // 3. Compute totals from loans
  const totalDebt = projectLoans.reduce(
    (sum, l) => sum + parseFloat(l.loanAmount?.toString() || '0'), 0
  );
  const totalEquity = Math.max(0, purchasePrice - totalDebt);

  // Blended rate (weighted average)
  const blendedRate = totalDebt > 0
    ? projectLoans.reduce((sum, l) => {
        const amt = parseFloat(l.loanAmount?.toString() || '0');
        const rate = l.rateType === 'fixed'
          ? parseFloat(l.fixedRate?.toString() || '0')
          : ((l.initialIndexBps ?? 0) + (l.spreadBps ?? 0)) / 10000;
        return sum + amt * rate;
      }, 0) / totalDebt
    : 0;

  const ltv = purchasePrice > 0 ? totalDebt / purchasePrice : 0;

  // 4. Find or create the capital stack for this modeling project
  let [existing] = await db.select()
    .from(capitalStacks)
    .where(and(
      eq(capitalStacks.modelingProjectId, projectId),
      eq(capitalStacks.orgId, orgId),
    ))
    .limit(1);

  let capitalStackId: string;

  if (existing) {
    capitalStackId = existing.id;

    // Update existing capital stack
    await db.update(capitalStacks)
      .set({
        purchasePrice: purchasePrice.toString(),
        totalCapitalization: purchasePrice.toString(),
        totalDebt: totalDebt.toString(),
        totalEquity: totalEquity.toString(),
        blendedDebtRate: blendedRate.toFixed(4),
        ltv: ltv.toFixed(4),
        updatedAt: new Date(),
      })
      .where(eq(capitalStacks.id, capitalStackId));
  } else {
    // Create new capital stack
    const [newStack] = await db.insert(capitalStacks)
      .values({
        orgId,
        modelingProjectId: projectId,
        name: 'Auto-synced from Debt Inputs',
        status: 'active',
        purchasePrice: purchasePrice.toString(),
        totalCapitalization: purchasePrice.toString(),
        totalDebt: totalDebt.toString(),
        totalEquity: totalEquity.toString(),
        blendedDebtRate: blendedRate.toFixed(4),
        ltv: ltv.toFixed(4),
        isActive: true,
        createdBy: userId || null,
      })
      .returning();

    capitalStackId = newStack.id;
  }

  // 5. Delete all existing tranches for this capital stack (full replace)
  await db.delete(debtTranches)
    .where(eq(debtTranches.capitalStackId, capitalStackId));

  // 6. Insert new tranches from loans
  if (projectLoans.length > 0) {
    for (const loan of projectLoans) {
      const loanAmount = parseFloat(loan.loanAmount?.toString() || '0');
      const fixedRate = parseFloat(loan.fixedRate?.toString() || '0');
      const effectiveRate = loan.rateType === 'fixed'
        ? fixedRate
        : ((loan.initialIndexBps ?? 0) + (loan.spreadBps ?? 0)) / 10000;

      // Map loan type → tranche type
      const trancheTypeMap: Record<string, string> = {
        acquisition: 'senior',
        bridge: 'bridge',
        perm: 'senior',
      };
      const trancheType = loan.structure === 'mezz'
        ? 'mezzanine'
        : (trancheTypeMap[loan.loanType] || 'senior');

      await db.insert(debtTranches).values({
        orgId,
        capitalStackId,
        name: loan.loanName || `${loan.loanType} Loan`,
        trancheType: trancheType as any,
        principal: loanAmount.toString(),
        interestRate: (effectiveRate * 100).toFixed(4), // debtTranches stores as percentage (e.g. 6.50)
        spreadBps: loan.spreadBps ?? 0,
        indexRate: loan.rateType === 'floating' ? (loan.indexType || 'sofr') : null,
        floorRate: loan.indexFloorBps ? (loan.indexFloorBps / 10000).toFixed(4) : null,
        amortizationYears: Math.round(loan.amortMonths / 12),
        termYears: Math.round(loan.termMonths / 12),
        interestOnlyMonths: loan.interestOnlyMonths,
        originationFeePct: (loan.originationFeePct ?? '0.01').toString(),
        exitFeePct: (loan.exitFeePct ?? '0').toString(),
        prepaymentPenalty: loan.prepayType !== 'none' ? loan.prepayType : null,
        minDscr: null,
        maxLtv: null,
        priority: loan.ordinal,
        sortOrder: loan.ordinal - 1,
      });
    }
  }

  return { capitalStackId, trancheCount: projectLoans.length };
}

/**
 * Remove the capital stack's debt tranches when all loans are deleted.
 * Does NOT delete the capital stack itself (it may have equity layers).
 */
export async function clearDebtFromCapitalStack(
  projectId: string,
  orgId: string,
): Promise<void> {
  const [stack] = await db.select()
    .from(capitalStacks)
    .where(and(
      eq(capitalStacks.modelingProjectId, projectId),
      eq(capitalStacks.orgId, orgId),
    ))
    .limit(1);

  if (!stack) return;

  await db.delete(debtTranches)
    .where(eq(debtTranches.capitalStackId, stack.id));

  // Zero out debt metrics
  await db.update(capitalStacks)
    .set({
      totalDebt: '0',
      totalEquity: stack.purchasePrice, // equity = full purchase price
      blendedDebtRate: '0',
      ltv: '0',
      updatedAt: new Date(),
    })
    .where(eq(capitalStacks.id, stack.id));
}
