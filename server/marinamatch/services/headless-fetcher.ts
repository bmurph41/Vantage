import { chromium, Browser, Page } from "playwright";

const USER_AGENTS = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0",
];

async function launchBrowser(): Promise<Browser> {
  return chromium.launch({
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu",
      "--no-first-run",
      "--no-zygote",
      "--single-process",
      "--disable-extensions",
    ],
  });
}

export interface HeadlessFetchResult {
  success: boolean;
  html: string;
  finalUrl: string;
  statusCode: number;
  error?: string;
  renderTimeMs: number;
  jsDetected: boolean;
}

export interface HeadlessFetchOptions {
  waitForSelector?: string;
  waitForTimeout?: number;
  scrollToBottom?: boolean;
  blockImages?: boolean;
  blockFonts?: boolean;
}

export async function fetchWithHeadless(
  url: string,
  options: HeadlessFetchOptions = {}
): Promise<HeadlessFetchResult> {
  const startTime = Date.now();
  const userAgent = USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];

  let browser: Browser | null = null;
  let page: Page | null = null;

  try {
    browser = await launchBrowser();
    const context = await browser.newContext({
      userAgent,
      viewport: { width: 1920, height: 1080 },
      locale: "en-US",
      timezoneId: "America/New_York",
      extraHTTPHeaders: {
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
        "Accept-Encoding": "gzip, deflate, br",
        "DNT": "1",
        "Connection": "keep-alive",
        "Upgrade-Insecure-Requests": "1",
        "Sec-Fetch-Dest": "document",
        "Sec-Fetch-Mode": "navigate",
        "Sec-Fetch-Site": "none",
        "Sec-Fetch-User": "?1",
        "Cache-Control": "max-age=0",
      },
    });

    if (options.blockImages || options.blockFonts) {
      await context.route("**/*", (route) => {
        const resourceType = route.request().resourceType();
        if (
          (options.blockImages && resourceType === "image") ||
          (options.blockFonts && resourceType === "font")
        ) {
          route.abort();
        } else {
          route.continue();
        }
      });
    }

    page = await context.newPage();

    const response = await page.goto(url, {
      waitUntil: "networkidle",
      timeout: 30000,
    });

    if (!response) {
      throw new Error("No response received");
    }

    const statusCode = response.status();

    if (statusCode >= 400) {
      throw new Error(`HTTP ${statusCode}: ${response.statusText()}`);
    }

    if (options.waitForSelector) {
      try {
        await page.waitForSelector(options.waitForSelector, { timeout: 10000 });
      } catch {
        console.log(`[Headless] Selector "${options.waitForSelector}" not found, continuing...`);
      }
    }

    if (options.waitForTimeout) {
      await page.waitForTimeout(options.waitForTimeout);
    }

    if (options.scrollToBottom) {
      await autoScroll(page);
    }

    await page.waitForTimeout(2000);

    const html = await page.content();
    const finalUrl = page.url();

    const jsDetected = await page.evaluate(() => {
      const dynamicElements = document.querySelectorAll("[data-reactroot], [ng-app], [data-v-], #__next, #root");
      return dynamicElements.length > 0;
    });

    await context.close();
    await browser.close();

    return {
      success: true,
      html,
      finalUrl,
      statusCode,
      renderTimeMs: Date.now() - startTime,
      jsDetected,
    };
  } catch (error: any) {
    console.error(`[Headless] Error fetching ${url}:`, error.message);
    
    if (browser) {
      try {
        await browser.close();
      } catch {
      }
    }

    return {
      success: false,
      html: "",
      finalUrl: url,
      statusCode: 0,
      error: error.message,
      renderTimeMs: Date.now() - startTime,
      jsDetected: false,
    };
  }
}

async function autoScroll(page: Page): Promise<void> {
  await page.evaluate(async () => {
    await new Promise<void>((resolve) => {
      let totalHeight = 0;
      const distance = 300;
      const maxScrolls = 10;
      let scrollCount = 0;

      const timer = setInterval(() => {
        const scrollHeight = document.body.scrollHeight;
        window.scrollBy(0, distance);
        totalHeight += distance;
        scrollCount++;

        if (totalHeight >= scrollHeight || scrollCount >= maxScrolls) {
          clearInterval(timer);
          window.scrollTo(0, 0);
          resolve();
        }
      }, 200);
    });
  });
}

