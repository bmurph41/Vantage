import type { OcrProvider, OcrResult, OcrConfig } from './types';
import { LocalOcrProvider } from './localProvider';
import { VeryfiOcrProvider } from './veryfiProvider';
import { AffindaOcrProvider } from './affindaProvider';

export * from './types';

const OCR_PROVIDER = process.env.OCR_PROVIDER ?? 'local';
const OCR_API_KEY = process.env.OCR_API_KEY ?? '';
const VERYFI_CLIENT_ID = process.env.VERYFI_CLIENT_ID ?? '';
const VERYFI_USERNAME = process.env.VERYFI_USERNAME ?? '';

function createProvider(providerName: string): OcrProvider {
  switch (providerName.toLowerCase()) {
    case 'veryfi':
      if (!OCR_API_KEY) {
        console.warn('[OCR] Veryfi requested but OCR_API_KEY not set, falling back to local');
        return new LocalOcrProvider();
      }
      return new VeryfiOcrProvider({
        apiKey: OCR_API_KEY,
        clientId: VERYFI_CLIENT_ID,
        username: VERYFI_USERNAME,
      });

    case 'affinda':
      if (!OCR_API_KEY) {
        console.warn('[OCR] Affinda requested but OCR_API_KEY not set, falling back to local');
        return new LocalOcrProvider();
      }
      return new AffindaOcrProvider({ apiKey: OCR_API_KEY });

    case 'local':
    default:
      return new LocalOcrProvider();
  }
}

let cachedProvider: OcrProvider | null = null;

export function getOcrProvider(): OcrProvider {
  if (!cachedProvider) {
    cachedProvider = createProvider(OCR_PROVIDER);
    console.log(`[OCR] Initialized provider: ${cachedProvider.name}`);
  }
  return cachedProvider;
}

export async function extractDocument(filePath: string, mimeType: string): Promise<OcrResult> {
  const provider = getOcrProvider();
  return provider.extractDocument(filePath, mimeType);
}

// ─── OCR Quality Assessment ─────────────────────────────────────────────────

export interface OcrQualityAssessment {
  quality: 'high' | 'medium' | 'low';
  charEntropy: number;
  wordRecognitionRate: number;
  numericDensity: number;
  totalWords: number;
  details: string;
}

/**
 * Assess the quality of OCR-extracted text.
 * Checks character entropy, word recognition rate, and numeric density.
 */
export function assessOcrQuality(ocrResult: OcrResult): OcrQualityAssessment {
  const allText = ocrResult.pages.map(p => p.content).join(' ');
  const words = allText.split(/\s+/).filter(w => w.length > 0);
  const totalWords = words.length;

  if (totalWords === 0) {
    return { quality: 'low', charEntropy: 0, wordRecognitionRate: 0, numericDensity: 0, totalWords: 0, details: 'No text extracted' };
  }

  // 1. Character entropy (Shannon entropy) - too low means garbled/repetitive text
  const charFreq: Record<string, number> = {};
  for (const ch of allText) {
    charFreq[ch] = (charFreq[ch] || 0) + 1;
  }
  const textLen = allText.length;
  let charEntropy = 0;
  for (const count of Object.values(charFreq)) {
    const p = count / textLen;
    if (p > 0) charEntropy -= p * Math.log2(p);
  }

  // 2. Word recognition rate - % of words containing only [a-zA-Z0-9.,\-$%/]
  const recognizablePattern = /^[a-zA-Z0-9.,\-$%/:()#&'+]+$/;
  const recognizableWords = words.filter(w => recognizablePattern.test(w)).length;
  const wordRecognitionRate = recognizableWords / totalWords;

  // 3. Numeric density - financial docs should have a reasonable amount of numbers
  const numericWords = words.filter(w => /\d/.test(w)).length;
  const numericDensity = numericWords / totalWords;

  // Scoring thresholds
  const issues: string[] = [];
  let score = 3; // Start at high

  if (charEntropy < 2.5) {
    issues.push(`low character entropy (${charEntropy.toFixed(2)}, expected >2.5)`);
    score--;
  }
  if (wordRecognitionRate < 0.6) {
    issues.push(`low word recognition rate (${(wordRecognitionRate * 100).toFixed(1)}%, expected >60%)`);
    score--;
  }
  if (numericDensity < 0.05) {
    issues.push(`low numeric density (${(numericDensity * 100).toFixed(1)}%, expected >5% for financial docs)`);
    score--;
  }

  const quality: OcrQualityAssessment['quality'] = score >= 3 ? 'high' : score >= 2 ? 'medium' : 'low';
  const details = issues.length > 0 ? `OCR quality issues: ${issues.join('; ')}` : 'OCR quality acceptable';

  return { quality, charEntropy, wordRecognitionRate, numericDensity, totalWords, details };
}

export function resetOcrProvider(): void {
  cachedProvider = null;
}
