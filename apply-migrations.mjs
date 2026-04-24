import { runStartupMigrations } from "./server/db-startup-migrations.ts";
await runStartupMigrations();
console.log("done");
process.exit(0);
