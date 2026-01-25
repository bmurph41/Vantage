import type { CrmCompany } from "@shared/schema";

export interface CompanyDuplicateMatch {
  company: CrmCompany;
  similarityScore: number;
  matchReasons: string[];
  matchDetails: {
    nameMatch: number;
    addressMatch: number;
    overallConfidence: 'high' | 'medium' | 'low';
  };
}

const ADDRESS_ABBREVIATIONS: Record<string, string[]> = {
  'street': ['st', 'str'],
  'drive': ['dr', 'drv'],
  'avenue': ['ave', 'av'],
  'road': ['rd'],
  'boulevard': ['blvd', 'bl'],
  'lane': ['ln'],
  'court': ['ct', 'crt'],
  'place': ['pl'],
  'circle': ['cir', 'cr'],
  'highway': ['hwy', 'hw'],
  'parkway': ['pkwy', 'pky'],
  'terrace': ['ter', 'terr'],
  'way': ['wy'],
  'north': ['n'],
  'south': ['s'],
  'east': ['e'],
  'west': ['w'],
  'northeast': ['ne'],
  'northwest': ['nw'],
  'southeast': ['se'],
  'southwest': ['sw'],
  'suite': ['ste', 'su'],
  'apartment': ['apt', 'ap'],
  'building': ['bldg', 'bld'],
  'floor': ['fl', 'flr'],
};

const COMPANY_ABBREVIATIONS: Record<string, string[]> = {
  'marina': ['mar', 'mna'],
  'marinas': ['mar', 'mna'],
  'yacht': ['yc', 'yt'],
  'club': ['clb', 'c'],
  'harbor': ['hbr', 'harb', 'hrbr'],
  'harbour': ['hbr', 'harb'],
  'resort': ['rst', 'rsrt'],
  'marine': ['mar'],
  'services': ['svc', 'svcs'],
  'company': ['co'],
  'corporation': ['corp'],
  'incorporated': ['inc'],
  'limited': ['ltd'],
  'llc': ['llc', 'l.l.c.'],
  'group': ['grp'],
  'partners': ['ptrs'],
  'holdings': ['hldgs'],
  'management': ['mgmt', 'mgt'],
  'enterprises': ['ent', 'enterpr'],
  'international': ['intl', 'int'],
  'association': ['assoc', 'assn'],
  'the': [],
};

function levenshteinDistance(str1: string, str2: string): number {
  const len1 = str1.length;
  const len2 = str2.length;
  const matrix: number[][] = [];

  for (let i = 0; i <= len1; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= len2; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      if (str1[i - 1] === str2[j - 1]) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }

  return matrix[len1][len2];
}

function stringSimilarity(str1: string, str2: string): number {
  if (!str1 || !str2) return 0;
  
  const s1 = str1.toLowerCase().trim();
  const s2 = str2.toLowerCase().trim();
  
  if (s1 === s2) return 100;
  
  const maxLen = Math.max(s1.length, s2.length);
  if (maxLen === 0) return 100;
  
  const distance = levenshteinDistance(s1, s2);
  return Math.round(((maxLen - distance) / maxLen) * 100);
}

