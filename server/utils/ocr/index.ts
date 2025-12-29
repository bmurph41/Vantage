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

export function resetOcrProvider(): void {
  cachedProvider = null;
}
