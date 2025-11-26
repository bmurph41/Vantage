import { db } from "../db";
import { crmCompanies } from "@shared/schema";
import { eq, ilike, or, and } from "drizzle-orm";

export interface CrmCompanyMatch {
  id: string;
  name: string;
  domain: string | null;
  industry: string | null;
  website: string | null;
  matchScore: number;
  matchReason: string;
}

export interface MatchResult {
  exactMatch: CrmCompanyMatch | null;
  suggestions: CrmCompanyMatch[];
}

function normalizeCompanyName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, "")
    .replace(/\b(inc|llc|ltd|corp|corporation|company|co|llp|lp|group|holdings|international|intl)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

function calculateSimilarity(str1: string, str2: string): number {
  const s1 = normalizeCompanyName(str1);
  const s2 = normalizeCompanyName(str2);
  
  if (s1 === s2) return 100;
  
  if (s1.includes(s2) || s2.includes(s1)) {
    const longer = s1.length > s2.length ? s1 : s2;
    const shorter = s1.length > s2.length ? s2 : s1;
    return Math.floor((shorter.length / longer.length) * 90);
  }
  
  const words1 = s1.split(" ").filter(w => w.length > 2);
  const words2 = s2.split(" ").filter(w => w.length > 2);
  const commonWords = words1.filter(w => words2.includes(w));
  
  if (commonWords.length > 0) {
    const maxWords = Math.max(words1.length, words2.length);
    return Math.floor((commonWords.length / maxWords) * 80);
  }
  
  const maxLen = Math.max(s1.length, s2.length);
  const distance = levenshteinDistance(s1, s2);
  const similarity = Math.floor(((maxLen - distance) / maxLen) * 100);
  
  return Math.max(0, similarity);
}

function levenshteinDistance(str1: string, str2: string): number {
  const m = str1.length;
  const n = str2.length;
  
  if (m === 0) return n;
  if (n === 0) return m;
  
  const dp: number[][] = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));
  
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (str1[i - 1] === str2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
      }
    }
  }
  
  return dp[m][n];
}

function extractDomain(website: string | null): string | null {
  if (!website) return null;
  try {
    const url = website.startsWith("http") ? website : `https://${website}`;
    const hostname = new URL(url).hostname;
    return hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return website.toLowerCase().replace(/^www\./, "");
  }
}

export async function findMatchingCrmCompanies(
  companyName: string,
  orgId: string,
  domain?: string
): Promise<MatchResult> {
  const normalizedName = normalizeCompanyName(companyName);
  const searchDomain = domain ? extractDomain(domain) : null;
  
  const allCompanies = await db
    .select()
    .from(crmCompanies)
    .where(eq(crmCompanies.ownerId, orgId));
  
  const matches: CrmCompanyMatch[] = [];
  let exactMatch: CrmCompanyMatch | null = null;
  
  for (const company of allCompanies) {
    let matchScore = 0;
    let matchReason = "";
    
    const companyDomain = extractDomain(company.website || company.domain);
    if (searchDomain && companyDomain && searchDomain === companyDomain) {
      matchScore = 100;
      matchReason = "Exact domain match";
    } else {
      const nameSimilarity = calculateSimilarity(companyName, company.name);
      matchScore = nameSimilarity;
      
      if (nameSimilarity === 100) {
        matchReason = "Exact name match";
      } else if (nameSimilarity >= 80) {
        matchReason = "Very similar name";
      } else if (nameSimilarity >= 60) {
        matchReason = "Similar name";
      } else if (nameSimilarity >= 40) {
        matchReason = "Partial name match";
      } else {
        continue;
      }
    }
    
    const result: CrmCompanyMatch = {
      id: company.id,
      name: company.name,
      domain: company.domain,
      industry: company.industry,
      website: company.website,
      matchScore,
      matchReason,
    };
    
    if (matchScore === 100) {
      exactMatch = result;
    }
    
    if (matchScore >= 40) {
      matches.push(result);
    }
  }
  
  const suggestions = matches
    .filter(m => m !== exactMatch)
    .sort((a, b) => b.matchScore - a.matchScore)
    .slice(0, 5);
  
  return {
    exactMatch,
    suggestions,
  };
}

export async function searchCrmCompanies(
  query: string,
  orgId: string,
  limit: number = 10
): Promise<CrmCompanyMatch[]> {
  const companies = await db
    .select()
    .from(crmCompanies)
    .where(
      and(
        eq(crmCompanies.ownerId, orgId),
        or(
          ilike(crmCompanies.name, `%${query}%`),
          ilike(crmCompanies.domain, `%${query}%`)
        )
      )
    )
    .limit(limit);
  
  return companies.map(company => ({
    id: company.id,
    name: company.name,
    domain: company.domain,
    industry: company.industry,
    website: company.website,
    matchScore: 100,
    matchReason: "Search result",
  }));
}
