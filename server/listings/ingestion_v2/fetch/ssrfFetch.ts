import { checkSSRF } from './ssrfGuard';

export interface SSRFFetchResult {
  success: boolean;
  html?: string;
  finalUrl: string;
  statusCode: number;
  error?: string;
}

export async function ssrfSafeFetch(
  url: string,
  options: {
    timeoutMs?: number;
    maxRedirects?: number;
    userAgent?: string;
  } = {}
): Promise<SSRFFetchResult> {
  const {
    timeoutMs = 30000,
    maxRedirects = 5,
    userAgent = 'MarinaMatch/1.0 (Listing Ingestion)',
  } = options;

  let currentUrl = url;
  let redirectCount = 0;

  while (redirectCount <= maxRedirects) {
    const ssrfCheck = checkSSRF(currentUrl);
    if (!ssrfCheck.allowed) {
      return {
        success: false,
        finalUrl: currentUrl,
        statusCode: 0,
        error: `SSRF blocked: ${ssrfCheck.reason}`,
      };
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(currentUrl, {
        signal: controller.signal,
        redirect: 'manual',
        headers: {
          'User-Agent': userAgent,
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        },
      });

      clearTimeout(timeoutId);

      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get('location');
        if (!location) {
          return {
            success: false,
            finalUrl: currentUrl,
            statusCode: response.status,
            error: 'Redirect without location header',
          };
        }

        try {
          currentUrl = new URL(location, currentUrl).href;
        } catch {
          return {
            success: false,
            finalUrl: currentUrl,
            statusCode: response.status,
            error: `Invalid redirect URL: ${location}`,
          };
        }

        redirectCount++;
        continue;
      }

      if (!response.ok) {
        return {
          success: false,
          finalUrl: currentUrl,
          statusCode: response.status,
          error: `HTTP error: ${response.status} ${response.statusText}`,
        };
      }

      const html = await response.text();

      return {
        success: true,
        html,
        finalUrl: currentUrl,
        statusCode: response.status,
      };

    } catch (error) {
      clearTimeout(timeoutId);
      return {
        success: false,
        finalUrl: currentUrl,
        statusCode: 0,
        error: (error as Error).message,
      };
    }
  }

  return {
    success: false,
    finalUrl: currentUrl,
    statusCode: 0,
    error: `Too many redirects (max ${maxRedirects})`,
  };
}
