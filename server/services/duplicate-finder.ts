/**
 * Advanced Duplicate Detection Service
 * 
 * Provides comprehensive duplicate detection for properties with similarity scoring.
 * Helps users make informed decisions about potential duplicates.
 */

import type { Property } from "@shared/schema";

export interface DuplicateMatch {
  property: Property;
  similarityScore: number;
  matchReasons: string[];
  matchDetails: {
    nameMatch: number;
    locationMatch: number;
    priceMatch?: number;
    overallConfidence: 'high' | 'medium' | 'low';
  };
}

/**
 * Calculate Levenshtein distance between two strings (edit distance)
 */
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
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        );
      }
    }
  }

  return matrix[len1][len2];
}

/**
 * Calculate similarity percentage between two strings (0-100)
 */
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

/**
 * Check if two strings are likely the same with common abbreviations
 */
function fuzzyNameMatch(name1: string, name2: string): boolean {
  const n1 = name1.toLowerCase().trim();
  const n2 = name2.toLowerCase().trim();
  
  // Exact match
  if (n1 === n2) return true;
  
  // Common marina abbreviations
  const abbrevMap: Record<string, string[]> = {
    'marina': ['mar', 'mna'],
    'yacht': ['yc', 'yt'],
    'club': ['clb', 'c'],
    'harbor': ['hbr', 'harb', 'hrbr'],
    'harbour': ['hbr', 'harb'],
    'resort': ['rst', 'rsrt'],
    'village': ['vlg', 'vill'],
    'center': ['ctr', 'cntr'],
    'point': ['pt', 'pnt'],
    'island': ['isl', 'is'],
    'beach': ['bch', 'bh'],
    'bay': ['b'],
    'lake': ['lk', 'l'],
    'river': ['rvr', 'r'],
  };
  
  // Normalize with common abbreviations
  let normalized1 = n1;
  let normalized2 = n2;
  
  for (const [full, abbrevs] of Object.entries(abbrevMap)) {
    const pattern = new RegExp(`\\b(${full}|${abbrevs.join('|')})\\b`, 'gi');
    normalized1 = normalized1.replace(pattern, full);
    normalized2 = normalized2.replace(pattern, full);
  }
  
  return normalized1 === normalized2;
}

/**
 * Calculate location similarity
 */
function locationSimilarity(
  city1: string | undefined | null,
  state1: string | undefined | null,
  city2: string | undefined | null,
  state2: string | undefined | null
): number {
  let score = 0;
  let factors = 0;
  
  // State match (more important)
  if (state1 && state2) {
    factors += 2;
    if (state1.toLowerCase().trim() === state2.toLowerCase().trim()) {
      score += 2;
    }
  }
  
  // City match
  if (city1 && city2) {
    factors += 1;
    const citySim = stringSimilarity(city1, city2);
    score += citySim / 100;
  }
  
  return factors > 0 ? (score / factors) * 100 : 0;
}

/**
 * Calculate price similarity (if both have prices)
 */
function priceSimilarity(price1: number | null | undefined, price2: number | null | undefined): number {
  if (!price1 || !price2) return 0;
  
  const diff = Math.abs(price1 - price2);
  const avg = (price1 + price2) / 2;
  
  if (avg === 0) return 100;
  
  const percentDiff = (diff / avg) * 100;
  
  // If within 10%, very similar
  if (percentDiff <= 10) return 100;
  // If within 25%, somewhat similar
  if (percentDiff <= 25) return 75;
  // If within 50%, marginally similar
  if (percentDiff <= 50) return 50;
  
  return 0;
}

/**
 * Find all potential duplicate properties for a given property
 */
export function findAllPotentialDuplicates(
  targetName: string,
  targetCity: string | null | undefined,
  targetState: string | null | undefined,
  targetPrice: number | null | undefined,
  allProperties: Property[],
  minSimilarityThreshold: number = 30
): DuplicateMatch[] {
  const matches: DuplicateMatch[] = [];
  
  for (const property of allProperties) {
    const matchReasons: string[] = [];
    
    // Calculate name similarity
    const nameScore = stringSimilarity(targetName, property.title);
    const fuzzyMatch = fuzzyNameMatch(targetName, property.title);
    
    // Calculate location similarity
    const locationScore = locationSimilarity(
      targetCity,
      targetState,
      property.city,
      property.state
    );
    
    // Calculate price similarity
    const priceScore = priceSimilarity(targetPrice, property.listingPrice ? parseFloat(property.listingPrice) : null);
    
    // Calculate overall similarity (weighted)
    // Name: 50%, Location: 40%, Price: 10%
    const overallScore = (nameScore * 0.5) + (locationScore * 0.4) + (priceScore * 0.1);
    
    // Skip if below threshold
    if (overallScore < minSimilarityThreshold) continue;
    
    // Build match reasons
    if (nameScore === 100) {
      matchReasons.push("Exact name match");
    } else if (fuzzyMatch) {
      matchReasons.push("Name match (with abbreviations)");
    } else if (nameScore >= 80) {
      matchReasons.push(`Very similar name (${nameScore}% match)`);
    } else if (nameScore >= 60) {
      matchReasons.push(`Similar name (${nameScore}% match)`);
    }
    
    if (locationScore === 100) {
      matchReasons.push("Same city and state");
    } else if (locationScore >= 80) {
      matchReasons.push("Very similar location");
    } else if (locationScore >= 50) {
      matchReasons.push("Similar location");
    }
    
    if (priceScore >= 80) {
      matchReasons.push("Similar price");
    }
    
    // Determine confidence level
    let confidence: 'high' | 'medium' | 'low';
    if (overallScore >= 80) {
      confidence = 'high';
    } else if (overallScore >= 60) {
      confidence = 'medium';
    } else {
      confidence = 'low';
    }
    
    matches.push({
      property,
      similarityScore: Math.round(overallScore),
      matchReasons,
      matchDetails: {
        nameMatch: Math.round(nameScore),
        locationMatch: Math.round(locationScore),
        priceMatch: priceScore > 0 ? Math.round(priceScore) : undefined,
        overallConfidence: confidence
      }
    });
  }
  
  // Sort by similarity score (highest first)
  return matches.sort((a, b) => b.similarityScore - a.similarityScore);
}

/**
 * Get a human-readable explanation of why properties might be duplicates
 */
export function getDuplicateExplanation(match: DuplicateMatch): string {
  const { similarityScore, matchDetails, matchReasons } = match;
  
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
