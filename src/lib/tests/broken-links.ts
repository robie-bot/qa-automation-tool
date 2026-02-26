import { Page } from 'playwright';
import { TestIssue, ReviewConfig } from '@/types';

interface LinkInfo {
  url: string;
  text: string;
  selector: string;
  type: 'link' | 'image' | 'source';
}

export async function runBrokenLinksTests(
  page: Page,
  pageUrl: string,
  config: ReviewConfig
): Promise<TestIssue[]> {
  const issues: TestIssue[] = [];
  const timeout = config.linkTimeout || 5000;

  try {
    // Extract all links and images from the page
    const resources = await page.evaluate(() => {
      const links: LinkInfo[] = [];
      const seen = new Set<string>();

      // Collect anchor links
      document.querySelectorAll('a[href]').forEach((el, idx) => {
        const href = (el as HTMLAnchorElement).href;
        if (href && !href.startsWith('javascript:') && !href.startsWith('mailto:') && !href.startsWith('tel:') && !seen.has(href)) {
          seen.add(href);
          links.push({
            url: href,
            text: (el.textContent || '').trim().substring(0, 60),
            selector: `a:nth-of-type(${idx + 1})`,
            type: 'link',
          });
        }
      });

      // Collect images
      document.querySelectorAll('img').forEach((el, idx) => {
        const src = (el as HTMLImageElement).src;
        if (src && !src.startsWith('data:') && !seen.has(src)) {
          seen.add(src);
          links.push({
            url: src,
            text: (el as HTMLImageElement).alt || '',
            selector: `img:nth-of-type(${idx + 1})`,
            type: 'image',
          });
        }

        // Check for missing alt attribute
        if (!(el as HTMLImageElement).hasAttribute('alt')) {
          links.push({
            url: src || 'unknown',
            text: '',
            selector: `img:nth-of-type(${idx + 1})`,
            type: 'image',
          });
        }
      });

      // Collect source elements
      document.querySelectorAll('source[src], source[srcset]').forEach((el, idx) => {
        const src = (el as HTMLSourceElement).src || (el as HTMLSourceElement).srcset?.split(',')[0]?.trim().split(' ')[0];
        if (src && !src.startsWith('data:') && !seen.has(src)) {
          seen.add(src);
          links.push({
            url: src,
            text: '',
            selector: `source:nth-of-type(${idx + 1})`,
            type: 'source',
          });
        }
      });

      return links;
    });

    // Check for missing alt attributes
    const imagesWithoutAlt = await page.evaluate(() => {
      const imgs = Array.from(document.querySelectorAll('img'));
      return imgs
        .filter((img) => !img.hasAttribute('alt'))
        .map((img) => img.src || 'unknown')
        .slice(0, 20);
    });

    for (const imgSrc of imagesWithoutAlt) {
      issues.push({
        severity: 'warning',
        message: `Image missing alt attribute: ${imgSrc.substring(0, 100)}`,
        category: 'broken-links',
        pageUrl,
      });
    }

    // Check each URL
    const urlsToCheck = resources.filter((r) => r.url && r.url.startsWith('http')).slice(0, 50);

    const checkUrl = async (resource: LinkInfo): Promise<void> => {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);

        const response = await fetch(resource.url, {
          method: 'HEAD',
          redirect: 'follow',
          signal: controller.signal,
          headers: { 'User-Agent': 'QA-Automation-Bot/1.0' },
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          issues.push({
            severity: response.status >= 500 ? 'error' : 'warning',
            message: `${resource.type === 'link' ? 'Broken link' : 'Broken resource'}: ${resource.url.substring(0, 100)} returned ${response.status} ${response.statusText}`,
            selector: resource.selector,
            category: 'broken-links',
            pageUrl,
          });
        }

        // Check redirect chain
        if (response.redirected) {
          issues.push({
            severity: 'info',
            message: `Redirect: ${resource.url.substring(0, 80)} redirects to ${response.url.substring(0, 80)}`,
            category: 'broken-links',
            pageUrl,
          });
        }
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
          issues.push({
            severity: 'warning',
            message: `Timeout: ${resource.url.substring(0, 100)} did not respond within ${timeout}ms`,
            category: 'broken-links',
            pageUrl,
          });
        } else {
          issues.push({
            severity: 'error',
            message: `Failed to check ${resource.type}: ${resource.url.substring(0, 100)} — ${error instanceof Error ? error.message : 'Unknown error'}`,
            category: 'broken-links',
            pageUrl,
          });
        }
      }
    };

    // Check URLs in batches of 5
    for (let i = 0; i < urlsToCheck.length; i += 5) {
      const batch = urlsToCheck.slice(i, i + 5);
      await Promise.all(batch.map(checkUrl));
    }

    // Summary
    const brokenCount = issues.filter((i) => i.severity === 'error').length;
    const warningCount = issues.filter((i) => i.severity === 'warning').length;

    if (brokenCount === 0 && warningCount === 0) {
      issues.push({
        severity: 'info',
        message: `All ${urlsToCheck.length} links and resources are healthy`,
        category: 'broken-links',
        pageUrl,
      });
    }
  } catch (error) {
    issues.push({
      severity: 'warning',
      message: `Broken links test error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      category: 'broken-links',
      pageUrl,
    });
  }

  return issues;
}
