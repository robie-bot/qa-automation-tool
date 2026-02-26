import { chromium, Browser } from 'playwright';
import { parseStringPromise } from 'xml2js';
import { DiscoveredPage } from '@/types';
import { normalizeUrl, getPathFromUrl } from './utils';

export async function parseSitemap(sitemapContent: string, baseUrl: string): Promise<DiscoveredPage[]> {
  try {
    const result = await parseStringPromise(sitemapContent);
    const urls: DiscoveredPage[] = [];

    if (result.urlset?.url) {
      for (const entry of result.urlset.url) {
        const loc = entry.loc?.[0];
        if (loc) {
          urls.push({
            url: loc,
            title: '',
            path: getPathFromUrl(loc, baseUrl),
          });
        }
      }
    }

    // Handle sitemap index
    if (result.sitemapindex?.sitemap) {
      for (const entry of result.sitemapindex.sitemap) {
        const loc = entry.loc?.[0];
        if (loc) {
          try {
            const res = await fetch(loc);
            const text = await res.text();
            const subPages = await parseSitemap(text, baseUrl);
            urls.push(...subPages);
          } catch {
            // Skip failed sub-sitemaps
          }
        }
      }
    }

    return urls.slice(0, 100);
  } catch {
    return [];
  }
}

export async function fetchSitemap(url: string): Promise<string | null> {
  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': 'QA-Automation-Bot/1.0' },
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) return null;
    const text = await response.text();
    if (!text.includes('<urlset') && !text.includes('<sitemapindex')) return null;
    return text;
  } catch {
    return null;
  }
}

export async function crawlSite(
  startUrl: string,
  maxDepth: number = 3,
  maxPages: number = 100
): Promise<DiscoveredPage[]> {
  const normalizedStart = normalizeUrl(startUrl);
  const baseOrigin = new URL(normalizedStart).origin;
  const visited = new Set<string>();
  const pages: DiscoveredPage[] = [];
  const queue: { url: string; depth: number }[] = [{ url: normalizedStart, depth: 0 }];

  let browser: Browser | null = null;

  try {
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
      userAgent: 'QA-Automation-Bot/1.0',
    });

    while (queue.length > 0 && pages.length < maxPages) {
      const { url, depth } = queue.shift()!;

      const normalized = normalizeUrl(url);
      if (visited.has(normalized)) continue;
      visited.add(normalized);

      try {
        const page = await context.newPage();
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });

        const title = await page.title();
        pages.push({
          url,
          title: title || '',
          path: getPathFromUrl(url, startUrl),
        });

        if (depth < maxDepth) {
          const links = await page.evaluate((origin: string) => {
            const anchors = Array.from(document.querySelectorAll('a[href]'));
            return anchors
              .map((a) => {
                try {
                  const href = (a as HTMLAnchorElement).href;
                  const u = new URL(href);
                  if (u.origin === origin && !u.hash && !u.href.match(/\.(pdf|zip|png|jpg|gif|svg|css|js)$/i)) {
                    return u.origin + u.pathname.replace(/\/$/, '');
                  }
                } catch { /* skip */ }
                return null;
              })
              .filter(Boolean) as string[];
          }, baseOrigin);

          const uniqueLinks = [...new Set(links)];
          for (const link of uniqueLinks) {
            if (!visited.has(link)) {
              queue.push({ url: link, depth: depth + 1 });
            }
          }
        }

        await page.close();
      } catch {
        // Skip pages that fail to load
      }
    }

    await context.close();
  } catch (error) {
    console.error('Crawl error:', error);
  } finally {
    if (browser) await browser.close();
  }

  return pages;
}

export async function discoverPages(url: string, sitemapContent?: string): Promise<DiscoveredPage[]> {
  const normalizedUrl = normalizeUrl(url);

  // If sitemap content is provided, parse it
  if (sitemapContent) {
    const pages = await parseSitemap(sitemapContent, normalizedUrl);
    if (pages.length > 0) return pages;
  }

  // Check if URL is a sitemap
  if (url.includes('sitemap.xml') || url.endsWith('.xml')) {
    const content = await fetchSitemap(url);
    if (content) {
      const pages = await parseSitemap(content, normalizedUrl);
      if (pages.length > 0) return pages;
    }
  }

  // Try to find sitemap.xml at the root
  const sitemapUrl = new URL('/sitemap.xml', normalizedUrl).href;
  const sitemapData = await fetchSitemap(sitemapUrl);
  if (sitemapData) {
    const pages = await parseSitemap(sitemapData, normalizedUrl);
    if (pages.length > 0) return pages;
  }

  // Fallback to BFS crawl
  return crawlSite(normalizedUrl);
}
