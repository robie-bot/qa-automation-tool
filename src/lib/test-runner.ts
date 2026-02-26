import { Browser, BrowserContext } from 'playwright-core';
import { TestCategory, TestIssue, ReviewConfig, SSEEvent } from '@/types';
import { runLayoutTests } from './tests/layout';
import { runTypographyTests } from './tests/typography';
import { runColorSchemeTests } from './tests/color-scheme';
import { runBrokenLinksTests } from './tests/broken-links';
import { launchBrowser } from './browser';

type EventCallback = (event: SSEEvent) => void;

export async function runReview(
  targetUrl: string,
  pages: string[],
  categories: TestCategory[],
  config: ReviewConfig,
  referenceImage: string | null,
  onEvent: EventCallback
): Promise<TestIssue[]> {
  const allIssues: TestIssue[] = [];
  let browser: Browser | null = null;

  try {
    browser = await launchBrowser();
    const context: BrowserContext = await browser.newContext({
      userAgent: 'QA-Automation-Bot/1.0',
      viewport: { width: 1440, height: 900 },
    });

    const totalSteps = pages.length * categories.length;
    let completedSteps = 0;

    for (let pageIdx = 0; pageIdx < pages.length; pageIdx++) {
      const pagePath = pages[pageIdx];
      const fullUrl = pagePath.startsWith('http')
        ? pagePath
        : new URL(pagePath, targetUrl).href;

      for (const category of categories) {
        const percent = Math.round((completedSteps / totalSteps) * 100);

        onEvent({
          type: 'progress',
          page: pagePath,
          category,
          percent,
          message: `Running ${category} tests on ${pagePath}...`,
        });

        let page;
        try {
          page = await context.newPage();
          await page.goto(fullUrl, {
            waitUntil: 'networkidle',
            timeout: 30000,
          });
        } catch (error) {
          onEvent({
            type: 'issue',
            severity: 'error',
            page: pagePath,
            category,
            message: `Failed to load page ${pagePath}: ${error instanceof Error ? error.message : 'Unknown error'}`,
          });

          allIssues.push({
            severity: 'error',
            message: `Failed to load page: ${error instanceof Error ? error.message : 'Unknown error'}`,
            category,
            pageUrl: pagePath,
          });

          completedSteps++;
          if (page) await page.close();
          continue;
        }

        try {
          let issues: TestIssue[] = [];

          switch (category) {
            case 'layout':
              issues = await runLayoutTests(page, pagePath, config);
              break;
            case 'typography':
              issues = await runTypographyTests(page, pagePath, config);
              break;
            case 'color-scheme':
              issues = await runColorSchemeTests(page, pagePath, config, referenceImage);
              break;
            case 'broken-links':
              issues = await runBrokenLinksTests(page, pagePath, config);
              break;
          }

          allIssues.push(...issues);

          // Send individual issue events for errors and warnings
          for (const issue of issues) {
            if (issue.severity !== 'info') {
              onEvent({
                type: 'issue',
                severity: issue.severity,
                page: pagePath,
                category,
                message: issue.message,
                screenshot: issue.screenshot,
              });
            }
          }
        } catch (error) {
          onEvent({
            type: 'issue',
            severity: 'warning',
            page: pagePath,
            category,
            message: `Test error on ${pagePath} (${category}): ${error instanceof Error ? error.message : 'Unknown error'}`,
          });
        } finally {
          await page.close();
          completedSteps++;
        }
      }
    }

    await context.close();
  } catch (error) {
    onEvent({
      type: 'error',
      message: `Review failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
    });
  } finally {
    if (browser) await browser.close();
  }

  return allIssues;
}
