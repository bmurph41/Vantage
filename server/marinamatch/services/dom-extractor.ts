import * as cheerio from "cheerio";
import type { ExtractedListing } from "./ai-extractor";

interface SiteConfig {
  name: string;
  domains: string[];
  selectors: {
    listingContainer: string[];
    title: string[];
    price: string[];
    location: string[];
    slips: string[];
    image: string[];
    description: string[];
    broker: string[];
    link: string[];
  };
}

const SITE_CONFIGS: SiteConfig[] = [
  {
    name: "National Marina Sales",
    domains: ["nationalmarinasales.com", "marinasales.com"],
    selectors: {
      listingContainer: [".listing-card", ".property-card", ".marina-listing", "article"],
      title: ["h2 a", ".title a", ".listing-title", "h3 a", ".property-name"],
      price: [".price", ".asking-price", "[class*='price']", "span:contains('$')"],
      location: [".location", ".address", "[class*='location']", ".city-state"],
      slips: ["[class*='slip']", "[class*='dock']", "span:contains('slip')"],
      image: ["img.property-image", ".listing-image img", "img[src*='marina']", "img:first"],
      description: [".description", ".summary", "[class*='desc']", "p"],
      broker: [".broker", ".agent", "[class*='broker']", "[class*='agent']"],
      link: ["a[href*='listing']", "a[href*='property']", "a[href*='detail']"],
    },
  },
  {
    name: "LIPG",
    domains: ["lipg.com", "lipgmarinas.com"],
    selectors: {
      listingContainer: [".listing", ".property", "article", ".card"],
      title: ["h2", "h3", ".title", ".property-name"],
      price: [".price", "[class*='price']", "span:contains('$')"],
      location: [".location", ".address", ".city"],
      slips: ["[class*='slip']", "span:contains('slip')"],
      image: ["img.featured", "img:first", "[class*='image'] img"],
      description: [".description", ".summary", "p"],
      broker: [".contact", ".broker", ".agent"],
      link: ["a[href]"],
    },
  },
  {
    name: "Simply Marinas",
    domains: ["simplymarinas.com"],
    selectors: {
      listingContainer: [".marina-card", ".listing", ".property-card", "article"],
      title: ["h2 a", ".marina-name", ".title"],
      price: [".price", "[class*='price']"],
      location: [".location", ".address", "[class*='location']"],
      slips: ["[class*='slip']", ".capacity", "span:contains('slip')"],
      image: ["img.marina-image", "img:first"],
      description: [".description", ".about"],
      broker: [".contact", ".broker"],
      link: ["a[href*='marina']"],
    },
  },
  {
    name: "SVN Commercial",
    domains: ["svn.com"],
    selectors: {
      listingContainer: [".property-card", ".listing-item", "article"],
      title: ["h3", ".property-title", ".title"],
      price: [".price", "[class*='price']", ".asking-price"],
      location: [".location", ".address", ".property-address"],
      slips: ["[class*='slip']", ".details span"],
      image: ["img.property-image", "img:first"],
      description: [".description", ".property-description"],
      broker: [".broker-info", ".contact"],
      link: ["a[href*='property']"],
    },
  },
  {
    name: "Colliers",
    domains: ["colliers.com"],
    selectors: {
      listingContainer: [".property-listing", ".search-result", "article"],
      title: [".property-title", "h2", "h3"],
      price: [".price", "[class*='price']"],
      location: [".location", ".address"],
      slips: ["[class*='slip']", ".property-details span"],
      image: [".property-image img", "img:first"],
      description: [".property-description", ".description"],
      broker: [".broker", ".contact"],
      link: ["a[href*='property']"],
    },
  },
  {
    name: "GovDeals",
    domains: ["govdeals.com"],
    selectors: {
      listingContainer: [".auction-item", ".listing", ".item"],
      title: [".item-title", ".title", "h3 a"],
      price: [".current-bid", ".price", "[class*='bid']"],
      location: [".location", ".seller-info", "[class*='location']"],
      slips: [],
      image: [".item-image img", "img:first"],
      description: [".description", ".item-description"],
      broker: [".seller", ".agency"],
      link: ["a[href*='item']"],
    },
  },
];

