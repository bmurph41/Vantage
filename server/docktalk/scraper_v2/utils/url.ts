import { URL } from 'url';

export function normalizeUrl(rawUrl: string, baseUrl?: string): string {
  try {
    const url = baseUrl ? new URL(rawUrl, baseUrl) : new URL(rawUrl);
    
    url.hash = '';
    
    const trackingParams = [
      'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
      'fbclid', 'gclid', 'msclkid', 'ref', 'source', 'mc_cid', 'mc_eid',
      '_ga', '_gl', 'spm', 'from', 'isappinstalled', 'nsukey',
    ];
    
    trackingParams.forEach(param => url.searchParams.delete(param));
    
    url.searchParams.sort();
    
    let hostname = url.hostname.toLowerCase();
    if (hostname.startsWith('www.')) {
      hostname = hostname.slice(4);
    }
    
    let pathname = url.pathname;
    if (pathname.length > 1 && pathname.endsWith('/')) {
      pathname = pathname.slice(0, -1);
    }
    
    const protocol = url.protocol === 'http:' ? 'https:' : url.protocol;
    
    const search = url.search;
    
    return `${protocol}//${hostname}${pathname}${search}`;
  } catch {
    return rawUrl.toLowerCase().trim();
  }
}

export function extractDomain(url: string): string {
  try {
    const parsed = new URL(url);
    let hostname = parsed.hostname.toLowerCase();
    if (hostname.startsWith('www.')) {
      hostname = hostname.slice(4);
    }
    return hostname;
  } catch {
    return '';
  }
}

export function isValidHttpUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

export function resolveUrl(relative: string, base: string): string {
  try {
    return new URL(relative, base).toString();
  } catch {
    return relative;
  }
}

export function matchesPattern(url: string, pattern: string): boolean {
  try {
    const regex = new RegExp(pattern, 'i');
    return regex.test(url);
  } catch {
    return url.toLowerCase().includes(pattern.toLowerCase());
  }
}

export function shouldIncludeUrl(
  url: string, 
  allowPatterns?: string[] | null, 
  denyPatterns?: string[] | null
): boolean {
  if (denyPatterns && denyPatterns.length > 0) {
    for (const pattern of denyPatterns) {
      if (matchesPattern(url, pattern)) {
        return false;
      }
    }
  }
  
  if (allowPatterns && allowPatterns.length > 0) {
    for (const pattern of allowPatterns) {
      if (matchesPattern(url, pattern)) {
        return true;
      }
    }
    return false;
  }
  
  return true;
}

export function getPathDepth(url: string): number {
  try {
    const parsed = new URL(url);
    const segments = parsed.pathname.split('/').filter(s => s.length > 0);
    return segments.length;
  } catch {
    return 0;
  }
}
