import crypto from 'crypto';

export function sha256(input: string): string {
  return crypto.createHash('sha256').update(input, 'utf8').digest('hex');
}

export function md5(input: string): string {
  return crypto.createHash('md5').update(input, 'utf8').digest('hex');
}

export function contentHash(content: string): string {
  const normalized = normalizeTextForHash(content);
  return sha256(normalized);
}

export function titleHash(title: string): string {
  const normalized = title.toLowerCase().trim().replace(/\s+/g, ' ');
  return sha256(normalized);
}

export function headersHash(headers: Record<string, string | string[] | undefined>): string {
  const sorted = Object.entries(headers)
    .filter(([k]) => ['content-type', 'content-length', 'last-modified', 'etag'].includes(k.toLowerCase()))
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}:${Array.isArray(v) ? v.join(',') : v}`)
    .join('|');
  return md5(sorted);
}

function normalizeTextForHash(text: string): string {
  return text
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[^\w\s]/g, '')
    .trim();
}

export function simhash(text: string, bits: number = 64): bigint {
  const tokens = tokenize(text);
  const v: number[] = new Array(bits).fill(0);
  
  for (const token of tokens) {
    const hash = fnv1a(token);
    for (let i = 0; i < bits; i++) {
      if ((hash >> BigInt(i)) & 1n) {
        v[i] += 1;
      } else {
        v[i] -= 1;
      }
    }
  }
  
  let fingerprint = 0n;
  for (let i = 0; i < bits; i++) {
    if (v[i] > 0) {
      fingerprint |= (1n << BigInt(i));
    }
  }
  
  return fingerprint;
}

export function hammingDistance(a: bigint, b: bigint): number {
  let xor = a ^ b;
  let count = 0;
  while (xor > 0n) {
    count += Number(xor & 1n);
    xor >>= 1n;
  }
  return count;
}

export function simhashSimilarity(a: bigint, b: bigint, bits: number = 64): number {
  const distance = hammingDistance(a, b);
  return 1 - (distance / bits);
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(t => t.length > 2);
}

function fnv1a(str: string): bigint {
  const FNV_OFFSET = 14695981039346656037n;
  const FNV_PRIME = 1099511628211n;
  
  let hash = FNV_OFFSET;
  for (let i = 0; i < str.length; i++) {
    hash ^= BigInt(str.charCodeAt(i));
    hash *= FNV_PRIME;
    hash &= 0xFFFFFFFFFFFFFFFFn;
  }
  return hash;
}

export function generateFingerprint(title: string, content: string): string {
  const combined = `${title.toLowerCase().trim()}|${content.slice(0, 500).toLowerCase()}`;
  return sha256(combined).slice(0, 16);
}