const GENERIC_SELECTORS: SiteConfig["selectors"] = {
  listingContainer: [
    ".listing-card", ".property-card", ".search-result", ".result-card",
    "[data-listing]", "[data-property]", ".listing", ".property",
    "article.listing", "article.property", ".card",
  ],
  title: [
    "h2 a", "h3 a", ".title a", ".listing-title", ".property-title",
    ".property-name", "h2", "h3",
  ],
  price: [
    ".price", ".asking-price", "[class*='price']", "[class*='Price']",
    "span:contains('$')", ".amount",
  ],
  location: [
    ".location", ".address", "[class*='location']", ".city-state",
    "[class*='address']", ".property-location",
  ],
  slips: [
    "[class*='slip']", "[class*='dock']", "[class*='Slip']",
    "span:contains('slip')", "span:contains('Slip')",
  ],
  image: [
    "img.property-image", "img.listing-image", ".hero-image img",
    "[class*='image'] img", "img[src*='property']", "img:first",
  ],
  description: [
    ".description", ".summary", "[class*='desc']",
    ".property-description", ".listing-description", "p",
  ],
  broker: [
    ".broker", ".agent", "[class*='broker']", "[class*='agent']",
    ".contact-info", ".realtor",
  ],
  link: [
    "a[href*='listing']", "a[href*='property']", "a[href*='detail']",
    "a[href*='/p/']", "a[href*='/l/']",
  ],
};

function getSiteConfig(url: string): SiteConfig | null {
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    return SITE_CONFIGS.find(config =>
      config.domains.some(domain => hostname.includes(domain))
    ) || null;
  } catch {
    return null;
  }
}

function extractFirst($el: cheerio.Cheerio<cheerio.Element>, $: cheerio.CheerioAPI, selectors: string[]): string | undefined {
  for (const selector of selectors) {
    try {
      const found = $el.find(selector).first();
      if (found.length > 0) {
        const text = found.text().trim();
        if (text) return text;
      }
    } catch {
      continue;
    }
  }
  return undefined;
}

function extractImageUrl($el: cheerio.Cheerio<cheerio.Element>, $: cheerio.CheerioAPI, selectors: string[], baseUrl: string): string | undefined {
  for (const selector of selectors) {
    try {
      const img = $el.find(selector).first();
      if (img.length > 0) {
        const src = img.attr("src") || img.attr("data-src") || img.attr("data-lazy-src");
        if (src && !src.includes("placeholder") && !src.includes("icon") && !src.includes("logo")) {
          if (src.startsWith("http")) return src;
          if (src.startsWith("//")) return `https:${src}`;
          if (src.startsWith("/")) return `${baseUrl}${src}`;
          return src;
        }
      }
    } catch {
      continue;
    }
  }
  return undefined;
}

