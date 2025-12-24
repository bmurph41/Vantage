import * as cheerio from 'cheerio';
import { createHash } from 'crypto';
import { checkSSRF } from '../fetch/ssrfGuard';

export interface ExtractedImage {
  url: string;
  urlNormalized: string;
  source: 'jsonld' | 'og' | 'gallery' | 'content';
  verified: boolean;
  verificationReason?: string;
}

export interface ImageExtractionOptions {
  html: string;
  originUrl: string;
  domain: string;
  gallerySelector?: string;
  imageAllowPatterns?: string[];
}

export function extractListingImages(options: ImageExtractionOptions): ExtractedImage[] {
  const { html, originUrl, domain, gallerySelector, imageAllowPatterns } = options;
  const $ = cheerio.load(html);
  const images: ExtractedImage[] = [];
  const seenUrls = new Set<string>();
  
  const baseUrl = new URL(originUrl).origin;
  
  const addImage = (url: string, source: ExtractedImage['source']) => {
    const normalized = normalizeImageUrl(url, baseUrl);
    if (!normalized || seenUrls.has(normalized)) return;
    if (!isValidImageUrl(normalized)) return;
    
    seenUrls.add(normalized);
    
    const verified = verifyImageSource(normalized, domain, source, imageAllowPatterns);
    
    images.push({
      url,
      urlNormalized: normalized,
      source,
      verified: verified.verified,
      verificationReason: verified.reason,
    });
  };
  
  const jsonLdImages = extractJsonLdImages($);
  for (const img of jsonLdImages) {
    addImage(img, 'jsonld');
  }
  
  const ogImage = $('meta[property="og:image"]').attr('content');
  if (ogImage) {
    addImage(ogImage, 'og');
  }
  
  const twitterImage = $('meta[name="twitter:image"]').attr('content');
  if (twitterImage) {
    addImage(twitterImage, 'og');
  }
  
  if (gallerySelector) {
    $(gallerySelector).find('img').each((_, el) => {
      const src = $(el).attr('src') || $(el).attr('data-src') || $(el).attr('data-lazy-src');
      if (src) addImage(src, 'gallery');
    });
  }
  
  const defaultGallerySelectors = [
    '.gallery img',
    '.listing-gallery img',
    '.property-gallery img',
    '.photo-gallery img',
    '.carousel img',
    '.slider img',
    '[data-gallery] img',
    '.lightbox img',
    '.fancybox img',
  ];
  
  for (const sel of defaultGallerySelectors) {
    $(sel).each((_, el) => {
      const src = $(el).attr('src') || $(el).attr('data-src') || $(el).attr('data-lazy-src');
      if (src) addImage(src, 'gallery');
    });
  }
  
  return images;
}

function extractJsonLdImages($: cheerio.CheerioAPI): string[] {
  const images: string[] = [];
  
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const content = $(el).html();
      if (!content) return;
      
      const data = JSON.parse(content);
      const items = Array.isArray(data) ? data : [data];
      
      for (const item of items) {
        if (item.image) {
          if (typeof item.image === 'string') {
            images.push(item.image);
          } else if (Array.isArray(item.image)) {
            for (const img of item.image) {
              if (typeof img === 'string') images.push(img);
              else if (img?.url) images.push(img.url);
              else if (img?.contentUrl) images.push(img.contentUrl);
            }
          } else if (item.image.url) {
            images.push(item.image.url);
          } else if (item.image.contentUrl) {
            images.push(item.image.contentUrl);
          }
        }
        
        if (item.photo) {
          const photos = Array.isArray(item.photo) ? item.photo : [item.photo];
          for (const photo of photos) {
            if (typeof photo === 'string') images.push(photo);
            else if (photo?.contentUrl) images.push(photo.contentUrl);
            else if (photo?.url) images.push(photo.url);
          }
        }
      }
    } catch {
    }
  });
  
  return images;
}

export function normalizeImageUrl(url: string, baseUrl: string): string | null {
  try {
    const absoluteUrl = new URL(url, baseUrl);
    
    if (!['http:', 'https:'].includes(absoluteUrl.protocol)) {
      return null;
    }
    
    const trackingParams = [
      'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
      'fbclid', 'gclid', 'msclkid', 'ref', 'source', 'mc_cid', 'mc_eid',
    ];
    
    for (const param of trackingParams) {
      absoluteUrl.searchParams.delete(param);
    }
    
    return absoluteUrl.href;
  } catch {
    return null;
  }
}

