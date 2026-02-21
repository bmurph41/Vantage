import * as cheerio from "cheerio";
import axios from "axios";

export interface ScrapedArticle {
  title: string;
  url: string;
  publishedAt?: Date;
  content?: string;
  imageUrl?: string;
}

/**
 * Fetch and extract the full article body from an article URL
 */
export async function fetchArticleBody(url: string): Promise<string> {
  try {
    const response = await axios.get(url, {
      timeout: 10000,
      maxRedirects: 5,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Docket/1.0; +https://docket.app)',
      },
    });

    const $ = cheerio.load(response.data);

    $('script, style, nav, header, footer, aside, .advertisement, .ad, .social-share, .comments').remove();

    const contentSelectors = [
      'article p',
      '[class*="article-content"] p',
      '[class*="article-body"] p',
      '[class*="entry-content"] p',
      '[class*="post-content"] p',
      '.content p',
      'main p',
      '[itemprop="articleBody"] p',
    ];

    let paragraphs: string[] = [];
    for (const selector of contentSelectors) {
      const elements = $(selector);
      if (elements.length >= 2) {
        elements.each((_, el) => {
          const text = $(el).text().trim();
          if (text.length > 50) {
            paragraphs.push(text);
          }
        });
        break;
      }
    }

    if (paragraphs.length === 0) {
      $('p').each((_, el) => {
        const text = $(el).text().trim();
        if (text.length > 50) {
          paragraphs.push(text);
        }
      });
    }

    const content = paragraphs.slice(0, 15).join('\n\n');
    return content.length > 200 ? content : '';

  } catch (error) {
    return '';
  }
}

/**
 * Detect if a URL is an RSS feed or a regular HTML page
 */
export async function detectContentType(url: string): Promise<'rss' | 'html'> {
  try {
    const response = await axios.get(url, {
      timeout: 10000,
      maxRedirects: 5,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Docket/1.0; +https://docket.app)',
      },
      validateStatus: (status) => status < 500,
    });

    const contentType = response.headers['content-type'] || '';
    
    if (contentType.includes('xml') || contentType.includes('rss') || contentType.includes('atom')) {
      return 'rss';
    }

    const content = response.data.toString().toLowerCase();
    if (content.includes('<rss') || content.includes('<feed') || content.includes('<?xml')) {
      return 'rss';
    }

    return 'html';
  } catch (error) {
    console.error(`Error detecting content type for ${url}:`, error);
    return 'html';
  }
}

/**
 * Scrape articles from an HTML news page
 */
export async function scrapeWebPage(url: string): Promise<ScrapedArticle[]> {
  try {
    const response = await axios.get(url, {
      timeout: 15000,
      maxRedirects: 5,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Docket/1.0; +https://docket.app)',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      },
    });

    const $ = cheerio.load(response.data);
    const articles: ScrapedArticle[] = [];
    const baseUrl = new URL(url);

    const articleSelectors = [
      'article',
      '.article',
      '.post',
      '.news-item',
      '.story',
      '[class*="article"]',
      '[class*="post-"]',
      '[class*="news"]',
      '.entry',
      '[itemtype*="Article"]',
    ];

    const foundArticles = new Set<string>();

    for (const selector of articleSelectors) {
      const elements = $(selector);
      
      if (elements.length === 0) continue;

      elements.each((_, element) => {
        const $article = $(element);
        
        const titleElement = $article.find('h1, h2, h3, .title, [class*="title"], [class*="headline"]').first();
        const title = titleElement.text().trim();
        
        if (!title || title.length < 10) return;

        const linkElement = $article.find('a').first();
        let articleUrl = linkElement.attr('href') || $article.find('[href]').first().attr('href');
        
        if (!articleUrl) return;

        if (articleUrl.startsWith('/')) {
          articleUrl = `${baseUrl.protocol}//${baseUrl.host}${articleUrl}`;
        } else if (!articleUrl.startsWith('http')) {
          articleUrl = `${baseUrl.protocol}//${baseUrl.host}/${articleUrl}`;
        }

        if (foundArticles.has(articleUrl)) return;
        foundArticles.add(articleUrl);

        const contentElement = $article.find('p, .excerpt, .summary, [class*="excerpt"], [class*="summary"]').first();
        const content = contentElement.text().trim();

        const imageElement = $article.find('img').first();
        let imageUrl = imageElement.attr('src') || imageElement.attr('data-src');
        if (imageUrl && imageUrl.startsWith('/')) {
          imageUrl = `${baseUrl.protocol}//${baseUrl.host}${imageUrl}`;
        }

        const timeElement = $article.find('time, .date, .published, [class*="date"], [class*="time"], [class*="meta"]').first();
        let publishedAt: Date | undefined;
        
        const dateStr = timeElement.attr('datetime') || timeElement.text().trim();
        if (dateStr) {
          const parsedDate = new Date(dateStr);
          if (!isNaN(parsedDate.getTime())) {
            publishedAt = parsedDate;
          }
        }
        
        if (!publishedAt && content) {
          const dateRegex = /\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/;
          const match = content.match(dateRegex);
          if (match) {
            const [_, month, day, year] = match;
            const parsedDate = new Date(`${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`);
            if (!isNaN(parsedDate.getTime())) {
              publishedAt = parsedDate;
            }
          }
        }

        articles.push({
          title,
          url: articleUrl,
          publishedAt,
          content: content || undefined,
          imageUrl: imageUrl || undefined,
        });
      });
    }

    if (articles.length === 0) {
      const headlineLinks = $('a').filter((_, el) => {
        const $el = $(el);
        const text = $el.text().trim();
        return text.length > 20 && text.length < 200 && !text.includes('\n');
      });

      headlineLinks.slice(0, 10).each((_, el) => {
        const $el = $(el);
        const title = $el.text().trim();
        let articleUrl = $el.attr('href');
        
        if (!articleUrl) return;

        if (articleUrl.startsWith('/')) {
          articleUrl = `${baseUrl.protocol}//${baseUrl.host}${articleUrl}`;
        } else if (!articleUrl.startsWith('http')) {
          articleUrl = `${baseUrl.protocol}//${baseUrl.host}/${articleUrl}`;
        }

        if (foundArticles.has(articleUrl)) return;
        foundArticles.add(articleUrl);

        const parent = $el.parent();
        const contentElement = parent.find('p, .excerpt').first();
        const content = contentElement.text().trim();

        let publishedAt: Date | undefined;
        if (content) {
          const dateRegex = /\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/;
          const match = content.match(dateRegex);
          if (match) {
            const [_, month, day, year] = match;
            const parsedDate = new Date(`${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`);
            if (!isNaN(parsedDate.getTime())) {
              publishedAt = parsedDate;
            }
          }
        }

        articles.push({
          title,
          url: articleUrl,
          content: content || undefined,
          publishedAt,
        });
      });
    }

    return articles;

  } catch (error) {
    console.error(`Error scraping ${url}:`, error);
    return [];
  }
}

/**
 * Validate and sanitize a scraped article
 */
export function validateScrapedArticle(article: ScrapedArticle): boolean {
  if (!article.title || article.title.length < 10 || article.title.length > 500) {
    return false;
  }
  
  if (!article.url || !article.url.startsWith('http')) {
    return false;
  }

  const skipPatterns = [
    'terms of service',
    'privacy policy',
    'about us',
    'contact us',
    'subscribe',
    'newsletter',
    'cookie policy',
  ];

  const titleLower = article.title.toLowerCase();
  if (skipPatterns.some(pattern => titleLower.includes(pattern))) {
    return false;
  }

  return true;
}
