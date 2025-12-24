import { createHash } from 'crypto';
import type { MarinaListing } from '@shared/schema';

export interface DedupeResult {
  isExactDuplicate: boolean;
  isSoftDuplicate: boolean;
  similarity: number;
  matchedListingId?: number;
  matchReason?: 'source_url' | 'content_hash' | 'title_hash' | 'simhash' | 'address_match';
}

function hashString(text: string): string {
  return createHash('sha256').update(text).digest('hex').slice(0, 16);
}

function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeAddress(address: string): string {
  return address
    .toLowerCase()
    .replace(/\b(street|st|avenue|ave|road|rd|drive|dr|lane|ln|court|ct|boulevard|blvd)\b/g, '')
    .replace(/[^a-z0-9]/g, '')
    .trim();
}

function simhash(text: string): bigint {
  const tokens = text.toLowerCase().split(/\s+/).filter(t => t.length > 2);
  const vector = new Array(64).fill(0);

  for (const token of tokens) {
    const hash = hashString(token);
    for (let i = 0; i < 16; i++) {
      const byte = parseInt(hash[i], 16);
      for (let j = 0; j < 4; j++) {
        const bit = (byte >> j) & 1;
        const index = i * 4 + j;
        vector[index] += bit ? 1 : -1;
      }
    }
  }

  let result = BigInt(0);
  for (let i = 0; i < 64; i++) {
    if (vector[i] > 0) {
      result |= BigInt(1) << BigInt(i);
    }
  }
  return result;
}

function simhashSimilarity(a: bigint, b: bigint): number {
  const xor = a ^ b;
  let differentBits = 0;
  let temp = xor;
  while (temp > 0) {
    differentBits += Number(temp & BigInt(1));
    temp >>= BigInt(1);
  }
  return 1 - differentBits / 64;
}

function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  if (denominator === 0) return 0;

  return dotProduct / denominator;
}

export function checkExactDuplicate(
  newListing: { sourceUrl: string; title: string; city?: string; state?: string },
  existingListings: Array<Pick<MarinaListing, 'id' | 'sourceUrl' | 'title' | 'city' | 'state'>>
): DedupeResult {
  for (const existing of existingListings) {
    if (newListing.sourceUrl && existing.sourceUrl &&
        newListing.sourceUrl === existing.sourceUrl) {
      return {
        isExactDuplicate: true,
        isSoftDuplicate: false,
        similarity: 1.0,
        matchedListingId: existing.id,
        matchReason: 'source_url',
      };
    }

    const newTitleHash = hashString(normalizeTitle(newListing.title));
    const existingTitleHash = hashString(normalizeTitle(existing.title));

    if (newTitleHash === existingTitleHash) {
      const sameLocation = newListing.city === existing.city && newListing.state === existing.state;
      if (sameLocation) {
        return {
          isExactDuplicate: true,
          isSoftDuplicate: false,
          similarity: 0.98,
          matchedListingId: existing.id,
          matchReason: 'title_hash',
        };
      }
    }
  }

  return {
    isExactDuplicate: false,
    isSoftDuplicate: false,
    similarity: 0,
  };
}

export function checkSoftDuplicate(
  newListing: { title: string; description?: string; city?: string; state?: string; askingPrice?: number },
  existingListings: Array<Pick<MarinaListing, 'id' | 'title' | 'description' | 'city' | 'state' | 'askingPrice'>>
): DedupeResult {
  const newText = `${newListing.title} ${newListing.description || ''}`;
  const newSimhash = simhash(newText);

  for (const existing of existingListings) {
    const existingText = `${existing.title} ${existing.description || ''}`;
    const existingSimhash = simhash(existingText);
    const similarity = simhashSimilarity(newSimhash, existingSimhash);

    if (similarity >= 0.85) {
      const priceSimilar = !newListing.askingPrice || !existing.askingPrice ||
        Math.abs(newListing.askingPrice - existing.askingPrice) / Math.max(newListing.askingPrice, existing.askingPrice) < 0.1;

      const locationMatch = newListing.city === existing.city && newListing.state === existing.state;

      if (priceSimilar && locationMatch) {
        return {
          isExactDuplicate: false,
          isSoftDuplicate: true,
          similarity,
          matchedListingId: existing.id,
          matchReason: 'simhash',
        };
      }
    }
  }

  return {
    isExactDuplicate: false,
    isSoftDuplicate: false,
    similarity: 0,
  };
}

export function checkEmbeddingSimilarity(
  newEmbedding: number[],
  existingEmbeddings: Array<{ listingId: number; embedding: number[] }>,
  threshold: number = 0.92
): DedupeResult {
  let bestMatch: { listingId: number; similarity: number } | null = null;

  for (const existing of existingEmbeddings) {
    const similarity = cosineSimilarity(newEmbedding, existing.embedding);

    if (similarity >= threshold) {
      if (!bestMatch || similarity > bestMatch.similarity) {
        bestMatch = { listingId: existing.listingId, similarity };
      }
    }
  }

  if (bestMatch) {
    return {
      isExactDuplicate: false,
      isSoftDuplicate: true,
      similarity: bestMatch.similarity,
      matchedListingId: bestMatch.listingId,
      matchReason: 'embedding' as const,
    };
  }

  return {
    isExactDuplicate: false,
    isSoftDuplicate: false,
    similarity: 0,
  };
}

export function checkAddressDuplicate(
  newListing: { address?: string; city?: string; state?: string },
  existingListings: Array<Pick<MarinaListing, 'id' | 'address' | 'city' | 'state'>>
): DedupeResult {
  if (!newListing.address) {
    return { isExactDuplicate: false, isSoftDuplicate: false, similarity: 0 };
  }

  const newNormalized = normalizeAddress(newListing.address);

  for (const existing of existingListings) {
    if (!existing.address) continue;

    const existingNormalized = normalizeAddress(existing.address);

    if (newNormalized === existingNormalized) {
      const sameLocation = newListing.city === existing.city && newListing.state === existing.state;
      if (sameLocation) {
        return {
          isExactDuplicate: true,
          isSoftDuplicate: false,
          similarity: 0.95,
          matchedListingId: existing.id,
          matchReason: 'address_match',
        };
      }
    }
  }

  return {
    isExactDuplicate: false,
    isSoftDuplicate: false,
    similarity: 0,
  };
}

export function deduplicateListing(
  newListing: {
    sourceUrl: string;
    title: string;
    description?: string;
    address?: string;
    city?: string;
    state?: string;
    askingPrice?: number;
  },
  existingListings: Array<Pick<MarinaListing, 'id' | 'sourceUrl' | 'title' | 'description' | 'address' | 'city' | 'state' | 'askingPrice'>>
): DedupeResult {
  const exactResult = checkExactDuplicate(newListing, existingListings);
  if (exactResult.isExactDuplicate) return exactResult;

  const addressResult = checkAddressDuplicate(newListing, existingListings);
  if (addressResult.isExactDuplicate) return addressResult;

  const softResult = checkSoftDuplicate(newListing, existingListings);
  if (softResult.isSoftDuplicate) return softResult;

  return {
    isExactDuplicate: false,
    isSoftDuplicate: false,
    similarity: 0,
  };
}
