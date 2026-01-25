import { fetchRssFeeds } from "../server/docktalk/services/rss-fetcher";

async function main() {
  console.log("Fetching articles from all active RSS sources...");
  const result = await fetchRssFeeds();
  console.log("Fetch complete:", result, "new articles");
  process.exit(0);
}

main().catch(err => {
  console.error("Error:", err);
  process.exit(1);
});
