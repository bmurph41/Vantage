const PLATFORM_DOMAIN_MAP: Record<string, string[]> = {
  loopnet: ["loopnet.com"],
  crexi: ["crexi.com"],
  bizbuysell: ["bizbuysell.com"],
  costar: ["costar.com"],
  colliers: ["colliers.com"],
  marcus_millichap: ["marcusmillichap.com"],
  marcusmillichap: ["marcusmillichap.com"],
  leisure_ipg: ["leisurepropertiesgroup.com", "lipg.com"],
  simply_marinas: ["simplymarinas.com"],
  simplymarinas: ["simplymarinas.com"],
  svn_marinas: ["svnmarinas.com"],
  svnmarinas: ["svnmarinas.com"],
  cbre: ["cbre.com"],
  cushman_wakefield: ["cushmanwakefield.com"],
  cushmanwakefield: ["cushmanwakefield.com"],
  boattrader: ["boattrader.com"],
  marinasforsale: ["marinasforsale.com"],
};

const ALL_ALLOWED_DOMAINS = Object.values(PLATFORM_DOMAIN_MAP).flat();

function extractHostname(url: string): string | null {
  try {
    const parsed = new URL(url);
    return parsed.hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return null;
  }
}

function hostnameMatchesDomain(hostname: string, domain: string): boolean {
  const cleanDomain = domain.toLowerCase().replace(/^www\./, "");
  return hostname === cleanDomain || hostname.endsWith("." + cleanDomain);
}

export interface UrlValidationResult {
  valid: boolean;
  reason?: string;
  suggestedFix?: string;
}

export function validateListingUrl(url: string, sourcePlatform?: string): UrlValidationResult {
  if (!url || url.trim() === "") {
    return { valid: false, reason: "URL is required" };
  }
  
  if (url.startsWith("#")) {
    if (sourcePlatform === "direct" || sourcePlatform === "manual_import") {
      return { valid: true };
    }
    return { valid: false, reason: "Placeholder URLs are not allowed for external platform listings" };
  }
  
  if (url.startsWith("mailto:")) {
    const email = url.replace("mailto:", "");
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (emailRegex.test(email)) {
      return { valid: true };
    }
    return { valid: false, reason: "Invalid email in mailto: URL" };
  }
  
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { valid: false, reason: "Invalid URL format", suggestedFix: "Ensure URL starts with https://" };
  }
  
  if (!["http:", "https:"].includes(parsed.protocol)) {
    return { valid: false, reason: "URL must use http or https protocol" };
  }
  
  const hostname = extractHostname(url);
  if (!hostname) {
    return { valid: false, reason: "Could not parse hostname from URL" };
  }
  
  const normalizedPlatform = sourcePlatform?.toLowerCase().replace(/[_-]/g, "") || "";
  
  if (normalizedPlatform === "direct" || normalizedPlatform === "manualimport" || normalizedPlatform === "manual_import") {
    return { valid: true };
  }
  
  if (normalizedPlatform) {
    const allowedDomains = PLATFORM_DOMAIN_MAP[normalizedPlatform] || PLATFORM_DOMAIN_MAP[normalizedPlatform.replace(/_/g, "")];
    
    if (allowedDomains) {
      const domainMatches = allowedDomains.some(domain => hostnameMatchesDomain(hostname, domain));
      if (!domainMatches) {
        return {
          valid: false,
          reason: `URL domain "${hostname}" does not match platform "${sourcePlatform}". Expected one of: ${allowedDomains.join(", ")}`,
          suggestedFix: `Use a real listing URL from ${allowedDomains[0]}`,
        };
      }
      return { valid: true };
    }
  }
  
  const isKnownPlatform = ALL_ALLOWED_DOMAINS.some(domain => hostnameMatchesDomain(hostname, domain));
  if (isKnownPlatform) {
    return { valid: true };
  }
  
  return { valid: true };
}

export async function validateUrlAccessibility(url: string, timeoutMs: number = 5000): Promise<UrlValidationResult> {
  const basicValidation = validateListingUrl(url);
  if (!basicValidation.valid) {
    return basicValidation;
  }
  
  if (url.startsWith("mailto:") || url.startsWith("#")) {
    return { valid: true };
  }
  
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    
    const response = await fetch(url, {
      method: "HEAD",
      signal: controller.signal,
      headers: {
        "User-Agent": "MarinaMatch-LinkValidator/1.0",
      },
      redirect: "follow",
    });
    
    clearTimeout(timeoutId);
    
    if (response.ok) {
      return { valid: true };
    }
    
    if (response.status === 403 || response.status === 401) {
      return { valid: true };
    }
    
    if (response.status === 404) {
      return { 
        valid: false, 
        reason: `Listing page not found (404)`, 
        suggestedFix: "Verify the listing still exists on the platform" 
      };
    }
    
    return { valid: true };
  } catch (error: any) {
    if (error.name === "AbortError") {
      return { valid: true };
    }
    return { valid: true };
  }
}

export function getPlatformFromUrl(url: string): string | null {
  const hostname = extractHostname(url);
  if (!hostname) return null;
  
  for (const [platform, domains] of Object.entries(PLATFORM_DOMAIN_MAP)) {
    if (domains.some(domain => hostnameMatchesDomain(hostname, domain))) {
      return platform;
    }
  }
  
  return null;
}
