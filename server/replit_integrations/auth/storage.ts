import { users, type User } from "@shared/schema";
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
    const existingUser = await db.select().from(users).where(eq(users.id, userData.id));
    
    if (existingUser.length > 0) {
      const [user] = await db
        .update(users)
        .set({
          email: userData.email ?? existingUser[0].email,
          name: userData.firstName && userData.lastName 
            ? `${userData.firstName} ${userData.lastName}` 
            : existingUser[0].name,
        })
        .where(eq(users.id, userData.id))
        .returning();
      return user;
    } else {
      const [user] = await db
        .insert(users)
        .values({
          id: userData.id,
          orgId: 'org-1',
          email: userData.email ?? '',
          name: userData.firstName && userData.lastName 
            ? `${userData.firstName} ${userData.lastName}` 
            : userData.email ?? 'User',
          role: 'viewer',
          isActive: true,
        })
        .returning();
      return user;
    }
  }
}

export const authStorage = new AuthStorage();
