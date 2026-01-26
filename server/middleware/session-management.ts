/**
 * Session Management Fixes
 * Ensures sessions are invalidated on security events (password reset, etc.)
 */

import { db } from '../db';
import { userSessions } from '../../shared/schema';
import { eq, and, lt } from 'drizzle-orm';

/**
 * Invalidate all sessions for a user
 * Use when: password reset, account security breach, user requests logout from all devices
 */
export async function invalidateAllUserSessions(userId: number): Promise<{
  success: boolean;
  sessionsDeleted: number;
  error?: string;
}> {
  try {
    const result = await db.delete(userSessions)
      .where(eq(userSessions.userId, userId))
      .returning();
    
    console.log(`Invalidated ${result.length} session(s) for user ${userId}`);
    
    return {
      success: true,
      sessionsDeleted: result.length
    };
  } catch (error: any) {
    console.error('Error invalidating user sessions:', error);
    return {
      success: false,
      sessionsDeleted: 0,
      error: error.message
    };
  }
}

/**
 * Invalidate a specific session by token
 */
export async function invalidateSession(sessionToken: string): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    await db.delete(userSessions)
      .where(eq(userSessions.sessionToken, sessionToken));
    
    return { success: true };
  } catch (error: any) {
    console.error('Error invalidating session:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Clean up expired sessions
 * Should be run periodically (e.g., every hour)
 */
export async function cleanupExpiredSessions(): Promise<{
  success: boolean;
  sessionsDeleted: number;
  error?: string;
}> {
  try {
    const now = new Date();
    const result = await db.delete(userSessions)
      .where(lt(userSessions.expiresAt, now))
      .returning();
    
    if (result.length > 0) {
      console.log(`Cleaned up ${result.length} expired session(s)`);
    }
    
    return {
      success: true,
      sessionsDeleted: result.length
    };
  } catch (error: any) {
    console.error('Error cleaning up expired sessions:', error);
    return {
      success: false,
      sessionsDeleted: 0,
      error: error.message
    };
  }
}

/**
 * Get active sessions for a user (for "logout all devices" feature)
 */
export async function getUserActiveSessions(userId: number): Promise<Array<{
  id: number;
  createdAt: Date;
  expiresAt: Date;
  lastActivityAt?: Date;
}>> {
  try {
    const sessions = await db.select({
      id: userSessions.id,
      createdAt: userSessions.createdAt,
      expiresAt: userSessions.expiresAt,
      lastActivityAt: userSessions.lastActivityAt
    })
    .from(userSessions)
    .where(
      and(
        eq(userSessions.userId, userId),
        lt(new Date(), userSessions.expiresAt)
      )
    )
    .orderBy(userSessions.createdAt);
    
    return sessions;
  } catch (error) {
    console.error('Error getting user sessions:', error);
    return [];
  }
}

/**
 * Patch for auth routes - add to server/routes/auth-routes.ts
 * 
 * Add this to your password reset endpoint:
 * 
 * router.post('/reset-password', async (req, res) => {
 *   const { token, newPassword } = req.body;
 *   
 *   // ... validate token, hash password ...
 *   
 *   // Update password
 *   await db.update(users)
 *     .set({ password: hashedPassword })
 *     .where(eq(users.id, userId));
 *   
 *   // ✅ ADD THIS: Invalidate all sessions
 *   await invalidateAllUserSessions(userId);
 *   
 *   res.json({ success: true, message: 'Password reset successfully. Please login again.' });
 * });
 * 
 * Also add to change password endpoint:
 * 
 * router.post('/change-password', authenticateUser, async (req, res) => {
 *   const { currentPassword, newPassword } = req.body;
 *   const userId = req.user.id;
 *   
 *   // ... verify current password, hash new password ...
 *   
 *   // Update password
 *   await db.update(users)
 *     .set({ password: hashedPassword })
 *     .where(eq(users.id, userId));
 *   
 *   // ✅ ADD THIS: Invalidate all OTHER sessions (keep current one)
 *   await db.delete(userSessions)
 *     .where(
 *       and(
 *         eq(userSessions.userId, userId),
 *         ne(userSessions.sessionToken, req.cookies.sessionToken)
 *       )
 *     );
 *   
 *   res.json({ success: true });
 * });
 */

/**
 * Log security event for session invalidation
 */
export async function logSessionSecurityEvent(event: {
  userId: number;
  eventType: 'password_reset' | 'logout_all' | 'security_breach' | 'account_deletion';
  ipAddress?: string;
  userAgent?: string;
}) {
  console.log('Session security event:', {
    timestamp: new Date().toISOString(),
    ...event
  });
  
  // TODO: Store in security_audit_log table
  // await db.insert(securityAuditLog).values({
  //   userId: event.userId,
  //   action: event.eventType,
  //   ipAddress: event.ipAddress,
  //   userAgent: event.userAgent,
  //   timestamp: new Date()
  // });
}
