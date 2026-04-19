import pg from 'pg';
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

// waterfall_tiers intentionally omitted — it FKs to waterfall_configs, not projects.
const TABLES = [
  'project_tax_settings',
  'project_partners',
  'project_equity_contributions',
  'waterfall_configs',
  'project_tax_inputs',
];

// For each table, find FK constraints on project_id and re-point them to modeling_projects.id
for (const tbl of TABLES) {
  const q = `
    SELECT tc.constraint_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name
     AND tc.table_name = kcu.table_name
    WHERE tc.table_name = $1
      AND tc.constraint_type = 'FOREIGN KEY'
      AND kcu.column_name = 'project_id'
  `;
  const r = await pool.query(q, [tbl]);
  for (const row of r.rows) {
    // Check what it references
    const ref = await pool.query(`
      SELECT ccu.table_name, ccu.column_name
      FROM information_schema.constraint_column_usage ccu
      WHERE ccu.constraint_name = $1
    `, [row.constraint_name]);
    const refTbl = ref.rows[0]?.table_name;
    if (refTbl === 'modeling_projects') {
      console.log(`skip ${tbl}.${row.constraint_name} (already -> modeling_projects)`);
      continue;
    }
    if (refTbl !== 'projects') {
      console.log(`skip ${tbl}.${row.constraint_name} (references ${refTbl}, not projects)`);
      continue;
    }
    console.log(`drop  ${tbl}.${row.constraint_name}  (was -> projects)`);
    await pool.query(`ALTER TABLE ${tbl} DROP CONSTRAINT IF EXISTS "${row.constraint_name}"`);
  }
  // Add new FK -> modeling_projects
  const newName = `${tbl}_project_id_modeling_projects_id_fk`;
  const exists = await pool.query(`
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name=$1 AND constraint_name=$2
  `, [tbl, newName]);
  if (exists.rows.length === 0) {
    console.log(`add   ${tbl}.${newName}  -> modeling_projects(id)`);
    await pool.query(`
      ALTER TABLE ${tbl}
      ADD CONSTRAINT "${newName}"
      FOREIGN KEY (project_id) REFERENCES modeling_projects(id) ON DELETE CASCADE
    `);
  } else {
    console.log(`skip  ${tbl}.${newName}  (already present)`);
  }
}

await pool.end();
