import { db } from "../db";
import { docketKeywordBank } from "@shared/schema";
import { eq, and } from "drizzle-orm";

// DEFAULT_REQUIRED_TERMS - Fallback keywords if database is empty
// Covers all CRE / alternative asset classes tracked by Vantage
const DEFAULT_REQUIRED_TERMS = [
  // Marina / Waterfront
  "marina", "marina for sale", "marina broker", "marina operations", "marinas for sale",
  "boat sales", "boat slip", "dry stack", "yacht club", "boatyard", "superyacht marina",
  "megayacht", "dockage", "marine industry", "marina operator", "marina owner", "marina management",
  // Multifamily / Residential
  "apartment", "multifamily", "apartment complex", "apartment community", "rental housing",
  "affordable housing", "multifamily acquisition", "apartment sale", "housing development",
  "NMHC", "NAA", "residential investment",
  // Self-Storage
  "self storage", "self-storage", "storage facility", "public storage", "extra space storage",
  "cubesmart", "life storage", "national storage affiliates", "mini storage",
  // Industrial / Warehouse
  "industrial property", "warehouse", "distribution center", "logistics facility",
  "industrial park", "manufacturing facility", "industrial acquisition", "NAIOP",
  "industrial real estate", "cold storage", "fulfillment center",
  // Retail / Shopping Center
  "shopping center", "strip mall", "retail center", "retail property", "retail real estate",
  "ICSC", "grocery anchored", "net lease", "NNN lease", "power center",
  // Hotel / Hospitality
  "hotel", "hospitality property", "resort", "lodging", "hotel acquisition", "hotel sale",
  "RevPAR", "hotel development", "extended stay", "full-service hotel",
  // Short-Term Rental
  "short-term rental", "short term rental", "STR market", "Airbnb regulation",
  "vacation rental", "VRBO", "OTA regulation",
  // Senior Housing / Healthcare RE
  "senior housing", "assisted living", "skilled nursing facility", "memory care",
  "senior living community", "healthcare real estate", "medical office building",
  "life sciences real estate", "NIC",
  // Mobile Home Parks / Manufactured Housing
  "manufactured housing", "mobile home park", "MHP acquisition", "land lease community",
  "Sun Communities", "Equity LifeStyle", "UDC", "manufactured home",
  // Car Wash
  "car wash", "carwash", "express car wash", "ICA carwash",
  // RV Parks / Campgrounds
  "rv park", "rv resort", "campground acquisition", "outdoor hospitality", "glamping",
  "KOA", "Sun RV",
  // Office
  "office building", "office tower", "office park", "office acquisition", "office market",
  "coworking", "sublease space",
  // General CRE / Investment
  "commercial real estate", "real estate acquisition", "property acquisition",
  "real estate investment", "real estate deal", "real estate sale", "cap rate",
  "net operating income", "REIT", "real estate fund", "real estate private equity",
  "real estate portfolio", "CMBS", "bridge loan", "ground lease", "sale-leaseback",
  // Legacy / broad
  "properties", "private equity in marinas", "storage", "property investment"
];

// Cache for required keywords from database
let cachedRequiredKeywords: string[] | null = null;
let cacheTimestamp: number = 0;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

// Fetch required keywords from database
export async function fetchRequiredKeywordsFromDb(): Promise<string[]> {
  try {
    const keywords = await db
      .select({ keyword: docketKeywordBank.keyword })
      .from(docketKeywordBank)
      .where(
        and(
          eq(docketKeywordBank.isRequired, true),
          eq(docketKeywordBank.isActive, true)
        )
      );
    
    if (keywords.length === 0) {
      return DEFAULT_REQUIRED_TERMS;
    }
    
    // Get unique keywords
    return [...new Set(keywords.map(k => k.keyword.toLowerCase()))];
  } catch (error) {
    console.error("Error fetching required keywords from DB:", error);
    return DEFAULT_REQUIRED_TERMS;
  }
}

