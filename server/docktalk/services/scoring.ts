import { db } from "../db";
import { docktalkKeywordBank } from "@shared/schema";
import { eq, and } from "drizzle-orm";

// REQUIRED_MARINA_TERMS - Fallback keywords if database is empty
// These are the core keywords that signal marina industry relevance
const DEFAULT_REQUIRED_TERMS = [
  "marina", "marina for sale", "marina broker", "marina investment", "marina operations",
  "marinas for sale", "marinas", "boat sales", "private equity in marinas", "boat slip",
  "dry stack", "yacht club", "boatyard", "superyacht marina", "megayacht", "dockage",
  "boat storage", "marine industry", "marina operator", "marina owner", "marina management"
];

// Cache for required keywords from database
let cachedRequiredKeywords: string[] | null = null;
let cacheTimestamp: number = 0;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

// Fetch required keywords from database
export async function fetchRequiredKeywordsFromDb(): Promise<string[]> {
  try {
    const keywords = await db
      .select({ keyword: docktalkKeywordBank.keyword })
      .from(docktalkKeywordBank)
      .where(
        and(
          eq(docktalkKeywordBank.isRequired, true),
          eq(docktalkKeywordBank.isActive, true)
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

  // CRITICAL: Check for required marina keyword first
  // If no required marina keyword is found, return 0 immediately
  const hasRequired = hasRequiredMarinaKeyword(title, content);
  if (!hasRequired) {
    // Only allow if it's from a known marina-industry source AND has some marina context
    const isFromMarinaSource = /marina|boating|dock|yacht|maritime|superyacht/i.test(source);
    const hasAnyMarinaContext = MARINA_TERMS.some(term => text.includes(term));
    if (!isFromMarinaSource || !hasAnyMarinaContext) {
      return 0; // Reject articles without marina relevance
    }
  }

  // Base score for marina industry sources
  if (/marina|boating|dock|yacht|maritime|superyacht/i.test(source)) {
    score += 20;
  }

  // Score based on marina-specific terms
  const marinaMatches = MARINA_TERMS.filter(term => text.includes(term)).length;
  score += Math.min(marinaMatches * 8, 40);

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

  // Bonus for location mentions (marinas are location-specific)
  if (/florida|california|mediterranean|caribbean|bahamas|monaco|france|italy|spain|greece/i.test(text)) {
    score += 5;
  }

  // Penalty for irrelevant content
  if (/cruise ship|cargo|container|oil|gas|fishing|commercial vessel/i.test(text) && 
      !/(marina|yacht|boat)/i.test(text)) {
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

  // CRITICAL: Check for required marina keyword first using database keywords
  const hasRequired = await hasRequiredMarinaKeywordAsync(title, content);
  if (!hasRequired) {
    // Only allow if it's from a known marina-industry source AND has some marina context
    const isFromMarinaSource = /marina|boating|dock|yacht|maritime|superyacht/i.test(source);
    const hasAnyMarinaContext = MARINA_TERMS.some(term => text.includes(term));
    if (!isFromMarinaSource || !hasAnyMarinaContext) {
      return 0; // Reject articles without marina relevance
    }
  }

  // Base score for marina industry sources
  if (/marina|boating|dock|yacht|maritime|superyacht/i.test(source)) {
    score += 20;
  }

  // Score based on marina-specific terms
  const marinaMatches = MARINA_TERMS.filter(term => text.includes(term)).length;
  score += Math.min(marinaMatches * 8, 40);

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

  // Bonus for location mentions (marinas are location-specific)
  if (/florida|california|mediterranean|caribbean|bahamas|monaco|france|italy|spain|greece/i.test(text)) {
    score += 5;
  }

  // Penalty for irrelevant content
  if (/cruise ship|cargo|container|oil|gas|fishing|commercial vessel/i.test(text) && 
      !/(marina|yacht|boat)/i.test(text)) {
    score -= 15;
  }

  return Math.max(0, Math.min(100, score));
}
