#!/usr/bin/env node
/**
 * check-and-fix-sql.cjs
 * 
 * 1. Queries the DB for actual column names on modeling_projects
 * 2. Fixes SQL in all new services to match
 * 
 * Usage: npx tsx check-and-fix-sql.cjs
 * Run from project root
 */

// Since we can't easily connect to DB from CJS, let's find the answer
// from the existing working code in routes.ts

const fs = require('fs');

const routes = fs.readFileSync('server/routes.ts', 'utf8');

// Find existing SQL that queries modeling_projects successfully
const mpQueries = [];
const lines = routes.split('\n');
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('modeling_projects') && lines[i].includes('SELECT')) {
    mpQueries.push({ line: i + 1, sql: lines[i].trim() });
  }
  // Also catch multi-line queries
  if (lines[i].includes('FROM modeling_projects') || lines[i].includes('from modeling_projects')) {
    // Grab context
    const start = Math.max(0, i - 3);
    const end = Math.min(lines.length - 1, i + 3);
    const ctx = lines.slice(start, end + 1).join('\n').trim();
    mpQueries.push({ line: i + 1, sql: ctx.slice(0, 300) });
  }
}

console.log('=== Existing modeling_projects queries in routes.ts ===');
mpQueries.slice(0, 5).forEach(q => {
  console.log(`Line ${q.line}:`);
  console.log(q.sql);
  console.log('---');
});

// Also check the schema definition
const schema = fs.readFileSync('shared/schema.ts', 'utf8');
const mpMatch = schema.match(/modelingProjects\s*=\s*[^;]+;/s);
if (mpMatch) {
  console.log('\n=== modeling_projects schema definition ===');
  console.log(mpMatch[0].slice(0, 500));
}

// Check for project_id vs projectId column
const hasProjectId = schema.includes('project_id') || schema.includes('projectId');
console.log('\n=== Column search ===');

// Search for the FK relationship
const fkPatterns = [
  /modelingProjects[\s\S]{0,500}project/i,
];
for (const pat of fkPatterns) {
  const m = schema.match(pat);
  if (m) {
    console.log('FK pattern found:', m[0].slice(0, 200));
  }
}

// Grep for how existing working code joins modeling_projects to projects
console.log('\n=== How existing code joins mp to projects ===');
const joinPatterns = routes.match(/modeling_projects[\s\S]{0,100}JOIN[\s\S]{0,100}projects/gi);
if (joinPatterns) {
  joinPatterns.slice(0, 3).forEach(p => console.log(p.slice(0, 200)));
} else {
  console.log('No JOIN found between modeling_projects and projects');
}

// Check how the multi-year projection route loads project data (this works)
console.log('\n=== Multi-year projection route SQL pattern ===');
const myIdx = routes.indexOf('multi-year-projection');
if (myIdx > -1) {
  // Find the pool.query near it
  const nearby = routes.slice(Math.max(0, myIdx - 2000), myIdx + 2000);
  const poolQueries = nearby.match(/pool\.query\([^)]+\)/gs);
  if (poolQueries) {
    poolQueries.forEach(q => console.log(q.slice(0, 300), '\n'));
  }
}