export function detectNeedsJsRendering(html: string): boolean {
  if (!html || html.length < 200) {
    return true;
  }

  const htmlLower = html.toLowerCase();

  const criticalJsIndicators = [
    "javascript is required",
    "enable javascript",
    "please enable javascript",
    "this page requires javascript",
  ];
  
  const hasCriticalJsIndicator = criticalJsIndicators.some((indicator) =>
    htmlLower.includes(indicator)
  );
  
  if (hasCriticalJsIndicator) {
    return true;
  }

  const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  const bodyContent = bodyMatch ? bodyMatch[1] : html;
  const textContent = bodyContent.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  
  if (textContent.length < 100) {
    return true;
  }

  const listingPatterns = [
    /marina/gi,
    /slip/gi,
    /boat/gi,
    /dock/gi,
    /waterfront/gi,
    /\$[\d,]+/g,
    /for sale/gi,
  ];

  let contentScore = 0;
  for (const pattern of listingPatterns) {
    const matches = textContent.match(pattern);
    contentScore += matches ? matches.length : 0;
  }

  if (contentScore >= 3) {
    return false;
  }

  const loadingPatterns = [
    /<div[^>]*id=["'](?:root|app|__next)["'][^>]*>\s*<\/div>/i,
    /window\.__INITIAL_STATE__/i,
    /window\.__NUXT__/i,
  ];
  
  const hasLoadingShell = loadingPatterns.some((pattern) => pattern.test(html));
  
  return hasLoadingShell;
}

export async function closeBrowser(): Promise<void> {
}

export interface SmartFetchResult extends HeadlessFetchResult {
  fetchMethod: "static" | "headless";
  retryCount: number;
}

export async function smartFetch(
  url: string,
  options: HeadlessFetchOptions & { forceHeadless?: boolean } = {}
): Promise<SmartFetchResult> {
  const startTime = Date.now();

  if (options.forceHeadless) {
    console.log(`[SmartFetch] Forced headless mode for: ${url}`);
    const result = await fetchWithHeadless(url, options);
    return {
      ...result,
      fetchMethod: "headless",
      retryCount: 0,
    };
  }

  try {
    const axios = (await import("axios")).default;
    const userAgent = USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];

    const response = await axios.get(url, {
      timeout: 15000,
      headers: {
        "User-Agent": userAgent,
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
        "Accept-Encoding": "gzip, deflate",
        "Connection": "keep-alive",
        "Upgrade-Insecure-Requests": "1",
      },
      maxRedirects: 5,
    });

    const html = response.data;

    if (detectNeedsJsRendering(html)) {
      console.log(`[SmartFetch] Static fetch detected JS-heavy content, falling back to headless: ${url}`);
      const headlessResult = await fetchWithHeadless(url, options);
      return {
        ...headlessResult,
        fetchMethod: "headless",
        retryCount: 1,
      };
    }

    return {
      success: true,
      html,
      finalUrl: response.request?.res?.responseUrl || url,
      statusCode: response.status,
      renderTimeMs: Date.now() - startTime,
      jsDetected: false,
      fetchMethod: "static",
      retryCount: 0,
    };
  } catch (error: any) {
    const statusCode = error.response?.status || 0;

    if (statusCode === 403 || statusCode === 429 || statusCode === 503) {
      console.log(`[SmartFetch] Static fetch blocked (${statusCode}), falling back to headless: ${url}`);
      const headlessResult = await fetchWithHeadless(url, options);
      return {
        ...headlessResult,
        fetchMethod: "headless",
        retryCount: 1,
      };
    }

    console.error(`[SmartFetch] Failed to fetch ${url}:`, error.message);
    return {
      success: false,
      html: "",
      finalUrl: url,
      statusCode,
      error: error.message,
      renderTimeMs: Date.now() - startTime,
      jsDetected: false,
      fetchMethod: "static",
      retryCount: 0,
    };
  }
}