// Get required keywords with caching
export async function getRequiredKeywords(): Promise<string[]> {
  const now = Date.now();
  if (cachedRequiredKeywords && (now - cacheTimestamp) < CACHE_TTL_MS) {
    return cachedRequiredKeywords;
  }
  
  cachedRequiredKeywords = await fetchRequiredKeywordsFromDb();
  cacheTimestamp = now;
  return cachedRequiredKeywords;
}

// Invalidate cache (call when keywords are updated)
export function invalidateKeywordCache(): void {
  cachedRequiredKeywords = null;
  cacheTimestamp = 0;
}

const MARINA_TERMS = [
  "marina", "boat", "boating", "slip", "dry stack", "dock", "fuel dock", "harbor",
  "moorage", "berth", "yacht", "nautical", "boat sales", "outboard", "inboard",
  "storage", "haul", "launch", "dockmaster", "superyacht", "megayacht", "pontoon",
  "jetty", "wharf", "anchorage", "boatyard", "shipyard", "waterfront", "sailing"
];

// CRE vertical terms — scored alongside marina terms
const CRE_VERTICAL_TERMS = [
  // Multifamily
  "apartment", "multifamily", "rental housing", "tenant", "lease-up", "occupancy rate",
  "affordable housing", "workforce housing", "student housing", "senior apartments",
  // Self-Storage
  "self storage", "self-storage", "storage facility", "storage unit", "mini storage",
  // Industrial / Warehouse
  "warehouse", "distribution center", "fulfillment center", "industrial park",
  "logistics facility", "cold storage", "flex industrial",
  // Retail
  "shopping center", "strip mall", "retail center", "grocery anchored",
  "net lease", "NNN", "power center", "lifestyle center",
  // Hotel / Hospitality
  "hotel", "hospitality", "lodging", "resort", "RevPAR", "ADR", "extended stay",
  "select-service", "full-service hotel", "hotel flag",
  // Short-Term Rental
  "short-term rental", "vacation rental", "STR", "Airbnb", "VRBO",
  // Senior Housing / Healthcare
  "senior housing", "assisted living", "skilled nursing", "memory care",
  "senior living", "healthcare real estate", "medical office",
  // Mobile Home Parks
  "manufactured housing", "mobile home park", "land lease community",
  // Car Wash
  "car wash", "carwash", "express wash",
  // RV Parks
  "rv park", "campground", "glamping", "outdoor hospitality",
  // Office
  "office building", "office park", "coworking", "flex office",
  // General CRE
  "commercial real estate", "real estate acquisition", "cap rate", "NOI",
  "REIT", "real estate fund", "CMBS", "ground lease", "sale-leaseback",
  "real estate private equity", "real estate portfolio"
];

const INVESTMENT_TERMS = [
  "acquisition", "sale", "sold", "transaction", "valuation", "capex", "capital",
  "private equity", "merger", "fund", "cap rate", "NOI", "EBITDA", "LOI",
  "investment", "investor", "financing", "loan", "revenue", "profit", "ROI",
  "portfolio", "asset", "development", "expansion", "growth", "market"
];

const MACRO_TERMS = [
  "inflation", "fed", "federal reserve", "interest rate", "rates", "cpi", "jobs", 
  "consumer spending", "recession", "gdp", "treasury", "sofr", "insurance", 
  "hurricane", "flood", "climate", "economy", "economic", "market conditions",
  "supply chain", "labor", "wage", "cost", "price", "demand"
];

const OPERATIONAL_TERMS = [
  "operations", "management", "technology", "software", "automation", "efficiency",
  "maintenance", "repair", "upgrade", "renovation", "construction", "permitting",
  "zoning", "environmental", "compliance", "safety", "security", "staff",
  "training", "customer", "service", "amenities", "facilities"
];

const REGULATORY_TERMS = [
  "regulation", "regulatory", "compliance", "permit", "license", "zoning",
  "environmental", "EPA", "coast guard", "maritime law", "legislation",
  "policy", "tax", "tariff", "trade", "import", "export", "customs"
];

