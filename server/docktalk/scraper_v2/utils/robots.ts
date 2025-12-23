import type { RobotsRules } from '../types';
import { V2_CONFIG } from '../config';

const robotsCache = new Map<string, { rules: RobotsRules; fetchedAt: number }>();
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

export async function fetchRobotsRules(baseUrl: string): Promise<RobotsRules | null> {
  const url = new URL('/robots.txt', baseUrl).toString();
  const cacheKey = new URL(baseUrl).hostname;
  
  const cached = robotsCache.get(cacheKey);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return cached.rules;
  }
  
  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': V2_CONFIG.fetcher.userAgent },
      signal: AbortSignal.timeout(10000),
    });
    
    if (!response.ok) {
      return null;
    }
    
    const text = await response.text();
    const rules = parseRobotsTxt(text);
    
    robotsCache.set(cacheKey, { rules, fetchedAt: Date.now() });
    return rules;
  } catch {
    return null;
  }
}

export function parseRobotsTxt(content: string): RobotsRules {
  const rules: RobotsRules = {
    userAgent: '*',
    allowed: [],
    disallowed: [],
    sitemaps: [],
  };
  
  const lines = content.split('\n').map(l => l.trim());
  let currentUserAgent = '';
  let isRelevant = false;
  
  const botName = V2_CONFIG.fetcher.userAgent.split('/')[0].toLowerCase();
  
  for (const line of lines) {
    if (line.startsWith('#') || line === '') continue;
    
    const [directive, ...valueParts] = line.split(':');
    const value = valueParts.join(':').trim();
    const lowerDirective = directive.toLowerCase().trim();
    
    if (lowerDirective === 'user-agent') {
      currentUserAgent = value.toLowerCase();
      isRelevant = currentUserAgent === '*' || 
                   currentUserAgent === botName ||
                   currentUserAgent.includes('bot');
    } else if (isRelevant) {
      if (lowerDirective === 'disallow' && value) {
        const regex = pathToRegex(value);
        if (regex) rules.disallowed.push(regex);
      } else if (lowerDirective === 'allow' && value) {
        const regex = pathToRegex(value);
        if (regex) rules.allowed.push(regex);
      } else if (lowerDirective === 'crawl-delay') {
        const delay = parseFloat(value);
        if (!isNaN(delay)) {
          rules.crawlDelay = delay * 1000;
        }
      }
    }
    
    if (lowerDirective === 'sitemap' && value) {
      rules.sitemaps.push(value);
    }
  }
  
  return rules;
}

function pathToRegex(path: string): RegExp | null {
  try {
    let pattern = path
      .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
      .replace(/\*/g, '.*');
    
    if (!pattern.endsWith('$')) {
      pattern = pattern + '.*';
    }
    
    return new RegExp('^' + pattern);
  } catch {
    return null;
  }
}

export function isUrlAllowed(path: string, rules: RobotsRules): boolean {
  for (const allowed of rules.allowed) {
    if (allowed.test(path)) return true;
  }
  
  for (const disallowed of rules.disallowed) {
    if (disallowed.test(path)) return false;
  }
  
  return true;
}

export function getCrawlDelay(rules: RobotsRules | null, defaultDelay: number): number {
  if (rules?.crawlDelay) {
    return Math.max(rules.crawlDelay, defaultDelay);
  }
  return defaultDelay;
}

export function clearRobotsCache(): void {
  robotsCache.clear();
}
