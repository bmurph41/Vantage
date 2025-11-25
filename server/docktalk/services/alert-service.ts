import { storage } from "../storage";
import type { SavedSearch, Article } from "@shared/docktalk-schema";
import { getUncachableResendClient } from "../lib/resend-client";
import { toZonedTime, format as formatTZ } from "date-fns-tz";

export interface AlertNotification {
  searchId: string;
  searchName: string;
  userId: string;
  articles: Article[];
  newCount: number;
}

export async function checkAndSendAlerts(frequency: "immediate" | "daily" | "weekly"): Promise<void> {
  try {
    
    const searches = await storage.getActiveSearchesForAlerts(frequency);
    
    if (searches.length === 0) {
      return;
    }

    
    let processedCount = 0;

    for (const search of searches) {
      try {
        // For daily/weekly alerts, check if it's the right time in user's timezone
        if (frequency === "daily" || frequency === "weekly") {
          const shouldSend = await shouldSendAlertNow(search.userId, frequency);
          if (!shouldSend) {
            continue;
          }
        }
        
        await processSearchAlert(search);
        processedCount++;
      } catch (error) {
        console.error(`Error processing alert for search ${search.id}:`, error);
      }
    }

  } catch (error) {
    console.error(`Error checking ${frequency} alerts:`, error);
  }
}

async function shouldSendAlertNow(userId: string, frequency: "daily" | "weekly"): Promise<boolean> {
  try {
    const preferences = await storage.getUserNotificationPreferences(userId);
    if (!preferences) {
      return false;
    }

    const timezone = preferences.timezone || "America/New_York";
    const deliveryTime = preferences.deliveryTime || "09:00";
    
    // Get current time in user's timezone
    const now = new Date();
    const userLocalTime = toZonedTime(now, timezone);
    const currentHour = userLocalTime.getHours();
    const currentMinute = userLocalTime.getMinutes();
    
    // Parse delivery time (HH:mm format)
    const [targetHour, targetMinute] = deliveryTime.split(':').map(Number);
    
    // Check if we're within ±7 minutes of target time (cron runs every 15 min)
    const currentMinutes = currentHour * 60 + currentMinute;
    const targetMinutes = targetHour * 60 + targetMinute;
    const diff = Math.abs(currentMinutes - targetMinutes);
    
    // Handle midnight wrap-around (e.g., 23:55 vs 00:05)
    const dayMinutes = 24 * 60;
    const wrapDiff = Math.min(diff, dayMinutes - diff);
    
    const isWithinWindow = wrapDiff <= 7;
    
    // For weekly, check if it's Monday in user's timezone
    // Also allow Tuesday early morning ONLY for late Monday wrap-around (prevents duplicates)
    if (frequency === "weekly") {
      const dayOfWeek = userLocalTime.getDay();
      
      if (dayOfWeek === 1) {
        // Currently Monday - proceed with time check below
      } else if (dayOfWeek === 2 && currentHour === 0 && targetMinutes >= (24 * 60 - 7) && wrapDiff <= 7) {
        // Currently Tuesday early morning (00:00-00:14) AND target is late Monday (23:53-23:59)
        // This handles ONLY late Monday wrap-around, preventing duplicates for early Monday (00:00-00:07)
      } else {
        // Not Monday and not the late Monday edge case
        return false;
      }
    }
    
    if (isWithinWindow) {
    }
    
    return isWithinWindow;
  } catch (error) {
    console.error(`Error checking alert timing for user ${userId}:`, error);
    return false;
  }
}

async function processSearchAlert(search: SavedSearch): Promise<void> {
  const criteria = search.criteria as any;
  
  // For testing: Use last 3 weeks instead of just new articles
  const threeWeeksAgo = new Date();
  threeWeeksAgo.setDate(threeWeeksAgo.getDate() - 21);
  const sinceDate = threeWeeksAgo; // Temporarily override to get last 3 weeks
  // const sinceDate = search.lastAlertSent || search.createdAt; // Normal behavior

  // Pass userId for future tenant scoping enforcement
  const articles = await storage.getArticles(search.userId, {
    ...criteria,
    fromDate: sinceDate ? new Date(sinceDate) : undefined,
    limit: 50,
    sortBy: "newest",
  });

  if (articles.length === 0) {
    return;
  }

  const notification: AlertNotification = {
    searchId: search.id,
    searchName: search.name,
    userId: search.userId,
    articles,
    newCount: articles.length,
  };

  await sendNotification(notification, search);
  
  await storage.updateLastAlertSent(search.id);
  
}

