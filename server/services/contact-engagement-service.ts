import { db } from "../db";
import { crmContactEngagementScores, crmContacts, crmActivities, crmDeals, crmDealContacts } from "@shared/schema";
import { eq, and, desc, gte, count, sql } from "drizzle-orm";

export interface ContactEngagementScore {
  id: string;
  contactId: string;
  engagementScore: number;
  emailScore: number;
  meetingScore: number;
  callScore: number;
  dealInvolvementScore: number;
  recencyScore: number;
  responseScore: number;
  emailsOpened: number;
  emailsClicked: number;
  emailsSent: number;
  totalMeetings: number;
  totalCalls: number;
  dealsInvolved: number;
  lastEmailOpen: Date | null;
  lastEmailClick: Date | null;
  lastMeeting: Date | null;
  lastCall: Date | null;
  lastInteraction: Date | null;
  factors: Record<string, unknown>;
  lastCalculatedAt: Date;
}

export interface EmailActivity {
  totalSent: number;
  totalOpened: number;
  totalClicked: number;
  openRate: number;
  clickRate: number;
  lastEmailOpen: Date | null;
  lastEmailClick: Date | null;
  recentActivity: Array<{
    type: string;
    date: Date;
    subject?: string;
  }>;
}

export class ContactEngagementService {
  async getEngagementScore(contactId: string): Promise<ContactEngagementScore | null> {
    const [score] = await db
      .select()
      .from(crmContactEngagementScores)
      .where(eq(crmContactEngagementScores.contactId, contactId))
      .limit(1);

    if (!score) {
      await this.recalculateEngagementScore(contactId);
      const [newScore] = await db
        .select()
        .from(crmContactEngagementScores)
        .where(eq(crmContactEngagementScores.contactId, contactId))
        .limit(1);
      return newScore as ContactEngagementScore | null;
    }

    return score as ContactEngagementScore;
  }