function parsePrice(priceText: string | undefined): number | undefined {
  if (!priceText) return undefined;
  
  const text = priceText.toLowerCase().trim();
  
  const rangeMatch = text.match(/\$?([\d,.]+)\s*(?:-|to)\s*\$?([\d,.]+)\s*(m|mm|million|k|thousand)?/i);
  if (rangeMatch) {
    const lowVal = parseFloat(rangeMatch[1].replace(/,/g, ""));
    const highVal = parseFloat(rangeMatch[2].replace(/,/g, ""));
    const suffix = (rangeMatch[3] || "").toLowerCase();
    let multiplier = 1;
    if (suffix === "m" || suffix === "mm" || suffix === "million") multiplier = 1_000_000;
    if (suffix === "k" || suffix === "thousand") multiplier = 1_000;
    const avgVal = ((lowVal + highVal) / 2) * multiplier;
    if (!isNaN(avgVal) && avgVal > 10000 && avgVal < 500000000) {
      return Math.round(avgVal);
    }
  }
  
  const millionMatch = text.match(/\$?([\d,.]+)\s*(m|mm|million)/i);
  if (millionMatch) {
    const num = parseFloat(millionMatch[1].replace(/,/g, ""));
    if (!isNaN(num)) {
      const result = num * 1_000_000;
      if (result > 10000 && result < 500000000) {
        return Math.round(result);
      }
    }
  }
  
  const thousandMatch = text.match(/\$?([\d,.]+)\s*(k|thousand)/i);
  if (thousandMatch) {
    const num = parseFloat(thousandMatch[1].replace(/,/g, ""));
    if (!isNaN(num)) {
      const result = num * 1_000;
      if (result > 10000 && result < 500000000) {
        return Math.round(result);
      }
    }
  }
  
  const cleaned = priceText.replace(/[^0-9.]/g, "");
  const num = parseFloat(cleaned);
  if (!isNaN(num) && num > 10000 && num < 500000000) {
    return Math.round(num);
  }
  
  return undefined;
}

function parseSlips(slipText: string | undefined): number | undefined {
  if (!slipText) return undefined;
  const match = slipText.match(/(\d+)\s*(?:slip|dock|space|unit)/i);
  if (match) {
    const num = parseInt(match[1], 10);
    if (num > 0 && num < 5000) return num;
  }
  const numMatch = slipText.match(/(\d+)/);
  if (numMatch) {
    const num = parseInt(numMatch[1], 10);
    if (num > 0 && num < 5000) return num;
  }
  return undefined;
}

function parseLocation(locationText: string | undefined): { city?: string; state?: string } {
  if (!locationText) return {};
  const statePattern = /\b([A-Z]{2})\b/;
  const stateMatch = locationText.match(statePattern);
  const state = stateMatch ? stateMatch[1] : undefined;
  const cityStatePattern = /([A-Za-z\s]+),\s*([A-Z]{2})/;
  const cityStateMatch = locationText.match(cityStatePattern);
  const city = cityStateMatch ? cityStateMatch[1].trim() : undefined;
  return { city, state };
}

function extractLink($el: cheerio.Cheerio<cheerio.Element>, $: cheerio.CheerioAPI, selectors: string[], baseUrl: string): string | undefined {
  for (const selector of selectors) {
    try {
      const link = $el.find(selector).first();
      if (link.length > 0) {
        const href = link.attr("href");
        if (href && !href.includes("javascript:") && !href.startsWith("#")) {
          if (href.startsWith("http")) return href;
          if (href.startsWith("/")) return `${baseUrl}${href}`;
          return href;
        }
      }
    } catch {
      continue;
    }
  }
  const directLink = $el.find("a").first();
  if (directLink.length > 0) {
    const href = directLink.attr("href");
    if (href && !href.includes("javascript:") && !href.startsWith("#")) {
      if (href.startsWith("http")) return href;
      if (href.startsWith("/")) return `${baseUrl}${href}`;
    }
  }
  return undefined;
}

function isMarinaListing(text: string): boolean {
  const marinaKeywords = [
    "marina", "boat", "slip", "dock", "yacht", "waterfront", "boatyard",
    "sailboat", "powerboat", "mooring", "waterway", "icw", "intracoastal",
    "fuel dock", "dry storage", "wet slip", "boat ramp", "marine"
  ];
  const lowerText = text.toLowerCase();
  return marinaKeywords.some(keyword => lowerText.includes(keyword));
}

