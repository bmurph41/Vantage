import type { OcrProvider, OcrResult, OcrExtractedPage } from './types';

export class AffindaOcrProvider implements OcrProvider {
  name = 'affinda';
  private apiKey: string;
  private endpoint: string;

  constructor(config: { apiKey: string; endpoint?: string }) {
    this.apiKey = config.apiKey;
    this.endpoint = config.endpoint ?? 'https://api.affinda.com/v3';
  }

  async extractDocument(filePath: string, mimeType: string): Promise<OcrResult> {
    console.log(`[AffindaOcrProvider] STUB: Would extract ${filePath} with Affinda API`);
    console.log(`[AffindaOcrProvider] Endpoint: ${this.endpoint}, apiKey=${this.apiKey ? 'set' : 'missing'}`);

    return {
      pages: [{
        pageNumber: 1,
        content: 'STUB: Affinda OCR not yet implemented. Configure AFFINDA_API_KEY.',
        confidence: 0,
      }],
      overallConfidence: 0,
      documentType: 'pnl',
      meta: {
        provider: 'affinda',
        stubbed: true,
        reason: 'Provider not implemented - falling back to local parser',
      },
    };
  }
}