async function sendNotification(notification: AlertNotification, search: SavedSearch): Promise<void> {
  notification.articles.slice(0, 3).forEach((article, idx) => {
  });

  // Get user for email address
  const user = await storage.getUser(notification.userId);
  if (!user) {
    console.error(`User ${notification.userId} not found`);
    return;
  }

  // Get notification preferences to check if email is configured and enabled
  // Note: getUserNotificationPreferences may require orgId, but for alerts we check globally
  const preferences = await storage.getUserNotificationPreferences(notification.userId);
  // Check that emails are enabled AND email address is configured
  const shouldSendEmail = preferences?.enabled !== false && preferences?.emailAddress;

  let deliveryMethod: "console" | "email" = "console";
  let deliveryStatus: "sent" | "failed" = "sent";

  // Try to send email if configured
  if (shouldSendEmail && preferences?.emailAddress) {
    try {
      const { client, fromEmail } = await getUncachableResendClient();
      
      // Build email HTML
      const articlesHtml = notification.articles.slice(0, 10).map(article => `
        <div style="margin-bottom: 20px; padding-bottom: 20px; border-bottom: 1px solid #eee;">
          <h3 style="margin: 0 0 8px 0; color: #1a1a1a;">
            <a href="${article.url}" style="color: #0066cc; text-decoration: none;">${article.title}</a>
          </h3>
          <p style="margin: 0; color: #666; font-size: 14px;">
            ${article.source} • ${article.publishedAt ? new Date(article.publishedAt).toLocaleDateString() : 'Unknown date'} • ${article.category || 'General'}
          </p>
          ${article.summary ? `<p style="margin: 8px 0 0 0; color: #333;">${article.summary.substring(0, 200)}${article.summary.length > 200 ? '...' : ''}</p>` : ''}
        </div>
      `).join('');

      await client.emails.send({
        from: fromEmail,
        to: preferences.emailAddress,
        subject: `DockTalk Alert: ${notification.searchName} (${notification.newCount} new article${notification.newCount > 1 ? 's' : ''})`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background-color: #003366; color: white; padding: 20px; text-align: center;">
              <h1 style="margin: 0;">⚓ DockTalk 2.0</h1>
              <p style="margin: 5px 0 0 0; opacity: 0.9;">Marina Industry Intelligence</p>
            </div>
            
            <div style="padding: 30px 20px;">
              <h2 style="color: #003366; margin-top: 0;">Alert: ${notification.searchName}</h2>
              <p style="color: #666; font-size: 16px; margin-bottom: 30px;">
                ${notification.newCount} new article${notification.newCount > 1 ? 's' : ''} matching your saved search criteria.
              </p>
              
              ${articlesHtml}
              
              ${notification.newCount > 10 ? `
                <p style="text-align: center; color: #666; margin-top: 20px;">
                  + ${notification.newCount - 10} more article${notification.newCount - 10 > 1 ? 's' : ''}
                </p>
              ` : ''}
            </div>
            
            <div style="background-color: #f5f5f5; padding: 20px; text-align: center; font-size: 12px; color: #666;">
              <p style="margin: 0;">You're receiving this because you have an active alert for "${notification.searchName}"</p>
              <p style="margin: 10px 0 0 0;">Manage your notification preferences in DockTalk settings</p>
            </div>
          </div>
        `,
      });

      deliveryMethod = "email";
      deliveryStatus = "sent";
    } catch (error) {
      console.error(`Failed to send email:`, error);
      deliveryMethod = "email";
      deliveryStatus = "failed";
    }
  }

  // Persist notification record
  try {
    await storage.createNotification({
      userId: notification.userId,
      source: "saved_search",
      savedSearchId: notification.searchId,
      articleSnapshot: notification.articles.slice(0, 10).map(a => ({
        id: a.id,
        title: a.title,
        source: a.source,
        publishedAt: a.publishedAt,
      })),
      articleIds: notification.articles.map(a => a.id.toString()),
      articleCount: notification.newCount,
      frequency: search.alertFrequency,
      message: `${notification.newCount} new article${notification.newCount > 1 ? 's' : ''} for "${notification.searchName}"`,
      deliveryMethod,
      deliveryStatus,
    });
  } catch (error) {
    console.error(`Failed to persist notification:`, error);
  }
}

export async function processImmediateAlerts(): Promise<void> {
  await checkAndSendAlerts("immediate");
}

export async function processDailyAlerts(): Promise<void> {
  await checkAndSendAlerts("daily");
}

export async function processWeeklyAlerts(): Promise<void> {
  await checkAndSendAlerts("weekly");
}
