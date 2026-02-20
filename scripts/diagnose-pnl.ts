import { db } from '../server/db';
import { pnlDocuments, pnlFacts } from '@shared/pnl-pipeline-schema';
import { modelingActuals } from '@shared/schema';
import { sql } from 'drizzle-orm';

async function main() {
  // 1. Check pnlDocuments
  const docs = await db.select({
    id: pnlDocuments.id,
    orgId: pnlDocuments.orgId,
    modelingProjectId: pnlDocuments.modelingProjectId,
  }).from(pnlDocuments);
  console.log('=== pnlDocuments ===');
  console.log('Total:', docs.length);
  docs.forEach(d => console.log('  ', d.id, '→ project:', d.modelingProjectId || 'NULL'));

  // 2. Check pnlFacts
  console.log('\n=== pnlFacts ===');
  const factCounts = await db.execute(sql`SELECT document_id, count(*) as cnt FROM pnl_facts GROUP BY document_id`);
  console.log('By document:', factCounts.rows);

  // 3. Check remaining actuals
  console.log('\n=== modelingActuals remaining ===');
  const actuals = await db.execute(sql`
    SELECT modeling_project_id, data_source, count(*) as cnt 
    FROM modeling_actuals 
    GROUP BY modeling_project_id, data_source
  `);
  console.log(actuals.rows);
}

main().catch(console.error).finally(() => process.exit(0));
