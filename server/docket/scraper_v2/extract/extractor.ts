import * as cheerio from 'cheerio';
import type { ExtractedArticle } from '../types';
import type { Dt2ContentSelectors } from '@shared/docket-v2-schema';
import { contentHash, titleHash } from '../utils/hash';
import { normalizeWhitespace, decodeHtmlEntities, countWords, calculateReadingTime, extractTopKeywords, detectLanguage } from '../utils/text';
import { normalizeUrl } from '../utils/url';
import { V2_CONFIG } from '../config';

export interface ExtractionOptions {
  html: string;
  url: string;
  selectors?: Dt2ContentSelectors | null;
}

export function extractArticle(options: ExtractionOptions): ExtractedArticle | null {
  const { html, url, selectors } = options;
  
  try {
    const $ = cheerio.load(html);
    
    removeBoilerplate($);
    
    const canonicalUrl = extractCanonicalUrl($, url);
    const title = extractTitle($, selectors?.title);
    const author = extractAuthor($, selectors?.author);
    const publishedAt = extractPublishedDate($, selectors?.date);
    const { mainText, htmlFragment } = extractContent($, selectors?.content);
    
    if (!title || !mainText) {
      return null;
    }
    
    const wordCount = countWords(mainText);
    if (wordCount < V2_CONFIG.extractor.minWordCount) {
      return null;
    }
    
    const language = detectLanguage(mainText);
    const topKeywords = extractTopKeywords(mainText, 10);
    const readingTimeMinutes = calculateReadingTime(wordCount);
    
    return {
      canonicalUrl,
      title,
      author,
      publishedAt,
      mainText,
      htmlFragment: htmlFragment?.slice(0, V2_CONFIG.extractor.maxContentLength),
      language,
      wordCount,
      contentHash: contentHash(mainText),
      titleHash: titleHash(title),
      topKeywords,
      readingTimeMinutes,
    };
    
  } catch (error) {
    return null;
  }
}

function removeBoilerplate($: cheerio.CheerioAPI): void {
  const removeSelectors = [
    'script', 'style', 'noscript', 'iframe', 'form',
    'header', 'footer', 'nav', 'aside',
    '.sidebar', '.menu', '.navigation', '.nav',
    '.header', '.footer', '.comments', '.comment',
    '.advertisement', '.ad', '.ads', '.banner',
    '.social', '.share', '.sharing', '.related',
    '.newsletter', '.subscribe', '.popup', '.modal',
    '[role="navigation"]', '[role="banner"]', '[role="complementary"]',
  ];
  
  removeSelectors.forEach(sel => $(sel).remove());
}

function extractCanonicalUrl($: cheerio.CheerioAPI, fallback: string): string | undefined {
  const canonical = $('link[rel="canonical"]').attr('href') ||
                    $('meta[property="og:url"]').attr('content');
  
  if (canonical) {
    try {
      return normalizeUrl(canonical, fallback);
    } catch {
      return undefined;
    }
  }
  return undefined;
}

function extractTitle($: cheerio.CheerioAPI, selector?: string): string {
  if (selector) {
    const custom = $(selector).first().text();
    if (custom) return normalizeWhitespace(decodeHtmlEntities(custom));
  }
  
  const candidates = [
    $('meta[property="og:title"]').attr('content'),
    $('meta[name="twitter:title"]').attr('content'),
    $('h1.title, h1.post-title, h1.entry-title, h1.article-title').first().text(),
    $('article h1').first().text(),
    $('h1').first().text(),
    $('title').text(),
  ];
  
  for (const candidate of candidates) {
    if (candidate && candidate.trim().length > 0) {
      let title = normalizeWhitespace(decodeHtmlEntities(candidate));
      title = title.replace(/\s*[|\-–—]\s*[^|\-–—]+$/, '').trim();
      if (title.length > 0) return title;
    }
  }
  
  return '';
}

function extractAuthor($: cheerio.CheerioAPI, selector?: string): string | undefined {
  if (selector) {
    const custom = $(selector).first().text();
    if (custom) return normalizeWhitespace(decodeHtmlEntities(custom));
  }
  
  const candidates = [
    $('meta[name="author"]').attr('content'),
    $('meta[property="article:author"]').attr('content'),
    $('[rel="author"]').first().text(),
    $('[itemprop="author"]').first().text(),
    $('.author, .byline, .by-author').first().text(),
  ];
  
  for (const candidate of candidates) {
    if (candidate && candidate.trim().length > 0) {
      let author = normalizeWhitespace(decodeHtmlEntities(candidate));
      author = author.replace(/^by\s+/i, '').trim();
      if (author.length > 0 && author.length < 100) return author;
    }
  }
  
  return undefined;
}

function extractPublishedDate($: cheerio.CheerioAPI, selector?: string): Date | undefined {
  const dateStrings: string[] = [];
  
  if (selector) {
    const custom = $(selector).first().text() || $(selector).first().attr('datetime');
    if (custom) dateStrings.push(custom);
  }
  
  dateStrings.push(
    $('meta[property="article:published_time"]').attr('content') || '',
    $('meta[name="date"]').attr('content') || '',
    $('meta[name="DC.date"]').attr('content') || '',
    $('time[datetime]').first().attr('datetime') || '',
    $('[itemprop="datePublished"]').first().attr('content') || 
      $('[itemprop="datePublished"]').first().attr('datetime') || '',
    $('time').first().attr('datetime') || $('time').first().text() || '',
  );
  
  for (const dateStr of dateStrings) {
    if (!dateStr) continue;
    try {
      const date = new Date(dateStr.trim());
      if (!isNaN(date.getTime()) && date.getTime() > 0) {
        return date;
      }
    } catch {
      continue;
    }
  }
  
  return undefined;
}

function extractContent($: cheerio.CheerioAPI, selector?: string): { mainText: string; htmlFragment?: string } {
  let $content: cheerio.Cheerio<cheerio.Element>;
  
  if (selector) {
    $content = $(selector).first();
    if ($content.length > 0) {
      return {
        mainText: normalizeWhitespace(decodeHtmlEntities($content.text())),
        htmlFragment: $content.html() || undefined,
      };
    }
  }
  
  const contentSelectors = [
    'article .content',
    'article .entry-content',
    'article .post-content',
    'article .article-content',
    'article .story-body',
    'article',
    '[itemprop="articleBody"]',
    '.post-content',
    '.entry-content',
    '.article-content',
    '.content-body',
    '.story-content',
    'main .content',
    'main',
    '#content',
    '.content',
  ];
  
  for (const sel of contentSelectors) {
    $content = $(sel).first();
    if ($content.length > 0) {
      const text = $content.text();
      if (countWords(text) > 100) {
        return {
          mainText: normalizeWhitespace(decodeHtmlEntities(text)),
          htmlFragment: $content.html() || undefined,
        };
      }
    }
  }
  
  const bodyText = $('body').text();
  return {
    mainText: normalizeWhitespace(decodeHtmlEntities(bodyText)),
    htmlFragment: undefined,
  };
}

export function isValidExtraction(article: ExtractedArticle): boolean {
  return article.title.length > 5 && 
         article.wordCount >= V2_CONFIG.extractor.minWordCount &&
         article.mainText.length > 100;
}
