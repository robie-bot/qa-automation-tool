import { Page } from 'playwright-core';
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

    // Detect non-functional buttons and links (dead clicks)
    const deadElements = await page.evaluate(() => {
      const results: Array<{
        tag: string;
        text: string;
        selector: string;
        reason: string;
        href?: string;
      }> = [];

      // Check anchor links that go nowhere
      document.querySelectorAll('a').forEach((el, idx) => {
        const href = el.getAttribute('href');
        const text = (el.textContent || '').trim().substring(0, 60);
        const sel = `a:nth-of-type(${idx + 1})`;

        if (!href || href === '') {
          results.push({ tag: 'a', text, selector: sel, reason: 'Missing href attribute', href: '' });
        } else if (href === '#') {
          // Only flag if it doesn't have a click event listener via onclick attribute
          if (!el.getAttribute('onclick') && !el.closest('[data-toggle]') && !el.closest('[data-bs-toggle]')) {
            results.push({ tag: 'a', text, selector: sel, reason: 'href="#" with no apparent handler', href });
          }
        } else if (href === 'javascript:void(0)' || href === 'javascript:void(0);' || href === 'javascript:;' || href === 'javascript:undefined') {
          if (!el.getAttribute('onclick')) {
            results.push({ tag: 'a', text, selector: sel, reason: `href="${href}" with no onclick handler`, href });
          }
        }
      });

      // Check buttons that aren't wired up
      document.querySelectorAll('button').forEach((el, idx) => {
        const text = (el.textContent || '').trim().substring(0, 60);
        const sel = `button:nth-of-type(${idx + 1})`;
        const type = el.getAttribute('type') || 'submit';
        const hasOnclick = el.getAttribute('onclick');
        const isInForm = !!el.closest('form');
        const hasAriaExpanded = el.hasAttribute('aria-expanded');
        const hasDataToggle = el.hasAttribute('data-toggle') || el.hasAttribute('data-bs-toggle');
        const isDisabled = el.disabled;

        // Skip disabled buttons, buttons in forms (submit/reset), and toggle buttons
        if (isDisabled || isInForm || hasAriaExpanded || hasDataToggle || hasOnclick) return;

        // Check if button has no type="submit" context and no inline handler
        if (type !== 'submit' && type !== 'reset') {
          // Try to detect if the button has JS event listeners by checking common patterns
          const hasReactHandler = Object.keys(el).some(k => k.startsWith('__reactFiber') || k.startsWith('__reactEvents'));
          const hasVueHandler = !!(el as any).__vue__ || !!(el as any).__vue_app__;
          const hasAngularHandler = el.hasAttribute('ng-click') || el.hasAttribute('(click)');

          // Only flag if no framework handler detected
          if (!hasReactHandler && !hasVueHandler && !hasAngularHandler) {
            results.push({ tag: 'button', text, selector: sel, reason: 'Button with no apparent click handler or form association' });
          }
        }
      });

      // Check elements with role="button" that might not work
      document.querySelectorAll('[role="button"]').forEach((el, idx) => {
        if (el.tagName === 'BUTTON' || el.tagName === 'A') return; // Already checked above
        const text = (el.textContent || '').trim().substring(0, 60);
        const sel = `[role="button"]:nth-of-type(${idx + 1})`;
        const hasOnclick = el.getAttribute('onclick');
        const hasTabindex = el.hasAttribute('tabindex');

        if (!hasOnclick && !hasTabindex) {
          results.push({ tag: el.tagName.toLowerCase(), text, selector: sel, reason: 'Element with role="button" but no click handler or tabindex' });
        }
      });

      return results.slice(0, 30);
    });

    for (const dead of deadElements) {
      issues.push({
        severity: 'warning',
        message: `Non-functional ${dead.tag}: "${dead.text || '(no text)'}" — ${dead.reason}`,
        selector: dead.selector,
        category: 'broken-links',
        pageUrl,
      });
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