function normalizeText(text: string, abbreviations: Record<string, string[]>): string {
  if (!text) return '';
  
  let normalized = text.toLowerCase().trim();
  normalized = normalized.replace(/[.,#!$%^&*;:{}=_`~()]/g, ' ');
  normalized = normalized.replace(/\s+/g, ' ').trim();
  
  for (const [full, abbrevs] of Object.entries(abbreviations)) {
    if (abbrevs.length === 0) {
      const pattern = new RegExp(`\\b${full}\\b`, 'gi');
      normalized = normalized.replace(pattern, '');
    } else {
      const allForms = [full, ...abbrevs];
      for (const form of allForms) {
        const pattern = new RegExp(`\\b${form}\\.?\\b`, 'gi');
        normalized = normalized.replace(pattern, full);
      }
    }
  }
  
  return normalized.replace(/\s+/g, ' ').trim();
}

function normalizeCompanyName(name: string): string {
  return normalizeText(name, COMPANY_ABBREVIATIONS);
}

function normalizeAddress(address: string): string {
  return normalizeText(address, ADDRESS_ABBREVIATIONS);
}

function fuzzyCompanyMatch(name1: string, name2: string): boolean {
  const n1 = normalizeCompanyName(name1);
  const n2 = normalizeCompanyName(name2);
  
  if (n1 === n2) return true;
  
  const similarity = stringSimilarity(n1, n2);
  return similarity >= 85;
}

function addressSimilarity(
  addr1: string | undefined | null,
  city1: string | undefined | null,
  state1: string | undefined | null,
  zip1: string | undefined | null,
  addr2: string | undefined | null,
  city2: string | undefined | null,
  state2: string | undefined | null,
  zip2: string | undefined | null
): number {
  let score = 0;
  let factors = 0;
  
  if (state1 && state2) {
    factors += 2;
    if (state1.toLowerCase().trim() === state2.toLowerCase().trim()) {
      score += 2;
    }
  }
  
  if (city1 && city2) {
    factors += 2;
    const citySim = stringSimilarity(city1, city2);
    score += (citySim / 100) * 2;
  }
  
  if (zip1 && zip2) {
    factors += 1;
    if (zip1.trim() === zip2.trim()) {
      score += 1;
    } else if (zip1.substring(0, 5) === zip2.substring(0, 5)) {
      score += 0.8;
    }
  }
  
  if (addr1 && addr2) {
    factors += 3;
    const normAddr1 = normalizeAddress(addr1);
    const normAddr2 = normalizeAddress(addr2);
    const addrSim = stringSimilarity(normAddr1, normAddr2);
    score += (addrSim / 100) * 3;
  }
  
  return factors > 0 ? (score / factors) * 100 : 0;
}

export function findCompanyDuplicates(
  targetName: string,
  targetAddress: string | null | undefined,
  targetCity: string | null | undefined,
  targetState: string | null | undefined,
  targetZipCode: string | null | undefined,
  allCompanies: CrmCompany[],
  excludeId?: string,
  minSimilarityThreshold: number = 40
): CompanyDuplicateMatch[] {
  const matches: CompanyDuplicateMatch[] = [];
  
  for (const company of allCompanies) {
    if (excludeId && company.id === excludeId) continue;
    
    const matchReasons: string[] = [];
    
    const rawNameScore = stringSimilarity(targetName, company.name);
    const normalizedNameScore = stringSimilarity(
      normalizeCompanyName(targetName),
      normalizeCompanyName(company.name)
    );
    const nameScore = Math.max(rawNameScore, normalizedNameScore);
    const fuzzyMatch = fuzzyCompanyMatch(targetName, company.name);
    
    const addressScore = addressSimilarity(
      targetAddress,
      targetCity,
      targetState,
      targetZipCode,
      company.address,
      company.city,
      company.state,
      company.zipCode
    );
    
    const overallScore = (nameScore * 0.6) + (addressScore * 0.4);
    
    if (overallScore < minSimilarityThreshold) continue;
    
    if (nameScore === 100) {
      matchReasons.push("Exact name match");
    } else if (fuzzyMatch) {
      matchReasons.push("Same name (with abbreviations)");
    } else if (nameScore >= 85) {
      matchReasons.push(`Very similar name (${nameScore}%)`);
    } else if (nameScore >= 70) {
      matchReasons.push(`Similar name (${nameScore}%)`);
    }
    
    if (addressScore >= 90) {
      matchReasons.push("Same address");
    } else if (addressScore >= 70) {
      matchReasons.push("Very similar address");
    } else if (addressScore >= 50) {
      matchReasons.push("Similar location");
    }
    
    let confidence: 'high' | 'medium' | 'low';
    if (overallScore >= 80) {
      confidence = 'high';
    } else if (overallScore >= 60) {
      confidence = 'medium';
    } else {
      confidence = 'low';
    }
    
    matches.push({
      company,
      similarityScore: Math.round(overallScore),
      matchReasons,
      matchDetails: {
        nameMatch: Math.round(nameScore),
        addressMatch: Math.round(addressScore),
        overallConfidence: confidence
      }
    });
  }
  
  return matches.sort((a, b) => b.similarityScore - a.similarityScore);
}

export function getDuplicateExplanation(match: CompanyDuplicateMatch): string {
  const { similarityScore, matchReasons } = match;
  
  if (similarityScore >= 90) {
    return `Very likely duplicate (${similarityScore}% match). ${matchReasons.join(', ')}.`;
  } else if (similarityScore >= 70) {
    return `Probably duplicate (${similarityScore}% match). ${matchReasons.join(', ')}.`;
  } else if (similarityScore >= 50) {
    return `Possibly duplicate (${similarityScore}% match). ${matchReasons.join(', ')}.`;
  } else {
    return `May be related (${similarityScore}% match). ${matchReasons.join(', ')}.`;
  }
}
