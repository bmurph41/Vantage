/**
 * Minimal robots.txt fetcher + parser.
 *
 * Implements the subset of https://www.rfc-editor.org/rfc/rfc9309 that scraper
 * adapters need: fetch /robots.txt from a host, pick the most specific
 * User-agent group that matches our bot, and check whether a given path is
 * allowed. Longest-match-wins for overlapping Allow/Disallow rules.
 *
 * Robots responses are cached in-memory per host for 12 hours to avoid
 * hammering the origin.
 */

const CACHE_TTL_MS = 12 * 60 * 60 * 1000;
const FETCH_TIMEOUT_MS = 8_000;

interface Rule {
  path: string; // after stripping the directive keyword; empty means "match everything"
  allow: boolean;
}

interface ParsedRobots {
  groups: Map<string, Rule[]>; // lowercased user-agent token → rules
  crawlDelays: Map<string, number>; // seconds
  sitemaps: string[];
}

interface CacheEntry {
  parsed: ParsedRobots | null; // null = permissive (fetch failed / 4xx)
  fetchedAt: number;
}

const cache = new Map<string, CacheEntry>();

function parseRobotsTxt(text: string): ParsedRobots {
  const groups = new Map<string, Rule[]>();
  const crawlDelays = new Map<string, number>();
  const sitemaps: string[] = [];
  let current: string[] = []; // active user-agent tokens
  let sawRuleSinceAgent = false;

  const lines = text.split(/\r?\n/);
  for (const rawLine of lines) {
    const line = rawLine.replace(/#.*$/, '').trim();
    if (!line) continue;
    const idx = line.indexOf(':');
    if (idx < 0) continue;
    const directive = line.slice(0, idx).trim().toLowerCase();
    const value = line.slice(idx + 1).trim();

    if (directive === 'user-agent') {
      // Starting a new group resets current only after a non-UA line.
      // RFC: consecutive UA lines apply to the same rule block.
      if (current.length > 0 && sawRuleSinceAgent) {
        current = [];
        sawRuleSinceAgent = false;
      }
      const ua = value.toLowerCase();
      if (!groups.has(ua)) groups.set(ua, []);
      current.push(ua);
      continue;
    }

    if (directive === 'sitemap') {
      sitemaps.push(value);
      continue;
    }

    if (directive === 'crawl-delay') {
      const n = Number(value);
      if (isFinite(n) && n > 0) {
        for (const ua of current) crawlDelays.set(ua, n);
      }
      continue;
    }

    if (directive === 'allow' || directive === 'disallow') {
      sawRuleSinceAgent = true;
      if (current.length === 0) {
        // orphan rule — attach to "*"
        if (!groups.has('*')) groups.set('*', []);
        current = ['*'];
      }
      const rule: Rule = { path: value, allow: directive === 'allow' };
      for (const ua of current) {
        const arr = groups.get(ua)!;
        arr.push(rule);
      }
      continue;
    }
  }

  return { groups, crawlDelays, sitemaps };
}

function pickGroup(parsed: ParsedRobots, userAgent: string): Rule[] {
  const uaLower = userAgent.toLowerCase();
  // Longest matching UA token wins; fall back to '*'.
  let best: { token: string; rules: Rule[] } | null = null;
  for (const [token, rules] of parsed.groups.entries()) {
    if (token === '*') continue;
    if (uaLower.includes(token) && (!best || token.length > best.token.length)) {
      best = { token, rules };
    }
  }
  if (best) return best.rules;
  return parsed.groups.get('*') ?? [];
}

function matchesPath(rule: string, target: string): boolean {
  if (!rule) return true;
  // Handle '$' anchor and '*' glob.
  const anchored = rule.endsWith('$');
  const pattern = anchored ? rule.slice(0, -1) : rule;
  const segments = pattern.split('*');
  let cursor = 0;
  // First segment must match at position 0 (robots rules are prefix rules).
  if (!target.startsWith(segments[0])) return false;
  cursor = segments[0].length;
  for (let i = 1; i < segments.length; i++) {
    const seg = segments[i];
    if (!seg) continue;
    const hit = target.indexOf(seg, cursor);
    if (hit < 0) return false;
    cursor = hit + seg.length;
  }
  if (anchored && cursor !== target.length) return false;
  return true;
}

function evaluate(rules: Rule[], path: string): boolean {
  // Longest-match-wins. Empty Disallow: means "allow all".
  let decision: { length: number; allow: boolean } | null = null;
  for (const rule of rules) {
    if (rule.path === '' && !rule.allow) {
      // "Disallow:" with empty value is a no-op (allows everything).
      continue;
    }
    if (!matchesPath(rule.path, path)) continue;
    const length = rule.path.length;
    if (!decision || length > decision.length) {
      decision = { length, allow: rule.allow };
    }
  }
  return decision ? decision.allow : true;
}

async function fetchRobots(host: string): Promise<ParsedRobots | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const resp = await fetch(`https://${host}/robots.txt`, {
      signal: controller.signal,
      redirect: 'follow',
      headers: { 'user-agent': 'MarinaMatchBot/1.0 (+https://marinamatch.com/bot)' },
    });
    if (resp.status >= 400) return null; // treat as permissive
    const text = await resp.text();
    return parseRobotsTxt(text);
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function getRobotsFor(host: string): Promise<ParsedRobots | null> {
  const cached = cache.get(host);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return cached.parsed;
  }
  const parsed = await fetchRobots(host);
  cache.set(host, { parsed, fetchedAt: Date.now() });
  return parsed;
}

export async function isAllowedByRobots(
  url: string,
  userAgent: string,
): Promise<{ allowed: boolean; crawlDelaySeconds?: number }> {
  try {
    const parsed = new URL(url);
    const host = parsed.host.toLowerCase();
    const path = parsed.pathname + (parsed.search || '');
    const robots = await getRobotsFor(host);
    if (!robots) return { allowed: true };
    const rules = pickGroup(robots, userAgent);
    const allowed = evaluate(rules, path);
    const uaLower = userAgent.toLowerCase();
    let delay: number | undefined;
    for (const [token, d] of robots.crawlDelays.entries()) {
      if (token === '*' || uaLower.includes(token)) {
        if (delay === undefined || d > delay) delay = d;
      }
    }
    return { allowed, crawlDelaySeconds: delay };
  } catch {
    // Malformed URL → block.
    return { allowed: false };
  }
}

export function __clearRobotsCacheForTest() {
  cache.clear();
}