  async recalculateEngagementScore(contactId: string): Promise<number> {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

    const [contact] = await db
      .select()
      .from(crmContacts)
      .where(eq(crmContacts.id, contactId))
      .limit(1);

    if (!contact) return 0;

    const activities = await db
      .select()
      .from(crmActivities)
      .where(
        and(
          eq(crmActivities.contactId, contactId),
          gte(crmActivities.createdAt, ninetyDaysAgo)
        )
      )
      .orderBy(desc(crmActivities.createdAt));

    const emails = activities.filter(a => a.type === "email");
    const meetings = activities.filter(a => a.type === "meeting");
    const calls = activities.filter(a => a.type === "call");

    const emailsOpened = emails.filter(a => 
      (a.metadata as any)?.opened === true || 
      (a.metadata as any)?.status === "opened"
    ).length;
    const emailsClicked = emails.filter(a => 
      (a.metadata as any)?.clicked === true || 
      (a.metadata as any)?.status === "clicked"
    ).length;

    let emailScore = 0;
    if (emails.length > 0) {
      const openRate = emailsOpened / emails.length;
      const clickRate = emailsClicked / emails.length;
      emailScore = Math.min(Math.round((openRate * 15) + (clickRate * 10)), 25);
    }

    const meetingScore = Math.min(meetings.length * 10, 25);

    const callScore = Math.min(calls.length * 5, 15);

    const dealContacts = await db
      .select()
      .from(crmDealContacts)
      .where(eq(crmDealContacts.contactId, contactId));
    const dealsInvolved = dealContacts.length;
    const dealInvolvementScore = Math.min(dealsInvolved * 5, 15);

    let recencyScore = 0;
    if (activities.length > 0) {
      const mostRecent = activities[0];
      const daysSinceActivity = Math.floor(
        (Date.now() - new Date(mostRecent.createdAt).getTime()) / (1000 * 60 * 60 * 24)
      );
      if (daysSinceActivity <= 3) recencyScore = 20;
      else if (daysSinceActivity <= 7) recencyScore = 15;
      else if (daysSinceActivity <= 14) recencyScore = 10;
      else if (daysSinceActivity <= 30) recencyScore = 5;
    }

    const responseScore = 0;

    const engagementScore = emailScore + meetingScore + callScore + dealInvolvementScore + recencyScore + responseScore;

    const lastEmailOpen = emails.find(a => (a.metadata as any)?.opened)?.createdAt || null;
    const lastEmailClick = emails.find(a => (a.metadata as any)?.clicked)?.createdAt || null;
    const lastMeeting = meetings[0]?.createdAt || null;
    const lastCall = calls[0]?.createdAt || null;
    const lastInteraction = activities[0]?.createdAt || null;

    const factors = {
      emailCount: emails.length,
      meetingCount: meetings.length,
      callCount: calls.length,
      dealsInvolved,
      emailOpenRate: emails.length > 0 ? emailsOpened / emails.length : 0,
      emailClickRate: emails.length > 0 ? emailsClicked / emails.length : 0,
    };

    const existing = await db
      .select()
      .from(crmContactEngagementScores)
      .where(eq(crmContactEngagementScores.contactId, contactId))
      .limit(1);

    if (existing.length > 0) {
      await db
        .update(crmContactEngagementScores)
        .set({
          engagementScore,
          emailScore,
          meetingScore,
          callScore,
          dealInvolvementScore,
          recencyScore,
          responseScore,
          emailsOpened,
          emailsClicked,
          emailsSent: emails.length,
          totalMeetings: meetings.length,
          totalCalls: calls.length,
          dealsInvolved,
          lastEmailOpen,
          lastEmailClick,
          lastMeeting,
          lastCall,
          lastInteraction,
          factors,
          lastCalculatedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(crmContactEngagementScores.contactId, contactId));
    } else {
      await db.insert(crmContactEngagementScores).values({
        contactId,
        engagementScore,
        emailScore,
        meetingScore,
        callScore,
        dealInvolvementScore,
        recencyScore,
        responseScore,
        emailsOpened,
        emailsClicked,
        emailsSent: emails.length,
        totalMeetings: meetings.length,
        totalCalls: calls.length,
        dealsInvolved,
        lastEmailOpen,
        lastEmailClick,
        lastMeeting,
        lastCall,
        lastInteraction,
        factors,
      });
    }

    return engagementScore;
  }

  async getEmailActivity(contactId: string): Promise<EmailActivity> {
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

    const activities = await db
      .select()
      .from(crmActivities)
      .where(
        and(
          eq(crmActivities.contactId, contactId),
          eq(crmActivities.type, "email"),
          gte(crmActivities.createdAt, ninetyDaysAgo)
        )
      )
      .orderBy(desc(crmActivities.createdAt));

    const totalSent = activities.length;
    const totalOpened = activities.filter(a => 
      (a.metadata as any)?.opened === true || 
      (a.metadata as any)?.status === "opened" ||
      (a.metadata as any)?.status === "clicked"
    ).length;
    const totalClicked = activities.filter(a => 
      (a.metadata as any)?.clicked === true || 
      (a.metadata as any)?.status === "clicked"
    ).length;

    const openRate = totalSent > 0 ? Math.round((totalOpened / totalSent) * 100) : 0;
    const clickRate = totalSent > 0 ? Math.round((totalClicked / totalSent) * 100) : 0;

    const openedEmails = activities.filter(a => (a.metadata as any)?.opened);
    const clickedEmails = activities.filter(a => (a.metadata as any)?.clicked);

    const lastEmailOpen = openedEmails.length > 0 ? openedEmails[0].createdAt : null;
    const lastEmailClick = clickedEmails.length > 0 ? clickedEmails[0].createdAt : null;

    const recentActivity = activities.slice(0, 10).map(a => ({
      type: (a.metadata as any)?.clicked ? "click" : 
            (a.metadata as any)?.opened ? "open" : "sent",
      date: a.createdAt,
      subject: (a.metadata as any)?.subject || a.description || undefined,
    }));

    return {
      totalSent,
      totalOpened,
      totalClicked,
      openRate,
      clickRate,
      lastEmailOpen,
      lastEmailClick,
      recentActivity,
    };
  }
}

export const contactEngagementService = new ContactEngagementService();
