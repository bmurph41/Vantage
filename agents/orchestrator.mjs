#!/usr/bin/env node
import { spawnSync, execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WORKSPACE = path.resolve(__dirname, '..');
const AGENTS_DIR = __dirname;
const LOG_DIR = path.join(WORKSPACE, 'agent-logs');
const QUEUE_FILE = path.join(WORKSPACE, 'AGENT_QUEUE.md');
const STATUS_FILE = path.join(WORKSPACE, 'BUILD_STATUS.md');
const JOURNAL_FILE = path.join(WORKSPACE, 'MARINAMATCH_JOURNAL.md');
const PLATFORM_MAP_FILE = path.join(WORKSPACE, 'MARINAMATCH_PLATFORM_MAP.md');

const timestamp = () => new Date().toISOString().replace('T', ' ').slice(0, 19);
const log = (msg) => {
  const line = `[${timestamp()}] ${msg}`;
  console.log(line);
  fs.appendFileSync(path.join(LOG_DIR, 'orchestrator.log'), line + '\n');
};

function parseQueue() {
  const content = fs.readFileSync(QUEUE_FILE, 'utf8');
  const tasks = [];
  for (const line of content.split('\n')) {
    const match = line.match(/^-\s+\[(\w+)\]\s+\[(\w+)\]\s+(.+)$/);
    if (match) tasks.push({ type: match[1], status: match[2], description: match[3].trim(), raw: line });
  }
  return tasks;
}

function getNextTask(tasks) {
  return tasks.find(t => t.status === 'todo') || null;
}

function markTaskStatus(task, newStatus, note = '') {
  let content = fs.readFileSync(QUEUE_FILE, 'utf8');
  const newLine = task.raw.replace(`[${task.status}]`, `[${newStatus}]`);
  content = content.replace(task.raw, newLine);
  if (newStatus === 'done') {
    content = content.replace(newLine + '\n', '');
    content = content.replace('## Completed\n', `## Completed\n- [${task.type}] [done] ${task.description}\n`);
  } else if (newStatus === 'failed') {
    content = content.replace(newLine + '\n', '');
    content = content.replace('## Failed / Blocked\n', `## Failed / Blocked\n- [${task.type}] [failed] ${task.description} — ${note}\n`);
  }
  fs.writeFileSync(QUEUE_FILE, content);
}

const AGENT_PROMPTS = {
  feature: 'builder-agent-prompt.md',
  migration: 'db-agent-prompt.md',
  spec: 'planner-agent-prompt.md',
  test: 'qa-agent-prompt.md',
  audit: 'audit-agent-prompt.md',
};

function runAgent(task) {
  const promptFile = path.join(AGENTS_DIR, AGENT_PROMPTS[task.type]);
  if (!fs.existsSync(promptFile)) {
    return { success: false, notes: `Missing prompt file for type: ${task.type}` };
  }

  const agentPrompt = fs.readFileSync(promptFile, 'utf8');
  const journal = fs.existsSync(JOURNAL_FILE) ? fs.readFileSync(JOURNAL_FILE, 'utf8').slice(0, 6000) : 'Journal not found.';
  const platformMap = fs.existsSync(PLATFORM_MAP_FILE) ? fs.readFileSync(PLATFORM_MAP_FILE, 'utf8').slice(0, 4000) : 'Platform map not found.';

  const fullPrompt = `${agentPrompt}

---
## CURRENT TASK
${task.description}

## PLATFORM MAP CONTEXT
${platformMap}

## JOURNAL CONTEXT
${journal}
`;

  const logFile = path.join(LOG_DIR, `${task.type}-${Date.now()}.log`);
  const startTime = Date.now();
  log(`Running ${task.type} agent: "${task.description}"`);

  const result = spawnSync('claude', ['--dangerously-skip-permissions', '-p', fullPrompt], {
    cwd: WORKSPACE,
    timeout: 25 * 60 * 1000,
    encoding: 'utf8',
    maxBuffer: 10 * 1024 * 1024,
  });

  const duration = Math.round((Date.now() - startTime) / 1000);
  fs.writeFileSync(logFile, (result.stdout || '') + '\n' + (result.stderr || ''));

  if (result.status === 0) {
    log(`✅ Done in ${duration}s`);
    try {
      execSync(`git add -A && git commit -m "agent: ${task.description.slice(0, 60)}"`, { cwd: WORKSPACE });
      log('✅ Committed to git');
    } catch (e) {
      log('⚠️  Git commit skipped (no changes or not configured)');
    }
    return { success: true, duration };
  } else {
    log(`❌ Failed (exit ${result.status}) in ${duration}s`);
    return { success: false, duration, notes: (result.stderr || '').slice(0, 200) };
  }
}

function runQACheck() {
  const results = {};
  try {
    execSync('npx tsc --noEmit 2>&1', { cwd: WORKSPACE, timeout: 60000 });
    results.tsErrors = 'No TypeScript errors ✅';
  } catch (e) {
    results.tsErrors = (e.stdout || e.message || '').slice(0, 400);
  }
  try {
    results.testOutput = execSync('npm test -- --passWithNoTests 2>&1', { cwd: WORKSPACE, timeout: 120000, encoding: 'utf8' }).slice(-400);
  } catch (e) {
    results.testOutput = (e.stdout || e.message || '').slice(0, 400);
  }
  return results;
}

function updateBuildStatus(task, result) {
  fs.writeFileSync(STATUS_FILE, `# MarinaMatch Build Status
_Last updated: ${timestamp()}_

## Last Agent Run
- Type: ${task.type}
- Task: ${task.description}
- Result: ${result.success ? '✅ SUCCESS' : '❌ FAILED'}
- Duration: ${result.duration}s
${result.notes ? `- Notes: ${result.notes}` : ''}

## TypeScript
${result.tsErrors || 'Not run this cycle'}

## Tests
${result.testOutput || 'Not run this cycle'}
`);
}

async function main() {
  log('=== Orchestrator cycle start ===');
  const tasks = parseQueue();
  const nextTask = getNextTask(tasks);
  if (!nextTask) { log('Queue empty — nothing to do'); process.exit(0); }

  log(`Next: [${nextTask.type}] ${nextTask.description}`);
  markTaskStatus(nextTask, 'in-progress');

  const agentResult = runAgent(nextTask);
  let qaResults = {};
  if (['feature', 'migration'].includes(nextTask.type) && agentResult.success) {
    qaResults = runQACheck();
  }

  updateBuildStatus(nextTask, { ...agentResult, ...qaResults });

  if (agentResult.success) {
    markTaskStatus(nextTask, 'done');
    log(`✅ Marked done: ${nextTask.description}`);
  } else {
    markTaskStatus(nextTask, 'failed', agentResult.notes || '');
    log(`❌ Marked failed: ${nextTask.description}`);
  }
  log('=== Cycle end ===');
}

main().catch(err => { log(`FATAL: ${err.message}`); process.exit(1); });
