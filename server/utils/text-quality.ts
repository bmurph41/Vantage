export interface TextQualityResult {
  isGarbled: boolean;
  printableRatio: number;
  alphanumericRatio: number;
  averageWordLength: number;
  validWordRatio: number;
  confidence: number;
  issues: string[];
}

const COMMON_WORDS = new Set([
  'the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'can', 'her',
  'was', 'one', 'our', 'out', 'day', 'had', 'has', 'his', 'how', 'its',
  'may', 'new', 'now', 'old', 'see', 'way', 'who', 'boy', 'did', 'get',
  'let', 'put', 'say', 'she', 'too', 'use', 'revenue', 'income', 'expense',
  'total', 'net', 'gross', 'cost', 'sales', 'fee', 'fees', 'rent', 'rental',
  'fuel', 'dock', 'slip', 'marina', 'boat', 'water', 'electric', 'utility',
  'insurance', 'tax', 'taxes', 'payroll', 'wage', 'wages', 'salary', 'benefit',
  'service', 'repair', 'maintenance', 'supplies', 'office', 'admin', 'profit',
  'loss', 'year', 'month', 'annual', 'monthly', 'quarterly', 'operating',
  'general', 'other', 'misc', 'miscellaneous', 'account', 'balance',
]);

export function analyzeTextQuality(text: string): TextQualityResult {
  const issues: string[] = [];
  
  if (!text || text.length === 0) {
    return {
      isGarbled: true,
      printableRatio: 0,
      alphanumericRatio: 0,
      averageWordLength: 0,
      validWordRatio: 0,
      confidence: 0,
      issues: ['Empty text'],
    };
  }

  const printableChars = text.match(/[a-zA-Z0-9\s.,\-$%()/&'"#:;@!?]/g) || [];
  const printableRatio = printableChars.length / text.length;

  const alphanumericChars = text.match(/[a-zA-Z0-9]/g) || [];
  const alphanumericRatio = alphanumericChars.length / text.length;

  const words = text.split(/\s+/).filter(w => w.length > 0);
  const totalWordLength = words.reduce((sum, w) => sum + w.length, 0);
  const averageWordLength = words.length > 0 ? totalWordLength / words.length : 0;

  const validWords = words.filter(word => {
    const lowerWord = word.toLowerCase().replace(/[^a-z]/g, '');
    if (lowerWord.length < 2) return false;
    if (COMMON_WORDS.has(lowerWord)) return true;
    const letterRatio = (lowerWord.match(/[a-z]/g) || []).length / Math.max(word.length, 1);
    return letterRatio > 0.6 && lowerWord.length >= 2;
  });
  const validWordRatio = words.length > 0 ? validWords.length / words.length : 0;

  if (printableRatio < 0.7) {
    issues.push(`Low printable character ratio: ${(printableRatio * 100).toFixed(1)}%`);
  }
  if (alphanumericRatio < 0.3) {
    issues.push(`Low alphanumeric ratio: ${(alphanumericRatio * 100).toFixed(1)}%`);
  }
  if (averageWordLength > 15) {
    issues.push(`Abnormally long words: avg ${averageWordLength.toFixed(1)} chars`);
  }
  if (validWordRatio < 0.2 && words.length > 5) {
    issues.push(`Low valid word ratio: ${(validWordRatio * 100).toFixed(1)}%`);
  }

  const confidence = (
    printableRatio * 0.35 +
    alphanumericRatio * 0.25 +
    (averageWordLength < 15 ? 1 : 0.3) * 0.15 +
    validWordRatio * 0.25
  );

  const isGarbled = 
    printableRatio < 0.5 ||
    (alphanumericRatio < 0.3 && text.length > 20) ||
    (validWordRatio < 0.15 && words.length > 10) ||
    (averageWordLength > 20 && words.length > 5);

  return {
    isGarbled,
    printableRatio,
    alphanumericRatio,
    averageWordLength,
    validWordRatio,
    confidence,
    issues,
  };
}

export function isTextGarbled(text: string, threshold = 0.5): boolean {
  const result = analyzeTextQuality(text);
  return result.isGarbled || result.confidence < threshold;
}

export function sanitizeExtractedText(text: string): string {
  if (!text) return '';
  
  return text
    .replace(/\u0000/g, '')
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    .replace(/\uFFFD/g, '')
    .replace(/[\u0080-\u009F]/g, '')
    .replace(/[^\x20-\x7E\u00A0-\u00FF\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}
