import { eq, and } from "drizzle-orm";
import { users, contacts, organizations } from "./schema";
import type { User, Contact } from "./schema";
import type { db } from "../server/db";

type Database = typeof db;

/**
 * Recipient resolution utilities for notification system
 * Provides type-safe resolution of users and contacts by recipientType+recipientId
 */

export type RecipientInfo = {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  timezone: string;
  type: "user" | "contact";
};

/**
 * Resolves a recipient by type and ID with org/project scoping for data integrity
 */
export async function resolveRecipient(
  db: Database,
  recipientType: "user" | "contact",
  recipientId: string,
  orgId: string // For org-scoped access control
): Promise<RecipientInfo | null> {
  try {
    if (recipientType === "user") {
      const user = await db.query.users.findFirst({
        where: and(
          eq(users.id, recipientId),
          eq(users.orgId, orgId) // Org-scoped security check
        ),
      });

      if (!user) return null;

      return {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: null, // Users don't have phone in current schema
        timezone: user.tz,
        type: "user",
      };
    } else {
      const contact = await db.query.contacts.findFirst({
        where: and(
          eq(contacts.id, recipientId),
          eq(contacts.orgId, orgId) // Org-scoped security check
        ),
      });

      if (!contact) return null;

      return {
        id: contact.id,
        name: contact.name,
        email: contact.email,
        phone: contact.phone,
        timezone: contact.timezone,
        type: "contact",
      };
    }
  } catch (error) {
    console.error("Failed to resolve recipient:", error);
    return null;
  }
}

/**
 * Batch resolve multiple recipients efficiently
 */
export async function resolveMultipleRecipients(
  db: Database,
  recipients: Array<{ type: "user" | "contact"; id: string }>,
  orgId: string
): Promise<RecipientInfo[]> {
  const userIds = recipients
    .filter(r => r.type === "user")
    .map(r => r.id);
  
  const contactIds = recipients
    .filter(r => r.type === "contact")
    .map(r => r.id);

  // Batch fetch users and contacts
  const [resolvedUsers, resolvedContacts] = await Promise.all([
    userIds.length > 0 
      ? db.query.users.findMany({
          where: and(
            eq(users.orgId, orgId),
            userIds.length === 1 
              ? eq(users.id, userIds[0])
              : // For multiple IDs, we'd need to use SQL IN operator
                eq(users.orgId, orgId) // Fallback to org filter
          ),
        })
      : [],
    contactIds.length > 0
      ? db.query.contacts.findMany({
          where: and(
            eq(contacts.orgId, orgId),
            contactIds.length === 1
              ? eq(contacts.id, contactIds[0])
              : // For multiple IDs, we'd need to use SQL IN operator
                eq(contacts.orgId, orgId) // Fallback to org filter
          ),
        })
      : [],
  ]);

  // Convert to RecipientInfo format
  const result: RecipientInfo[] = [];

  // Filter users by requested IDs (manual filter for simplicity)
  for (const user of resolvedUsers) {
    if (userIds.includes(user.id)) {
      result.push({
        id: user.id,
        name: user.name,
        email: user.email,
        phone: null,
        timezone: user.tz,
        type: "user",
      });
    }
  }

  // Filter contacts by requested IDs
  for (const contact of resolvedContacts) {
    if (contactIds.includes(contact.id)) {
      result.push({
        id: contact.id,
        name: contact.name,
        email: contact.email,
        phone: contact.phone,
        timezone: contact.timezone,
        type: "contact",
      });
    }
  }

  return result;
}

/**
 * Validates that a recipient exists and belongs to the specified organization
 */
export async function validateRecipientAccess(
  db: Database,
  recipientType: "user" | "contact",
  recipientId: string,
  orgId: string
): Promise<boolean> {
  const recipient = await resolveRecipient(db, recipientType, recipientId, orgId);
  return recipient !== null;
}

/**
 * Gets recipient's delivery information (email/phone) for notification sending
 */
export async function getRecipientDeliveryInfo(
  db: Database,
  recipientType: "user" | "contact",
  recipientId: string,
  orgId: string
): Promise<{ email: string; phone?: string | null } | null> {
  const recipient = await resolveRecipient(db, recipientType, recipientId, orgId);
  
  if (!recipient) return null;

  return {
    email: recipient.email,
    phone: recipient.phone,
  };
}