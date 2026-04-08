import * as cheerio from 'cheerio';

export interface BrandScanResult {
  primaryColors: string[];
  secondaryColors: string[];
  accentColors: string[];
  fontFamilies: {
    heading?: string;
    body?: string;
    alt?: string;
  };
  logoUrl?: string;
  faviconUrl?: string;
  siteName?: string;
  scanData: {
    url: string;
    scannedAt: string;
    cssUrls: string[];
    metaTags: Record<string, string>;
  };
}

const COLOR_REGEX = /#([0-9A-Fa-f]{3,8})|rgb\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*\)|rgba\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*,\s*[\d.]+\s*\)|hsl\(\s*\d+\s*,\s*[\d.]+%?\s*,\s*[\d.]+%?\s*\)/gi;

const FONT_REGEX = /font-family\s*:\s*([^;"}]+)/gi;

const COMMON_FONTS = [
  'arial', 'helvetica', 'times', 'georgia', 'verdana', 'courier', 
  'sans-serif', 'serif', 'monospace', 'cursive', 'fantasy', 'system-ui',
  'ui-sans-serif', 'ui-serif', 'ui-monospace', '-apple-system',
  'BlinkMacSystemFont', 'Segoe UI', 'inherit', 'initial', 'unset'
];

function normalizeColor(color: string): string {
  return color.toLowerCase().trim().replace(/\s+/g, '');
}

function isValidBrandColor(color: string): boolean {
  const normalized = normalizeColor(color);
  const blacklist = [
    '#000', '#000000', '#fff', '#ffffff', '#333', '#333333',
    '#666', '#666666', '#999', '#999999', '#ccc', '#cccccc',
    '#eee', '#eeeeee', '#f5f5f5', '#fafafa', 'transparent',
    'rgb(0,0,0)', 'rgb(255,255,255)', 'rgb(51,51,51)',
    'rgba(0,0,0,0)', 'rgba(0,0,0,1)', 'rgba(255,255,255,1)',
  ];
  return !blacklist.includes(normalized);
}

function extractColors(css: string): string[] {
  const matches = css.match(COLOR_REGEX) || [];
  const uniqueColors = [...new Set(matches.map(normalizeColor))];
  return uniqueColors.filter(isValidBrandColor).slice(0, 20);
}

function extractFonts(css: string): string[] {
  const fonts: string[] = [];
  let match;
  while ((match = FONT_REGEX.exec(css)) !== null) {
    const fontFamily = match[1].trim();
    const primaryFont = fontFamily.split(',')[0].trim().replace(/['"]/g, '');
    if (primaryFont && !COMMON_FONTS.some(f => primaryFont.toLowerCase() === f.toLowerCase())) {
      fonts.push(primaryFont);
    }
  }
  return [...new Set(fonts)];
}

export async function scanBrandFromUrl(url: string): Promise<BrandScanResult> {
  const result: BrandScanResult = {
    primaryColors: [],
    secondaryColors: [],
    accentColors: [],
    fontFamilies: {},
    scanData: {
      url,
      scannedAt: new Date().toISOString(),
      cssUrls: [],
      metaTags: {},
    },
  };

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Vantage-BrandScanner/1.0',
        'Accept': 'text/html,application/xhtml+xml',
      },
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    result.siteName = $('meta[property="og:site_name"]').attr('content') ||
                       $('title').text().split('|')[0].trim() ||
                       new URL(url).hostname;

    const ogImage = $('meta[property="og:image"]').attr('content');
    const appleTouchIcon = $('link[rel="apple-touch-icon"]').attr('href');
    const favicon = $('link[rel="icon"]').attr('href') || $('link[rel="shortcut icon"]').attr('href');
    
    result.logoUrl = ogImage || appleTouchIcon;
    result.faviconUrl = favicon ? new URL(favicon, url).href : undefined;

    $('meta').each((_, el) => {
      const name = $(el).attr('name') || $(el).attr('property');
      const content = $(el).attr('content');
      if (name && content) {
        result.scanData.metaTags[name] = content;
      }
    });

    let allCss = '';
    $('style').each((_, el) => {
      allCss += $(el).html() || '';
    });

    $('[style]').each((_, el) => {
      allCss += $(el).attr('style') || '';
    });

    const cssLinks: string[] = [];
    $('link[rel="stylesheet"]').each((_, el) => {
      const href = $(el).attr('href');
      if (href) {
        cssLinks.push(href.startsWith('http') ? href : new URL(href, url).href);
      }
    });
    result.scanData.cssUrls = cssLinks.slice(0, 5);

    for (const cssUrl of cssLinks.slice(0, 3)) {
      try {
        const cssResponse = await fetch(cssUrl, {
          headers: { 'User-Agent': 'Vantage-BrandScanner/1.0' },
          signal: AbortSignal.timeout(5000),
        });
        if (cssResponse.ok) {
          allCss += await cssResponse.text();
        }
      } catch {
      }
    }

    const colors = extractColors(allCss);
    result.primaryColors = colors.slice(0, 3);
    result.secondaryColors = colors.slice(3, 6);
    result.accentColors = colors.slice(6, 9);

    const fonts = extractFonts(allCss);
    if (fonts.length > 0) {
      result.fontFamilies.heading = fonts[0];
      result.fontFamilies.body = fonts[1] || fonts[0];
      if (fonts.length > 2) {
        result.fontFamilies.alt = fonts[2];
      }
    }

  } catch (error: any) {
    console.error('Brand scan error:', error.message);
    throw new Error(`Failed to scan brand from URL: ${error.message}`);
  }

  return result;
}
