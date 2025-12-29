import type { OcrProvider, OcrResult, OcrExtractedPage } from './types';

export class VeryfiOcrProvider implements OcrProvider {
  name = 'veryfi';
  private apiKey: string;
  private clientId: string;
  private username: string;

  constructor(config: { apiKey: string; clientId?: string; username?: string }) {
    this.apiKey = config.apiKey;
    this.clientId = config.clientId ?? '';
    this.username = config.username ?? '';
  }

  async extractDocument(filePath: string, mimeType: string): Promise<OcrResult> {
    console.log(`[VeryfiOcrProvider] STUB: Would extract ${filePath} with Veryfi API`);
    console.log(`[VeryfiOcrProvider] Credentials configured: apiKey=${this.apiKey ? 'set' : 'missing'}`);

    return {
      pages: [{
        pageNumber: 1,
        content: 'STUB: Veryfi OCR not yet implemented. Configure VERYFI_API_KEY, VERYFI_CLIENT_ID, VERYFI_USERNAME.',
        confidence: 0,
      }],
      overallConfidence: 0,
      documentType: 'pnl',
      meta: {
        provider: 'veryfi',
        stubbed: true,
        reason: 'Provider not implemented - falling back to local parser',
      },
    };
  }
}
