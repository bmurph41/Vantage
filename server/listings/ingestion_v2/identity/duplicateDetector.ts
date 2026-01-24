import { Liv2ListingCurrent } from '../schema';

export interface DuplicateMatch {
  listing1: Liv2ListingCurrent;
  listing2: Liv2ListingCurrent;
  confidence: number;
  matchReasons: string[];
  scores: {
    name: number;
    address: number;
    coordinates: number;
    slips: number;
    price: number;
  };
}

export interface DuplicateCheckResult {
  duplicates: DuplicateMatch[];
  totalListingsChecked: number;
  potentialDuplicateCount: number;
}

function levenshteinDistance(a: string, b: string): number {
  const aLen = a.length;
  const bLen = b.length;
  
  if (aLen === 0) return bLen;
  if (bLen === 0) return aLen;
  
  const matrix: number[][] = [];
  
  for (let i = 0; i <= aLen; i++) {
    matrix[i] = [i];
  }
  
  for (let j = 0; j <= bLen; j++) {
    matrix[0][j] = j;
  }
  
  for (let i = 1; i <= aLen; i++) {
    for (let j = 1; j <= bLen; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }
  
  return matrix[aLen][bLen];
}

const MARINA_COMMON_WORDS = [
  'marina', 'marinas', 'yacht', 'yachts', 'club', 'harbor', 'harbour',
  'dock', 'docks', 'docking', 'boat', 'boats', 'boatyard', 'boathouse',
  'pier', 'piers', 'wharf', 'landing', 'cove', 'bay', 'basin',
  'waterfront', 'waterway', 'coastal', 'shore', 'shoreline',
  'llc', 'inc', 'corp', 'corporation', 'company', 'co', 'the', 'a', 'an',
  'and', 'of', 'at', 'on', 'by', 'in', 'for', 'to',
];

function normalizeString(str: string | null | undefined): string {
  if (!str) return '';
  return str
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeMarinaName(str: string | null | undefined): string {
  if (!str) return '';
  let normalized = str.toLowerCase();
  normalized = normalized.replace(/[^a-z0-9\s]/g, '');
  for (const word of MARINA_COMMON_WORDS) {
    normalized = normalized.replace(new RegExp(`\\b${word}\\b`, 'g'), '');
  }
  normalized = normalized.replace(/\s+/g, ' ').trim();
  return normalized;
}

function calculateNameSimilarity(title1: string | null, title2: string | null): number {
  const normBasic1 = normalizeString(title1);
  const normBasic2 = normalizeString(title2);
  
  if (!normBasic1 || !normBasic2) return 0;
  if (normBasic1 === normBasic2) return 100;
  
  const norm1 = normalizeMarinaName(title1);
  const norm2 = normalizeMarinaName(title2);
  
  if (!norm1 || !norm2) {
    const maxLen = Math.max(normBasic1.length, normBasic2.length);
    if (maxLen === 0) return 0;
    const distance = levenshteinDistance(normBasic1, normBasic2);
    return Math.max(0, Math.round((1 - distance / maxLen) * 100));
  }
  
  if (norm1 === norm2) return 100;
  
  const maxLen = Math.max(norm1.length, norm2.length);
  if (maxLen === 0) return 0;
  
  const distance = levenshteinDistance(norm1, norm2);
  return Math.max(0, Math.round((1 - distance / maxLen) * 100));
}

function normalizeAddress(address: string | null | undefined): string {
  if (!address) return '';
  return address
    .toLowerCase()
    .replace(/\b(street|st|avenue|ave|road|rd|drive|dr|lane|ln|court|ct|boulevard|blvd|way|place|pl|highway|hwy)\b/g, '')
    .replace(/[^a-z0-9]/g, '')
    .trim();
}

function calculateAddressSimilarity(
  addr1: string | null, city1: string | null, state1: string | null,
  addr2: string | null, city2: string | null, state2: string | null
): number {
  const normAddr1 = normalizeAddress(addr1);
  const normAddr2 = normalizeAddress(addr2);
  const normCity1 = normalizeString(city1);
  const normCity2 = normalizeString(city2);
  const normState1 = normalizeString(state1);
  const normState2 = normalizeString(state2);
  
  if (normState1 && normState2 && normState1 !== normState2) {
    return 0;
  }
  
  let score = 0;
  
  if (normState1 === normState2 && normState1) score += 20;
  
  if (normCity1 && normCity2) {
    if (normCity1 === normCity2) {
      score += 30;
    } else {
      const citySim = calculateNameSimilarity(normCity1, normCity2);
      if (citySim > 80) score += 25;
      else if (citySim > 60) score += 15;
    }
  }
  
  if (normAddr1 && normAddr2) {
    const addrSim = calculateNameSimilarity(normAddr1, normAddr2);
    if (addrSim > 90) score += 50;
    else if (addrSim > 75) score += 35;
    else if (addrSim > 50) score += 20;
  }
  
  return score;
}

function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function calculateCoordinateSimilarity(
  lat1: string | null, lng1: string | null,
  lat2: string | null, lng2: string | null
): number {
  if (!lat1 || !lng1 || !lat2 || !lng2) return 0;
  
  const lat1Num = parseFloat(lat1);
  const lng1Num = parseFloat(lng1);
  const lat2Num = parseFloat(lat2);
  const lng2Num = parseFloat(lng2);
  
  if (isNaN(lat1Num) || isNaN(lng1Num) || isNaN(lat2Num) || isNaN(lng2Num)) return 0;
  
  const distance = haversineDistance(lat1Num, lng1Num, lat2Num, lng2Num);
  
  if (distance < 0.1) return 100;
  if (distance < 0.5) return 90;
  if (distance < 1) return 75;
  if (distance < 2) return 50;
  if (distance < 5) return 25;
  return 0;
}

function calculateSlipSimilarity(slips1: number | null, slips2: number | null): number {
  if (slips1 === null || slips2 === null) return 0;
  if (slips1 === 0 && slips2 === 0) return 50;
  if (slips1 === 0 || slips2 === 0) return 0;
  
  const diff = Math.abs(slips1 - slips2);
  const avg = (slips1 + slips2) / 2;
  const percentDiff = diff / avg;
  
  if (slips1 === slips2) return 100;
  if (percentDiff <= 0.05) return 90;
  if (percentDiff <= 0.1) return 80;
  if (percentDiff <= 0.2) return 60;
  if (percentDiff <= 0.3) return 40;
  if (percentDiff <= 0.5) return 20;
  return 0;
}

function calculatePriceSimilarity(price1: number | null, price2: number | null): number {
  if (price1 === null || price2 === null) return 0;
  if (price1 === 0 && price2 === 0) return 50;
  if (price1 === 0 || price2 === 0) return 0;
  
  const diff = Math.abs(price1 - price2);
  const avg = (price1 + price2) / 2;
  const percentDiff = diff / avg;
  
  if (price1 === price2) return 100;
  if (percentDiff <= 0.05) return 90;
  if (percentDiff <= 0.1) return 75;
  if (percentDiff <= 0.2) return 50;
  if (percentDiff <= 0.3) return 30;
  return 0;
}

export function calculateDuplicateScore(listing1: Liv2ListingCurrent, listing2: Liv2ListingCurrent): DuplicateMatch | null {
  if (listing1.canonicalListingId === listing2.canonicalListingId) {
    return null;
  }
  
  const scores = {
    name: calculateNameSimilarity(listing1.title, listing2.title),
    address: calculateAddressSimilarity(
      listing1.address1, listing1.city, listing1.state,
      listing2.address1, listing2.city, listing2.state
    ),
    coordinates: calculateCoordinateSimilarity(
      listing1.lat, listing1.lng,
      listing2.lat, listing2.lng
    ),
    slips: calculateSlipSimilarity(listing1.slips, listing2.slips),
    price: calculatePriceSimilarity(listing1.askingPrice, listing2.askingPrice),
  };
  
  const matchReasons: string[] = [];
  
  if (scores.name >= 80) matchReasons.push(`Name similarity: ${scores.name}%`);
  if (scores.address >= 70) matchReasons.push(`Address match: ${scores.address}%`);
  if (scores.coordinates >= 75) matchReasons.push(`Location proximity: ${scores.coordinates}%`);
  if (scores.slips >= 80) matchReasons.push(`Slip count match: ${scores.slips}%`);
  if (scores.price >= 75) matchReasons.push(`Price similarity: ${scores.price}%`);
  
  const weights = {
    name: 0.25,
    address: 0.25,
    coordinates: 0.25,
    slips: 0.15,
    price: 0.10,
  };
  
  let weightedSum = 0;
  let totalWeight = 0;
  
  if (scores.name > 0) {
    weightedSum += scores.name * weights.name;
    totalWeight += weights.name;
  }
  if (scores.address > 0 || scores.coordinates > 0) {
    const locationScore = Math.max(scores.address, scores.coordinates);
    weightedSum += locationScore * (weights.address + weights.coordinates);
    totalWeight += weights.address + weights.coordinates;
  }
  if (scores.slips > 0) {
    weightedSum += scores.slips * weights.slips;
    totalWeight += weights.slips;
  }
  if (scores.price > 0) {
    weightedSum += scores.price * weights.price;
    totalWeight += weights.price;
  }
  
  const confidence = totalWeight > 0 ? Math.round(weightedSum / totalWeight) : 0;
  
  if (confidence < 60) {
    return null;
  }
  
  return {
    listing1,
    listing2,
    confidence,
    matchReasons,
    scores,
  };
}

export function findDuplicatesInBatch(listings: Liv2ListingCurrent[], minConfidence: number = 60): DuplicateCheckResult {
  const duplicates: DuplicateMatch[] = [];
  const seen = new Set<string>();
  
  for (let i = 0; i < listings.length; i++) {
    for (let j = i + 1; j < listings.length; j++) {
      const pairKey = [listings[i].canonicalListingId, listings[j].canonicalListingId].sort().join('::');
      if (seen.has(pairKey)) continue;
      seen.add(pairKey);
      
      const match = calculateDuplicateScore(listings[i], listings[j]);
      if (match && match.confidence >= minConfidence) {
        duplicates.push(match);
      }
    }
  }
  
  duplicates.sort((a, b) => b.confidence - a.confidence);
  
  return {
    duplicates,
    totalListingsChecked: listings.length,
    potentialDuplicateCount: duplicates.length,
  };
}

export function findDuplicatesForListing(
  newListing: Liv2ListingCurrent, 
  existingListings: Liv2ListingCurrent[],
  minConfidence: number = 60
): DuplicateMatch[] {
  const matches: DuplicateMatch[] = [];
  
  for (const existing of existingListings) {
    const match = calculateDuplicateScore(newListing, existing);
    if (match && match.confidence >= minConfidence) {
      matches.push(match);
    }
  }
  
  return matches.sort((a, b) => b.confidence - a.confidence);
}
