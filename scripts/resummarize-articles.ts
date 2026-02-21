import { resummarizeExistingArticles } from "../server/docket/services/backfill";

async function main() {
  console.log("Starting article re-summarization with new action-verb format...");
  const result = await resummarizeExistingArticles({
    maxArticles: 300,
    batchSize: 5,
    onlyMissing: false
  });
  console.log("Re-summarization complete:", result);
  process.exit(0);
}

main().catch(err => {
  console.error("Error:", err);
  process.exit(1);
});
