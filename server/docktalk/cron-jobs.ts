import cron from "node-cron";
import { fetchRssFeeds, initializeDefaultRssSources } from "./services/rss-fetcher";
import { IStorage } from "./storage";
import { processImmediateAlerts, processDailyAlerts, processWeeklyAlerts } from "./services/alert-service";
import { generateAllCategorySummaries } from "./services/category-summary-service";

let isInitialized = false;
let dockTalkStorage: IStorage;

export function startDockTalkCronJobs(storage: IStorage): void {
  dockTalkStorage = storage;
  if (isInitialized) return;
  
  // Skip cron jobs in development mode to prevent API rate limiting and improve stability
  const isDevelopment = process.env.NODE_ENV === 'development';
  if (isDevelopment) {
    console.log('DockTalk cron jobs disabled in development mode (use manual fetch if needed)');
    isInitialized = true;
    return;
  }
  
  // Initialize default RSS sources asynchronously (non-blocking)
  setImmediate(() => {
    initializeDefaultRssSources().catch(console.error);
  });
  
  // Schedule RSS fetching every 15 minutes for real-time updates
  const cronSchedule = process.env.CRON_SCHEDULE || "*/15 * * * *";
  
  cron.schedule(cronSchedule, async () => {
    try {
      const newArticles = await fetchRssFeeds();
      await updateSystemStats(newArticles);
      
      // Process immediate alerts after successful RSS fetch (when new articles exist)
      if (newArticles > 0) {
        await processImmediateAlerts();
      }
    } catch (error) {
      console.error("❌ CRON error:", error);
    }
  });

  // Update analytics at :05, :35 past each hour (offset from RSS fetch at :00, :30)
  cron.schedule("5,35 * * * *", async () => {
    try {
      await updateAnalytics();
    } catch (error) {
      console.error("Analytics update error:", error);
    }
  });

  // Process daily alerts at :10, :40 past each hour (offset from analytics)
  cron.schedule("10,40 * * * *", async () => {
    try {
      await processDailyAlerts();
    } catch (error) {
      console.error("Daily alerts error:", error);
    }
  });

  // Process weekly alerts at :15, :45 past each hour (offset from daily alerts)
  // Running all week ensures western timezones (Pacific/Honolulu) Monday evenings are covered
  cron.schedule("15,45 * * * *", async () => {
    try {
      await processWeeklyAlerts();
    } catch (error) {
      console.error("Weekly alerts error:", error);
    }
  });

  // Cleanup old articles (older than 1 year, excluding bookmarked) daily at 2 AM
  cron.schedule("0 2 * * *", async () => {
    try {
      await cleanupOldArticles();
    } catch (error) {
      console.error("Cleanup error:", error);
    }
  });

  // Generate daily AI summaries at midnight every day
  cron.schedule("0 0 * * *", async () => {
    try {
      const summaries = await generateAllCategorySummaries("daily");
    } catch (error) {
      console.error("❌ Daily summary generation error:", error);
    }
  });

  // Generate weekly AI summaries every Monday at midnight
  cron.schedule("0 0 * * 1", async () => {
    try {
      const summaries = await generateAllCategorySummaries("weekly");
    } catch (error) {
      console.error("❌ Weekly summary generation error:", error);
    }
  });

  isInitialized = true;
}

export async function triggerManualFetch(): Promise<number> {
  try {
    const newArticles = await fetchRssFeeds();
    await updateSystemStats(newArticles);
    return newArticles;
  } catch (error) {
    console.error("❌ Manual fetch error:", error);
    throw error;
  }
}

async function updateSystemStats(newArticles: number): Promise<void> {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Get today's articles
    const todayArticles = await dockTalkStorage.getArticles(null, {
      fromDate: today,
      limit: 1000
    });

    // Get total articles count
    const allArticles = await dockTalkStorage.getArticles(null, { limit: 1 });
    
    // Calculate average relevance
    const recentArticles = await dockTalkStorage.getArticles(null, {
      fromDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Last 7 days
      limit: 1000
    });
    
    const avgRelevance = recentArticles.length > 0 
      ? Math.round(recentArticles.reduce((sum, a) => sum + (a.relevanceScore || 0), 0) / recentArticles.length)
      : 0;

    await dockTalkStorage.updateSystemStats({
      todayArticles: todayArticles.length,
      avgRelevance,
      lastUpdate: new Date(),
      rssFeedStatus: "online",
      scraperStatus: "active", 
      aiStatus: "processing",
      dbStatus: "healthy"
    });
  } catch (error) {
    console.error("Error updating system stats:", error);
  }
}

async function updateAnalytics(): Promise<void> {
  try {
    // This would typically update more complex analytics
    // For now, just refresh the basic stats
    await updateSystemStats(0);
  } catch (error) {
    console.error("Error updating analytics:", error);
  }
}

async function cleanupOldArticles(): Promise<void> {
  try {
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
    
    // Delete articles older than 1 year, but preserve bookmarked articles
    const deletedCount = await dockTalkStorage.deleteOldArticles(oneYearAgo);
    
  } catch (error) {
    console.error("Error during cleanup:", error);
  }
}
