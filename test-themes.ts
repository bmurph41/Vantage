import { db } from "./server/db";
import { omThemes } from "./shared/schema";
import { desc, or, eq } from "drizzle-orm";

async function testThemes() {
  try {
    console.log("Testing direct DB query...");
    const result = await db.select().from(omThemes).orderBy(desc(omThemes.isSystemDefault), omThemes.name);
    console.log("Query result:", JSON.stringify(result, null, 2));
    console.log("Theme count:", result.length);
  } catch (error) {
    console.error("Error querying themes:", error);
  }
  process.exit(0);
}

testThemes();