// Check if article has at least one required marina keyword (uses cached/fallback keywords)
export function hasRequiredMarinaKeyword(title: string, content: string): boolean {
  const text = `${title} ${content}`.toLowerCase();
  // Use cached keywords if available, otherwise use defaults
  const keywords = cachedRequiredKeywords || DEFAULT_REQUIRED_TERMS;
  return keywords.some(term => text.includes(term.toLowerCase()));
}

// Async version that ensures fresh keywords from database
export async function hasRequiredMarinaKeywordAsync(title: string, content: string): Promise<boolean> {
  const text = `${title} ${content}`.toLowerCase();
  const keywords = await getRequiredKeywords();
  return keywords.some(term => text.includes(term.toLowerCase()));
}

// Get matched required keywords (for debugging/logging)
export function getMatchedRequiredKeywords(title: string, content: string): string[] {
  const text = `${title} ${content}`.toLowerCase();
  const keywords = cachedRequiredKeywords || DEFAULT_REQUIRED_TERMS;
  return keywords.filter(term => text.includes(term.toLowerCase()));
}

// Async version for matched keywords
export async function getMatchedRequiredKeywordsAsync(title: string, content: string): Promise<string[]> {
  const text = `${title} ${content}`.toLowerCase();
  const keywords = await getRequiredKeywords();
  return keywords.filter(term => text.includes(term.toLowerCase()));
}

export function scoreArticle(title: string, content: string, source: string): number {
  const text = `${title} ${content}`.toLowerCase();
  let score = 0;

  // Require at least one CRE / asset-class keyword to be present
  const hasRequired = hasRequiredMarinaKeyword(title, content);
  if (!hasRequired) {
    // Allow if the source name clearly belongs to a known CRE vertical
    const isCRESource = /marina|boating|dock|yacht|maritime|apartment|multifamily|storage|hotel|hospitality|industrial|retail|senior.hous|car.wash|rv.park|campground|manufactured/i.test(source);
    if (!isCRESource) {
      return 0;
    }
  }

  // Base score for known industry-vertical sources
  if (/marina|boating|dock|yacht|maritime|superyacht/i.test(source)) {
    score += 20;
  } else if (/apartment|multifamily|storage|hotel|hospitality|industrial|retail|senior.hous|car.wash|rv.park|campground|manufactured/i.test(source)) {
    score += 15;
  }

  // Score marina-specific terms
  const marinaMatches = MARINA_TERMS.filter(term => text.includes(term)).length;
  score += Math.min(marinaMatches * 8, 40);

  // Score other CRE vertical terms (same weight cap, additive with marina)
  const creMatches = CRE_VERTICAL_TERMS.filter(term => text.includes(term)).length;
  score += Math.min(creMatches * 8, 40);

  // Investment relevance
  const investmentMatches = INVESTMENT_TERMS.filter(term => text.includes(term)).length;
  score += Math.min(investmentMatches * 5, 25);

  // Macro economic relevance
  const macroMatches = MACRO_TERMS.filter(term => text.includes(term)).length;
  score += Math.min(macroMatches * 3, 15);

  // Operational relevance
  const operationalMatches = OPERATIONAL_TERMS.filter(term => text.includes(term)).length;
  score += Math.min(operationalMatches * 4, 20);

  // Regulatory relevance
  const regulatoryMatches = REGULATORY_TERMS.filter(term => text.includes(term)).length;
  score += Math.min(regulatoryMatches * 3, 15);

  // Bonus for explicit marina mentions
  const marinaCount = (text.match(/\bmarina\b/g) || []).length;
  score += Math.min(marinaCount * 5, 15);

  // Bonus for financial figures (indicates investment relevance)
  if (/\$[\d,]+|€[\d,]+|£[\d,]+|million|billion/i.test(text)) {
    score += 10;
  }

  // Bonus for US location mentions
  if (/florida|california|texas|new york|arizona|nevada|colorado|georgia|carolinas|mediterranean|caribbean/i.test(text)) {
    score += 5;
  }

  // Penalty for clearly irrelevant content (commercial shipping without RE context)
  if (/cruise ship|cargo ship|container ship|oil rig|fishing vessel|commercial vessel/i.test(text) &&
      !/(marina|yacht|boat|real estate|property|acquisition)/i.test(text)) {
    score -= 15;
  }

  return Math.max(0, Math.min(100, score));
}

