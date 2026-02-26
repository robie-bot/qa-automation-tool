import { Page } from 'playwright';
import { TestIssue, ReviewConfig } from '@/types';

export async function runLayoutTests(
  page: Page,
  pageUrl: string,
  config: ReviewConfig
): Promise<TestIssue[]> {
  const issues: TestIssue[] = [];
  const viewports = config.viewports || [1920, 1440, 1024, 768, 375];

  for (const width of viewports) {
    try {
      await page.setViewportSize({ width, height: 900 });
      await page.waitForTimeout(500);

      // Check horizontal scroll overflow
      const hasOverflow = await page.evaluate(() => {
        return document.documentElement.scrollWidth > document.documentElement.clientWidth;
      });

      if (hasOverflow) {
        const screenshot = await page.screenshot({ fullPage: false, type: 'jpeg', quality: 60 });
        issues.push({
          severity: 'error',
          message: `Horizontal scroll overflow detected at ${width}px viewport`,
          category: 'layout',
          pageUrl,
          viewport: `${width}px`,
          screenshot: screenshot.toString('base64'),
        });
      }

      // Check for overlapping elements
      const overlaps = await page.evaluate(() => {
        const elements = Array.from(document.querySelectorAll('body *'));
        const visible = elements.filter((el) => {
          const style = getComputedStyle(el);
          return (
            style.display !== 'none' &&
            style.visibility !== 'hidden' &&
            style.opacity !== '0' &&
            el.getBoundingClientRect().width > 0 &&
            el.getBoundingClientRect().height > 0
          );
        });

        const found: { el1: string; el2: string; rect1: DOMRect; rect2: DOMRect }[] = [];
        const interactives = visible.filter(
          (el) => el.matches('a, button, input, select, textarea, [role="button"]')
        );

        for (let i = 0; i < interactives.length && found.length < 5; i++) {
          for (let j = i + 1; j < interactives.length && found.length < 5; j++) {
            const r1 = interactives[i].getBoundingClientRect();
            const r2 = interactives[j].getBoundingClientRect();

            // Check significant overlap (more than 50% of smaller element)
            const overlapX = Math.max(0, Math.min(r1.right, r2.right) - Math.max(r1.left, r2.left));
            const overlapY = Math.max(0, Math.min(r1.bottom, r2.bottom) - Math.max(r1.top, r2.top));
            const overlapArea = overlapX * overlapY;
            const smallerArea = Math.min(r1.width * r1.height, r2.width * r2.height);

            if (smallerArea > 0 && overlapArea / smallerArea > 0.5) {
              found.push({
                el1: interactives[i].tagName + (interactives[i].className ? '.' + interactives[i].className.split(' ')[0] : ''),
                el2: interactives[j].tagName + (interactives[j].className ? '.' + interactives[j].className.split(' ')[0] : ''),
                rect1: r1.toJSON() as DOMRect,
                rect2: r2.toJSON() as DOMRect,
              });
            }
          }
        }

        return found;
      });

      for (const overlap of overlaps) {
        issues.push({
          severity: 'warning',
          message: `Interactive elements overlap: ${overlap.el1} and ${overlap.el2} at ${width}px viewport`,
          category: 'layout',
          pageUrl,
          viewport: `${width}px`,
        });
      }

      // Check z-index stacking issues
      const zIndexIssues = await page.evaluate(() => {
        const elements = Array.from(document.querySelectorAll('body *'));
        const highZ: { tag: string; zIndex: number }[] = [];

        for (const el of elements) {
          const style = getComputedStyle(el);
          const zIndex = parseInt(style.zIndex);
          if (!isNaN(zIndex) && zIndex > 9999) {
            highZ.push({
              tag: el.tagName + (el.id ? '#' + el.id : ''),
              zIndex,
            });
          }
        }

        return highZ.slice(0, 5);
      });

      for (const z of zIndexIssues) {
        issues.push({
          severity: 'info',
          message: `High z-index (${z.zIndex}) on element ${z.tag} at ${width}px viewport`,
          category: 'layout',
          pageUrl,
          viewport: `${width}px`,
        });
      }

      // Take viewport screenshot
      if (width === viewports[0] || width === viewports[viewports.length - 1]) {
        const screenshot = await page.screenshot({ fullPage: true, type: 'jpeg', quality: 50 });
        issues.push({
          severity: 'info',
          message: `Layout screenshot at ${width}px viewport`,
          category: 'layout',
          pageUrl,
          viewport: `${width}px`,
          screenshot: screenshot.toString('base64'),
        });
      }
    } catch (error) {
      issues.push({
        severity: 'warning',
        message: `Failed to test layout at ${width}px: ${error instanceof Error ? error.message : 'Unknown error'}`,
        category: 'layout',
        pageUrl,
        viewport: `${width}px`,
      });
    }
  }

  return issues;
}
