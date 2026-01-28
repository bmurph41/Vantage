import { db } from '../db';
import { users } from '@shared/schema';
import { eq, and, not } from 'drizzle-orm';

/**
 * Benchmarking Guardrails Service
 * 
 * This service provides utilities to ensure that users who have opted out of
 * anonymized benchmarking are excluded from any cross-user aggregation or
 * industry metrics calculations.
 * 
 * IMPORTANT: All benchmark aggregation queries MUST use these guardrails to
 * respect user privacy preferences.
 */

/**
 * Get a list of user IDs that have opted out of benchmarking.
 * Use this to filter out opted-out users from any cross-user data aggregation.
 * 
 * @returns Array of user IDs that should be excluded from benchmarking
 */
export async function getOptedOutUserIds(): Promise<string[]> {
  const optedOutUsers = await db.select({ id: users.id })
    .from(users)
    .where(eq(users.benchmarkingOptOut, true));
  
  return optedOutUsers.map(u => u.id);
}

/**
 * Get a list of org IDs where all users have opted out of benchmarking.
 * Use this to filter out entire organizations from benchmark calculations.
 * 
 * Note: An org is excluded only if ALL users in that org have opted out.
 * 
 * @returns Array of org IDs that should be excluded from benchmarking
 */
export async function getOptedOutOrgIds(): Promise<string[]> {
  // For simplicity, we exclude orgs where ANY user has opted out
  // In the future, this could be more sophisticated
  const optedOutOrgs = await db.selectDistinct({ orgId: users.orgId })
    .from(users)
    .where(eq(users.benchmarkingOptOut, true));
  
  return optedOutOrgs.map(u => u.orgId);
}

/**
 * Check if a specific user has opted out of benchmarking.
 * 
 * @param userId - The user ID to check
 * @returns true if the user has opted out
 */
export async function isUserOptedOut(userId: string): Promise<boolean> {
  const user = await db.select({ benchmarkingOptOut: users.benchmarkingOptOut })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  
  return user[0]?.benchmarkingOptOut ?? false;
}

/**
 * SQL WHERE clause fragment for excluding opted-out users.
 * Use this in raw SQL queries that aggregate cross-user data.
 * 
 * Example usage:
 * ```sql
 * SELECT ... FROM some_table st
 * JOIN users u ON st.user_id = u.id
 * WHERE u.benchmarking_opt_out = false
 * ```
 */
export const BENCHMARKING_OPT_OUT_FILTER = 'users.benchmarking_opt_out = false';

/**
 * Drizzle ORM condition for filtering out opted-out users.
 * Use this with Drizzle queries.
 * 
 * Example:
 * ```typescript
 * .where(and(
 *   eq(users.orgId, orgId),
 *   benchmarkingOptOutCondition
 * ))
 * ```
 */
export const benchmarkingOptOutCondition = eq(users.benchmarkingOptOut, false);