function isValidImageUrl(url: string): boolean {
  const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.avif', '.bmp'];
  const lowered = url.toLowerCase();
  
  if (imageExtensions.some(ext => lowered.includes(ext))) {
    return true;
  }
  
  const imagePathPatterns = [
    /\/images?\//i,
    /\/photos?\//i,
    /\/media\//i,
    /\/uploads?\//i,
    /\/assets?\//i,
    /\/cdn/i,
    /cloudinary/i,
    /imgix/i,
    /imagekit/i,
  ];
  
  return imagePathPatterns.some(p => p.test(url));
}

function verifyImageSource(
  url: string,
  domain: string,
  source: ExtractedImage['source'],
  allowPatterns?: string[]
): { verified: boolean; reason?: string } {
  
  if (source === 'jsonld') {
    return { verified: true, reason: 'Found in JSON-LD structured data' };
  }
  
  if (allowPatterns && allowPatterns.length > 0) {
    for (const pattern of allowPatterns) {
      try {
        if (new RegExp(pattern).test(url)) {
          return { verified: true, reason: `Matches allow pattern: ${pattern}` };
        }
      } catch {
      }
    }
  }
  
  try {
    const imageHost = new URL(url).hostname;
    if (imageHost === domain || imageHost.endsWith(`.${domain}`)) {
      return { verified: true, reason: 'Image hosted on same domain' };
    }
    
    const trustedCDNs = [
      'cloudinary.com',
      'imgix.net',
      'imagekit.io',
      'cloudfront.net',
      'akamaihd.net',
      'fastly.net',
      'cdninstagram.com',
    ];
    
    if (trustedCDNs.some(cdn => imageHost.includes(cdn))) {
      return { verified: true, reason: `Image from trusted CDN: ${imageHost}` };
    }
  } catch {
  }
  
  if (source === 'og') {
    return { verified: true, reason: 'Found in OpenGraph meta tags' };
  }
  
  if (source === 'gallery') {
    return { verified: true, reason: 'Found in gallery container' };
  }
  
  return { verified: false, reason: 'Unable to verify image source' };
}

export function selectHeroImage(images: ExtractedImage[]): string | undefined {
  const jsonLdImages = images.filter(i => i.source === 'jsonld' && i.verified);
  if (jsonLdImages.length > 0) {
    return jsonLdImages[0].urlNormalized;
  }
  
  const galleryImages = images.filter(i => i.source === 'gallery' && i.verified);
  if (galleryImages.length > 0) {
    return galleryImages[0].urlNormalized;
  }
  
  const ogImages = images.filter(i => i.source === 'og' && i.verified);
  if (ogImages.length > 0) {
    return ogImages[0].urlNormalized;
  }
  
  const anyVerified = images.find(i => i.verified);
  return anyVerified?.urlNormalized;
}

async function fetchWithSSRFGuard(
  url: string,
  timeoutMs: number,
  maxRedirects: number = 5
): Promise<Response | null> {
  let currentUrl = url;
  let redirectCount = 0;
  
  while (redirectCount <= maxRedirects) {
    const ssrfCheck = checkSSRF(currentUrl);
    if (!ssrfCheck.allowed) {
      console.warn(`[Image Downloader] SSRF blocked: ${currentUrl} - ${ssrfCheck.reason}`);
      return null;
    }
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    
    try {
      const response = await fetch(currentUrl, {
        signal: controller.signal,
        redirect: 'manual',
        headers: {
          'User-Agent': 'MarinaMatch/1.0 (Listing Image Processor)',
          'Accept': 'image/*',
        },
      });
      
      clearTimeout(timeoutId);
      
      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get('location');
        if (!location) {
          console.warn(`[Image Downloader] Redirect without location header`);
          return null;
        }
        
        try {
          currentUrl = new URL(location, currentUrl).href;
        } catch {
          console.warn(`[Image Downloader] Invalid redirect URL: ${location}`);
          return null;
        }
        
        redirectCount++;
        continue;
      }
      
      return response;
      
    } catch (error) {
      clearTimeout(timeoutId);
      return null;
    }
  }
  
  console.warn(`[Image Downloader] Too many redirects for: ${url}`);
  return null;
}

export async function downloadAndHashImage(
  url: string,
  maxBytes: number = 5_000_000,
  timeoutMs: number = 30000
): Promise<{ contentHash: string; bytes: number; width?: number; height?: number } | null> {
  try {
    const response = await fetchWithSSRFGuard(url, timeoutMs, 5);
    
    if (!response || !response.ok) {
      return null;
    }
    
    const contentLength = parseInt(response.headers.get('content-length') || '0', 10);
    if (contentLength > maxBytes) {
      return null;
    }
    
    const buffer = await response.arrayBuffer();
    const bytes = buffer.byteLength;
    
    if (bytes > maxBytes) {
      return null;
    }
    
    const contentHash = createHash('sha256').update(Buffer.from(buffer)).digest('hex');
    
    return { contentHash, bytes };
  } catch {
    return null;
  }
}
