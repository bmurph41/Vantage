import { users, organizations, type User } from "@shared/schema";
import { db } from "../../db";
import { eq } from "drizzle-orm";

export interface IAuthStorage {
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: { id: string; email?: string | null; firstName?: string | null; lastName?: string | null; profileImageUrl?: string | null }): Promise<User>;
}

class AuthStorage implements IAuthStorage {
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async upsertUser(userData: { id: string; email?: string | null; firstName?: string | null; lastName?: string | null; profileImageUrl?: string | null }): Promise<User> {
    const displayName = userData.firstName && userData.lastName
      ? `${userData.firstName} ${userData.lastName}`
      : userData.email ?? 'User';

    // Case 1: Returning Replit OAuth user — update profile, return existing
    const [existingById] = await db.select().from(users).where(eq(users.id, userData.id));
    if (existingById) {
      const [user] = await db
        .update(users)
        .set({
          email: userData.email ?? existingById.email,
          name: displayName || existingById.name,
        })
        .where(eq(users.id, userData.id))
        .returning();
      return user;
    }

    // Case 2: Email matches an existing invited user — link their account, return them
    if (userData.email) {
      const [existingByEmail] = await db.select().from(users).where(eq(users.email, userData.email));
      if (existingByEmail) {
        // Update name if not already set; keep their orgId and role
        const [user] = await db
          .update(users)
          .set({ name: displayName || existingByEmail.name })
          .where(eq(users.id, existingByEmail.id))
          .returning();
        return user;
      }
    }

    // Case 3: Brand-new user — create a dedicated org and set them as owner
    const orgName = userData.firstName
      ? `${userData.firstName}${userData.lastName ? ' ' + userData.lastName : ''}'s Organization`
      : (userData.email ? userData.email.split('@')[0] + "'s Organization" : 'My Organization');

    const [newOrg] = await db
      .insert(organizations)
      .values({ name: orgName })
      .returning();

    const [user] = await db
      .insert(users)
      .values({
        id: userData.id,
        orgId: newOrg.id,
        email: userData.email ?? '',
        name: displayName,
        role: 'owner',
        isActive: true,
      })
      .returning();

    return user;
  }
}

export const authStorage = new AuthStorage();