export function getRelevanceCategory(score: number): string {
  if (score >= 80) return "High";
  if (score >= 60) return "Medium";
  if (score >= 40) return "Low";
  return "Very Low";
}

export function shouldIncludeArticle(score: number, category?: string): boolean {
  // Include high relevance articles regardless
  if (score >= 80) return true;
  
  // Include medium relevance if it's investment or macro category
  if (score >= 60 && (category === "Investment" || category === "Macro")) return true;
  
  // Include operational/regulatory if moderate relevance
  if (score >= 50 && (category === "Operations" || category === "Regulatory")) return true;
  
  // Exclude low relevance articles
  return score >= 70;
}

// Async version that loads required keywords from database before scoring
export async function scoreArticleAsync(title: string, content: string, source: string): Promise<number> {
  const text = `${title} ${content}`.toLowerCase();
  let score = 0;

  // Require at least one CRE / asset-class keyword (DB-driven, falls back to DEFAULT_REQUIRED_TERMS)
  const hasRequired = await hasRequiredMarinaKeywordAsync(title, content);
  if (!hasRequired) {
    const isCRESource = /marina|boating|dock|yacht|maritime|apartment|multifamily|storage|hotel|hospitality|industrial|retail|senior.hous|car.wash|rv.park|campground|manufactured/i.test(source);
    if (!isCRESource) {
      return 0;
    }
  }

  // Base score for known industry-vertical sources
  if (/marina|boating|dock|yacht|maritime|superyacht/i.test(source)) {
    score += 20;
  } else if (/apartment|multifamily|storage|hotel|hospitality|industrial|retail|senior.hous|car.wash|rv.park|campground|manufactured/i.test(source)) {
    score += 15;
  }

  // Score marina-specific terms
  const marinaMatches = MARINA_TERMS.filter(term => text.includes(term)).length;
  score += Math.min(marinaMatches * 8, 40);

  // Score other CRE vertical terms
  const creMatches = CRE_VERTICAL_TERMS.filter(term => text.includes(term)).length;
  score += Math.min(creMatches * 8, 40);

  // Investment relevance
  const investmentMatches = INVESTMENT_TERMS.filter(term => text.includes(term)).length;
  score += Math.min(investmentMatches * 5, 25);

  // Macro economic relevance
  const macroMatches = MACRO_TERMS.filter(term => text.includes(term)).length;
  score += Math.min(macroMatches * 3, 15);

  // Operational relevance
  const operationalMatches = OPERATIONAL_TERMS.filter(term => text.includes(term)).length;
  score += Math.min(operationalMatches * 4, 20);

  // Regulatory relevance
  const regulatoryMatches = REGULATORY_TERMS.filter(term => text.includes(term)).length;
  score += Math.min(regulatoryMatches * 3, 15);

  // Bonus for explicit marina mentions
  const marinaCount = (text.match(/\bmarina\b/g) || []).length;
  score += Math.min(marinaCount * 5, 15);

  // Bonus for financial figures
  if (/\$[\d,]+|€[\d,]+|£[\d,]+|million|billion/i.test(text)) {
    score += 10;
  }

  // Bonus for US location mentions
  if (/florida|california|texas|new york|arizona|nevada|colorado|georgia|carolinas|mediterranean|caribbean/i.test(text)) {
    score += 5;
  }

  // Penalty for clearly irrelevant content
  if (/cruise ship|cargo ship|container ship|oil rig|fishing vessel|commercial vessel/i.test(text) &&
      !/(marina|yacht|boat|real estate|property|acquisition)/i.test(text)) {
    score -= 15;
  }

  return Math.max(0, Math.min(100, score));
}
