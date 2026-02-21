import { storage } from "../storage";
import type { SavedSearch, Article } from "@shared/docktalk-schema";
import { getUncachableResendClient } from "../lib/resend-client";
import { toZonedTime } from "date-fns-tz";

export interface AlertNotification {
  searchId: string;
  searchName: string;
  userId: string;
  articles: Article[];
  newCount: number;
}

export async function processNewArticlesForAlerts(): Promise<void> {
  try {
    const searches = await storage.getActiveSearchesForAlerts("immediate");

    if (searches.length === 0) {
      return;
    }

    let processedCount = 0;

    for (const search of searches) {
      try {
        await processSearchAlert(search);
        processedCount++;
      } catch (error) {
        console.error(`[Alerts] Error processing alert for search ${search.id}:`, error);
      }
    }

    if (processedCount > 0) {
      console.log(`[Alerts] Processed ${processedCount} instant alert(s)`);
    }
  } catch (error) {
    console.error(`[Alerts] Error processing instant alerts:`, error);
  }
}

export async function processDailyAlerts(): Promise<void> {
  await processScheduledAlerts("daily");
}

export async function processWeeklyAlerts(): Promise<void> {
  await processScheduledAlerts("weekly");
}

async function processScheduledAlerts(frequency: "daily" | "weekly"): Promise<void> {
  try {
    const searches = await storage.getActiveSearchesForAlerts(frequency);

    if (searches.length === 0) {
      return;
    }

    let processedCount = 0;

    for (const search of searches) {
      try {
        const shouldSend = await shouldSendAlertNow(search, frequency);
        if (!shouldSend) {
          continue;
        }
        await processSearchAlert(search);
        processedCount++;
      } catch (error) {
        console.error(`[Alerts] Error processing ${frequency} alert for search ${search.id}:`, error);
      }
    }

    if (processedCount > 0) {
      console.log(`[Alerts] Processed ${processedCount} ${frequency} alert(s)`);
    }
  } catch (error) {
    console.error(`[Alerts] Error processing ${frequency} alerts:`, error);
  }
}

async function shouldSendAlertNow(search: SavedSearch, frequency: "daily" | "weekly"): Promise<boolean> {
  try {
    let timezone = (search as any).timezone;
    let deliveryTime = (search as any).deliveryTime;

    if (!timezone || !deliveryTime) {
      const preferences = await storage.getUserNotificationPreferences(search.userId);
      if (!preferences) {
        return false;
      }
      timezone = timezone || preferences.timezone || "America/New_York";
      deliveryTime = deliveryTime || preferences.deliveryTime || "09:00";
    }

    const now = new Date();
    const userLocalTime = toZonedTime(now, timezone);
    const currentHour = userLocalTime.getHours();
    const currentMinute = userLocalTime.getMinutes();

    const [targetHour, targetMinute] = deliveryTime.split(':').map(Number);

    const currentMinutes = currentHour * 60 + currentMinute;
    const targetMinutes = targetHour * 60 + targetMinute;
    const diff = Math.abs(currentMinutes - targetMinutes);

    const dayMinutes = 24 * 60;
    const wrapDiff = Math.min(diff, dayMinutes - diff);

    const isWithinWindow = wrapDiff <= 7;

    if (frequency === "weekly") {
      const dayOfWeek = userLocalTime.getDay();
      if (dayOfWeek !== 1) {
        return false;
      }
    }

    return isWithinWindow;
  } catch (error) {
    console.error(`[Alerts] Error checking alert timing for search ${search.id}:`, error);
    return false;
  }
}

