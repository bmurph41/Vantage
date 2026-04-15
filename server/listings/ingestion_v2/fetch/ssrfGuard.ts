const BLOCKED_HOSTS = [
  'localhost',
  '127.0.0.1',
  '0.0.0.0',
  '::1',
  '[::1]',
  'metadata.google.internal',
  'metadata.google',
  '169.254.169.254',
];

const ALLOWED_MARINA_DOMAINS = [
  'marinasforsale.com',
  'boatyard.com',
  'loopnet.com',
  'crexi.com',
  'commercialcafe.com',
  'yachtworld.com',
  'boatsandoutboards.com',
  'boats.com',
  'boattrader.com',
  'marinas.com',
  'dockwa.com',
  'snagaslip.com',
  'marinahub.com',
  'boatbound.co',
  'marinadockage.com',
  'activecaptain.com',
  'waterwaymarine.com',
  'boatline.com',
  'sailboatlistings.com',
  'marinalife.com',
  'marinabrokers.com',
  'merrittsmith.com',
  'waterfrontventures.com',
  'marineassetpartners.com',
  'marinaproperties.com',
  'coastalmarinainvestments.com',
  'firstboatmarinas.com',
  'marinamaxpartners.com',
  'sunbeltnetwork.com',
  'bizbuysell.com',
  'businessbroker.net',
  'bizquest.com',
  'franchisegator.com',
];

const PRIVATE_IP_RANGES = [
  { start: [10, 0, 0, 0], end: [10, 255, 255, 255] },
  { start: [172, 16, 0, 0], end: [172, 31, 255, 255] },
  { start: [192, 168, 0, 0], end: [192, 168, 255, 255] },
  { start: [127, 0, 0, 0], end: [127, 255, 255, 255] },
  { start: [169, 254, 0, 0], end: [169, 254, 255, 255] },
  { start: [0, 0, 0, 0], end: [0, 255, 255, 255] },
];

function parseIPv4(ip: string): number[] | null {
  const parts = ip.split('.');
  if (parts.length !== 4) return null;
  
  const octets = parts.map(p => parseInt(p, 10));
  if (octets.some(o => isNaN(o) || o < 0 || o > 255)) return null;
  
  return octets;
}

function isIPInRange(ip: number[], start: number[], end: number[]): boolean {
  for (let i = 0; i < 4; i++) {
    if (ip[i] < start[i] || ip[i] > end[i]) return false;
    if (ip[i] > start[i] && ip[i] < end[i]) return true;
  }
  return true;
}

function isPrivateIP(ip: string): boolean {
  const parsed = parseIPv4(ip);
  if (!parsed) return false;
  
  return PRIVATE_IP_RANGES.some(range => isIPInRange(parsed, range.start, range.end));
}

export interface SSRFCheckResult {
  allowed: boolean;
  reason?: string;
}

export function checkSSRF(url: string): SSRFCheckResult {
  try {
    const parsed = new URL(url);
    
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return {
        allowed: false,
        reason: `Blocked protocol: ${parsed.protocol}`,
      };
    }
    
    const hostname = parsed.hostname.toLowerCase();
    
    if (BLOCKED_HOSTS.includes(hostname)) {
      return {
        allowed: false,
        reason: `Blocked host: ${hostname}`,
      };
    }
    
    if (isPrivateIP(hostname)) {
      return {
        allowed: false,
        reason: `Blocked private IP: ${hostname}`,
      };
    }
    
    if (hostname.endsWith('.local') || hostname.endsWith('.internal')) {
      return {
        allowed: false,
        reason: `Blocked internal hostname: ${hostname}`,
      };
    }
    
    const blockedPorts = [22, 23, 25, 110, 143, 445, 3306, 5432, 6379, 27017];
    if (parsed.port && blockedPorts.includes(parseInt(parsed.port, 10))) {
      return {
        allowed: false,
        reason: `Blocked port: ${parsed.port}`,
      };
    }
    
    return { allowed: true };
    
  } catch (error) {
    return {
      allowed: false,
      reason: `Invalid URL: ${(error as Error).message}`,
    };
  }
}

export function sanitizeUrl(url: string): string | null {
  const result = checkSSRF(url);
  if (!result.allowed) {
    console.warn(`[SSRF Guard] Blocked URL: ${url} - ${result.reason}`);
    return null;
  }
  return url;
}

export function isAllowedMarinaDomain(url: string): boolean {
  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname.toLowerCase();
    return ALLOWED_MARINA_DOMAINS.some(domain => 
      hostname === domain || hostname.endsWith(`.${domain}`)
    );
  } catch {
    return false;
  }
}

export function checkMarketplaceScrapeUrl(url: string): SSRFCheckResult {
  const baseCheck = checkSSRF(url);
  if (!baseCheck.allowed) {
    return baseCheck;
  }
  
  if (!isAllowedMarinaDomain(url)) {
    return {
      allowed: false,
      reason: `Domain not in whitelist. URL: ${url}`,
    };
  }
  
  return { allowed: true };
}

export function getAllowedMarinaDomains(): string[] {
  return [...ALLOWED_MARINA_DOMAINS];
}
