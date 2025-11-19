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

export function scoreArticle(title: string, content: string, source: string): number {
  const text = `${title} ${content}`.toLowerCase();
  let score = 0;

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