export function extractListingsWithDOM(
  html: string,
  url: string,
  platformName: string
): ExtractedListing[] {
  const $ = cheerio.load(html);
  const baseUrl = new URL(url).origin;
  const siteConfig = getSiteConfig(url);
  const selectors = siteConfig?.selectors || GENERIC_SELECTORS;
  const listings: ExtractedListing[] = [];

  console.log(`[DOM Extractor] Using ${siteConfig ? siteConfig.name : 'generic'} selectors for ${platformName}`);

  $("script, style, noscript, iframe, svg, nav, footer, header").remove();
  $("[style*='display:none'], [style*='display: none'], .hidden, .d-none").remove();

  let foundContainers = false;
  for (const containerSelector of selectors.listingContainer) {
    const containers = $(containerSelector);
    if (containers.length > 0) {
      foundContainers = true;
      console.log(`[DOM Extractor] Found ${containers.length} containers with selector: ${containerSelector}`);
      
      containers.each((i, el) => {
        const $el = $(el);
        const cardText = $el.text();

        if (!isMarinaListing(cardText)) {
          return;
        }

        const title = extractFirst($el, $, selectors.title);
        if (!title || title.length < 5) return;

        const priceText = extractFirst($el, $, selectors.price);
        const locationText = extractFirst($el, $, selectors.location);
        const slipText = extractFirst($el, $, selectors.slips);
        const description = extractFirst($el, $, selectors.description);
        const brokerText = extractFirst($el, $, selectors.broker);
        const heroImageUrl = extractImageUrl($el, $, selectors.image, baseUrl);
        const sourceUrl = extractLink($el, $, selectors.link, baseUrl) || url;

        const price = parsePrice(priceText);
        const totalSlips = parseSlips(slipText);
        const { city, state } = parseLocation(locationText);

        const listing: ExtractedListing = {
          title,
          propertyName: title,
          city,
          state,
          askingPrice: price,
          totalSlips,
          pricePerSlip: price && totalSlips ? Math.round(price / totalSlips) : undefined,
          heroImageUrl,
          originalDescription: description?.substring(0, 2000),
          brokerName: brokerText,
          sourceUrl,
          attributionText: `Source: ${platformName} - View original listing`,
          confidence: 50,
        };

        listings.push(listing);
      });

      if (listings.length > 0) {
        break;
      }
    }
  }

  if (!foundContainers || listings.length === 0) {
    console.log(`[DOM Extractor] No containers found, trying page-wide extraction...`);
    
    const fullText = $("body").text();
    if (isMarinaListing(fullText)) {
      const pageTitle = $("h1").first().text().trim() || $("title").text().trim();
      const priceMatch = fullText.match(/\$[\d,]+(?:\.\d{2})?(?:\s*(?:million|M|MM))?/i);
      const slipMatch = fullText.match(/(\d+)\s*(?:slip|dock|space|unit)/i);
      const locationMatch = fullText.match(/([A-Za-z\s]+),\s*([A-Z]{2})\s*\d{5}?/);

      if (pageTitle && pageTitle.length > 5) {
        const price = priceMatch ? parsePrice(priceMatch[0]) : undefined;
        const totalSlips = slipMatch ? parseInt(slipMatch[1], 10) : undefined;

        const listing: ExtractedListing = {
          title: pageTitle,
          propertyName: pageTitle,
          city: locationMatch ? locationMatch[1].trim() : undefined,
          state: locationMatch ? locationMatch[2] : undefined,
          askingPrice: price,
          totalSlips,
          pricePerSlip: price && totalSlips ? Math.round(price / totalSlips) : undefined,
          heroImageUrl: $("img").first().attr("src") || undefined,
          originalDescription: $("p").slice(0, 3).text().substring(0, 2000),
          sourceUrl: url,
          attributionText: `Source: ${platformName} - View original listing`,
          confidence: 35,
        };

        listings.push(listing);
      }
    }
  }

  console.log(`[DOM Extractor] Extracted ${listings.length} listings via DOM parsing`);
  return listings;
}

export function canUseDOMExtraction(url: string): boolean {
  const siteConfig = getSiteConfig(url);
  return siteConfig !== null;
}

export function getDOMExtractionSites(): string[] {
  return SITE_CONFIGS.map(config => config.name);
}
