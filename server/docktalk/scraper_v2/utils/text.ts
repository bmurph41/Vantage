export function normalizeWhitespace(text: string): string {
  return text
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function decodeHtmlEntities(text: string): string {
  const entities: Record<string, string> = {
    '&amp;': '&',
    '&lt;': '<',
    '&gt;': '>',
    '&quot;': '"',
    '&#39;': "'",
    '&apos;': "'",
    '&nbsp;': ' ',
    '&ndash;': '–',
    '&mdash;': '—',
    '&hellip;': '…',
    '&copy;': '©',
    '&reg;': '®',
    '&trade;': '™',
  };
  
  let result = text;
  for (const [entity, char] of Object.entries(entities)) {
    result = result.replace(new RegExp(entity, 'gi'), char);
  }
  
  result = result.replace(/&#(\d+);/g, (_, num) => String.fromCharCode(parseInt(num, 10)));
  result = result.replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
  
  return result;
}

export function countWords(text: string): number {
  return text.split(/\s+/).filter(word => word.length > 0).length;
}

export function calculateReadingTime(wordCount: number, wpm: number = 200): number {
  return Math.ceil(wordCount / wpm);
}

export function extractTopKeywords(text: string, maxKeywords: number = 10): string[] {
  const stopWords = new Set([
    'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
    'of', 'with', 'by', 'from', 'as', 'is', 'was', 'are', 'were', 'been',
    'be', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
    'should', 'may', 'might', 'must', 'shall', 'can', 'this', 'that', 'these',
    'those', 'i', 'you', 'he', 'she', 'it', 'we', 'they', 'what', 'which',
    'who', 'when', 'where', 'why', 'how', 'all', 'each', 'every', 'both',
    'few', 'more', 'most', 'other', 'some', 'such', 'no', 'nor', 'not',
    'only', 'own', 'same', 'so', 'than', 'too', 'very', 'just', 'also',
    'now', 'new', 'one', 'two', 'first', 'last', 'long', 'great', 'little',
    'own', 'other', 'old', 'right', 'big', 'high', 'different', 'small',
    'large', 'next', 'early', 'young', 'important', 'few', 'public', 'bad',
    'same', 'able', 'said', 'says', 'according', 'about', 'after', 'over',
  ]);
  
  const words = text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 3 && !stopWords.has(word));
  
  const frequency: Record<string, number> = {};
  for (const word of words) {
    frequency[word] = (frequency[word] || 0) + 1;
  }
  
  const totalWords = words.length;
  const scored = Object.entries(frequency)
    .map(([word, count]) => ({
      word,
      score: (count / totalWords) * Math.log(1 + count),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, maxKeywords)
    .map(item => item.word);
  
  return scored;
}

export function detectLanguage(text: string): string {
  const sample = text.slice(0, 1000).toLowerCase();
  
  const patterns: Record<string, RegExp[]> = {
    en: [/\bthe\b/, /\band\b/, /\bof\b/, /\bto\b/, /\bis\b/],
    es: [/\bel\b/, /\bla\b/, /\bde\b/, /\by\b/, /\ben\b/],
    fr: [/\ble\b/, /\bla\b/, /\bde\b/, /\bet\b/, /\best\b/],
    de: [/\bder\b/, /\bdie\b/, /\bund\b/, /\bin\b/, /\bist\b/],
  };
  
  let bestLang = 'en';
  let bestScore = 0;
  
  for (const [lang, regexes] of Object.entries(patterns)) {
    const matches = regexes.filter(r => r.test(sample)).length;
    if (matches > bestScore) {
      bestScore = matches;
      bestLang = lang;
    }
  }
  
  return bestLang;
}

export function isSpamContent(text: string): boolean {
  const spamPatterns = [
    /click here/gi,
    /buy now/gi,
    /limited time/gi,
    /act now/gi,
    /free gift/gi,
    /you won/gi,
    /congratulations/gi,
    /earn money/gi,
    /work from home/gi,
    /casino/gi,
    /viagra/gi,
    /lottery/gi,
  ];
  
  const matches = spamPatterns.filter(p => p.test(text)).length;
  return matches >= 3;
}

export function hasExcessiveBoilerplate(text: string, boilerplateRatio: number = 0.5): boolean {
  const boilerplatePatterns = [
    /copyright \d{4}/gi,
    /all rights reserved/gi,
    /privacy policy/gi,
    /terms of service/gi,
    /cookie policy/gi,
    /subscribe to our newsletter/gi,
    /follow us on/gi,
    /share this article/gi,
    /related articles/gi,
    /you may also like/gi,
    /advertisement/gi,
    /sponsored content/gi,
  ];
  
  const totalLength = text.length;
  let boilerplateLength = 0;
  
  for (const pattern of boilerplatePatterns) {
    const matches = text.match(pattern);
    if (matches) {
      boilerplateLength += matches.join('').length;
    }
  }
  
  return (boilerplateLength / totalLength) > boilerplateRatio;
}

export function truncateForEmbedding(title: string, content: string, maxChars: number = 8000): string {
  const combined = `${title}\n\n${content}`;
  if (combined.length <= maxChars) {
    return combined;
  }
  return combined.slice(0, maxChars);
}