async function processSearchAlert(search: SavedSearch): Promise<void> {
  const criteria = search.criteria as any;

  const sinceDate = search.lastAlertSent
    ? new Date(search.lastAlertSent)
    : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const articles = await storage.getArticles(search.userId, {
    ...criteria,
    fromDate: sinceDate,
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
  const user = await storage.getUser(notification.userId);
  if (!user) {
    console.error(`[Alerts] User ${notification.userId} not found`);
    return;
  }

  const preferences = await storage.getUserNotificationPreferences(notification.userId);
  const shouldSendEmail = preferences?.enabled !== false && preferences?.emailAddress;

  let deliveryMethod: "console" | "email" = "console";
  let deliveryStatus: "sent" | "failed" = "sent";

  if (shouldSendEmail && preferences?.emailAddress) {
    try {
      const { client, fromEmail } = await getUncachableResendClient();

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
        subject: `The Docket Alert: ${notification.searchName} (${notification.newCount} new article${notification.newCount > 1 ? 's' : ''})`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background-color: #003366; color: white; padding: 20px; text-align: center;">
              <h1 style="margin: 0;">⚓ The Docket</h1>
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
              <p style="margin: 10px 0 0 0;">Manage your notification preferences in The Docket settings</p>
            </div>
          </div>
        `,
      });

      deliveryMethod = "email";
      deliveryStatus = "sent";
    } catch (error) {
      console.error(`[Alerts] Failed to send email:`, error);
      deliveryMethod = "email";
      deliveryStatus = "failed";
    }
  }

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
      frequency: search.alertFrequency || "immediate",
      message: `${notification.newCount} new article${notification.newCount > 1 ? 's' : ''} for "${notification.searchName}"`,
      deliveryMethod,
      deliveryStatus,
    });
  } catch (error) {
    console.error(`[Alerts] Failed to persist notification:`, error);
  }
}

export async function sendNewSearchRecap(searchId: string, userId: string, orgId: string): Promise<{ sent: boolean; articleCount: number; error?: string }> {
  try {
    const search = await storage.getSavedSearchById(searchId, userId, orgId);
    if (!search) {
      return { sent: false, articleCount: 0, error: "Search not found" };
    }

    const preferences = await storage.getUserNotificationPreferences(userId);
    if (!preferences?.enabled || !preferences?.emailAddress) {
      console.log(`[Alerts] Skipping recap for search ${searchId} - email notifications not configured`);
      return { sent: false, articleCount: 0, error: "Email notifications not configured" };
    }

    const criteria = search.criteria as any;

    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const articles = await storage.getArticles(userId, {
      ...criteria,
      fromDate: sevenDaysAgo,
      limit: 100,
      sortBy: "newest",
    });

    if (articles.length === 0) {
      console.log(`[Alerts] No matching articles in last 7 days for search ${searchId} - skipping email`);
      return { sent: false, articleCount: 0, error: "No matching articles in last 7 days" };
    }

    const { client, fromEmail } = await getUncachableResendClient();

    const articlesHtml = articles.slice(0, 15).map(article => `
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
      subject: `The Docket 7-Day Recap: ${search.name} (${articles.length} article${articles.length > 1 ? 's' : ''})`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background-color: #003366; color: white; padding: 20px; text-align: center;">
            <h1 style="margin: 0;">⚓ The Docket</h1>
            <p style="margin: 5px 0 0 0; opacity: 0.9;">Marina Industry Intelligence</p>
          </div>
          
          <div style="padding: 30px 20px;">
            <div style="background-color: #e8f4fc; border-left: 4px solid #0066cc; padding: 15px; margin-bottom: 25px;">
              <h2 style="color: #003366; margin: 0 0 8px 0;">7-Day Recap</h2>
              <p style="margin: 0; color: #555;">
                Welcome! Here are all articles from the past 7 days matching your new search "<strong>${search.name}</strong>".
              </p>
            </div>
            
            <p style="color: #666; font-size: 16px; margin-bottom: 30px;">
              ${articles.length} article${articles.length > 1 ? 's' : ''} found matching your criteria.
            </p>
            
            ${articlesHtml}
            
            ${articles.length > 15 ? `
              <p style="text-align: center; color: #666; margin-top: 20px;">
                + ${articles.length - 15} more article${articles.length - 15 > 1 ? 's' : ''} (view in The Docket)
              </p>
            ` : ''}
          </div>
          
          <div style="background-color: #f5f5f5; padding: 20px; text-align: center; font-size: 12px; color: #666;">
            <p style="margin: 0;">This is a one-time recap for your new saved search "${search.name}"</p>
            <p style="margin: 10px 0 0 0;">Future alerts will be sent based on your chosen frequency.</p>
          </div>
        </div>
      `,
    });

    await storage.markFirstAlertSent(searchId);
    await storage.updateLastAlertSent(searchId);

    await storage.createNotification({
      userId: userId,
      source: "saved_search",
      savedSearchId: searchId,
      articleSnapshot: articles.slice(0, 15).map(a => ({
        id: a.id,
        title: a.title,
        source: a.source,
        publishedAt: a.publishedAt,
      })),
      articleIds: articles.map(a => a.id.toString()),
      articleCount: articles.length,
      frequency: "recap",
      message: `7-Day Recap for "${search.name}": ${articles.length} article${articles.length > 1 ? 's' : ''} found`,
      deliveryMethod: "email",
      deliveryStatus: "sent",
    });

    console.log(`[Alerts] Sent 7-day recap for search ${searchId}: ${articles.length} articles`);
    return { sent: true, articleCount: articles.length };
  } catch (error) {
    console.error(`[Alerts] Error sending recap for search ${searchId}:`, error);
    return { sent: false, articleCount: 0, error: String(error) };
  }
}
