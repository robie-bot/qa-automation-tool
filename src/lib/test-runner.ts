import { Browser, BrowserContext } from 'playwright-core';
import { TestCategory, TestIssue, ReviewConfig, SSEEvent, PageSpeedData } from '@/types';
import { runLayoutTests } from './tests/layout';
import { runTypographyTests, compareTypographyAcrossPages, TypographyFingerprint } from './tests/typography';
import { runColorSchemeTests } from './tests/color-scheme';
import { runBrokenLinksTests } from './tests/broken-links';
import { runPageSpeedTests } from './tests/pagespeed';
import { runContentCheckTests } from './tests/content-check';
import { runTextFinderTests } from './tests/text-finder';
import { runImagesMediaTests } from './tests/images-media';
import { runAIReviewTests } from './tests/ai-review';
import { launchBrowser } from './browser';

// Categories that call an external API and don't need a browser page
const API_ONLY_CATEGORIES: TestCategory[] = ['pagespeed'];

type EventCallback = (event: SSEEvent) => void;

export async function runReview(
  targetUrl: string,
  pages: string[],
  categories: TestCategory[],
  config: ReviewConfig,
  referenceImage: string | null,
  onEvent: EventCallback,
  contentDocument?: string | null,
  searchTerms?: string[]
): Promise<TestIssue[]> {
  const allIssues: TestIssue[] = [];

  const browserCategories = categories.filter((c) => !API_ONLY_CATEGORIES.includes(c));
  const apiCategories = categories.filter((c) => API_ONLY_CATEGORIES.includes(c));
  const needsBrowser = browserCategories.length > 0;

  const totalSteps = pages.length * categories.length;
  let completedSteps = 0;

  let browser: Browser | null = null;
  let context: BrowserContext | null = null;
  const typographyFingerprints: TypographyFingerprint[] = [];

  try {
    if (needsBrowser) {
      browser = await launchBrowser();
      context = await browser.newContext({
        userAgent: 'QA-Automation-Bot/1.0',
        viewport: { width: 1440, height: 900 },
      });
    }

    for (let pageIdx = 0; pageIdx < pages.length; pageIdx++) {
      const pagePath = pages[pageIdx];
      const fullUrl = pagePath.startsWith('http')
        ? pagePath
        : new URL(pagePath, targetUrl).href;

      // --- Browser-based categories ---
      for (const category of browserCategories) {
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
          page = await context!.newPage();
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
            case 'typography': {
              const typoResult = await runTypographyTests(page, pagePath, config);
              issues = typoResult.issues;
              typographyFingerprints.push(typoResult.fingerprint);
              break;
            }
            case 'color-scheme':
              issues = await runColorSchemeTests(page, pagePath, config, referenceImage);
              break;
            case 'broken-links':
              issues = await runBrokenLinksTests(page, pagePath, config);
              break;
            case 'content-check':
              issues = await runContentCheckTests(page, pagePath, config, contentDocument || null);
              break;
            case 'text-finder':
              issues = await runTextFinderTests(page, pagePath, config, searchTerms || []);
              break;
            case 'images-media':
              issues = await runImagesMediaTests(page, pagePath, config);
              break;
            case 'ai-review':
              issues = await runAIReviewTests(page, pagePath, config, categories);
              break;
          }

          allIssues.push(...issues);

          for (const issue of issues) {
            onEvent({
              type: 'issue',
              severity: issue.severity,
              page: pagePath,
              category,
              message: issue.message,
              screenshot: issue.screenshot,
            });
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

      // --- API-only categories (no browser needed) ---
      for (const category of apiCategories) {
        const percent = Math.round((completedSteps / totalSteps) * 100);

        onEvent({
          type: 'progress',
          page: pagePath,
          category,
          percent,
          message: `Running ${category} tests on ${pagePath}...`,
        });

        try {
          let issues: TestIssue[] = [];

          switch (category) {
            case 'pagespeed':
              issues = await runPageSpeedTests(fullUrl, config);
              break;
          }

          allIssues.push(...issues);

          for (const issue of issues) {
            onEvent({
              type: 'issue',
              severity: issue.severity,
              page: pagePath,
              category,
              message: issue.message,
            });
          }

          // Emit structured data for pagespeed rich UI
          if (category === 'pagespeed') {
            const metaIssue = issues.find(
              (i) => i.metadata && (i.metadata as Record<string, unknown>).type === 'pagespeed-result'
            );
            if (metaIssue?.metadata) {
              onEvent({
                type: 'data',
                page: pagePath,
                category: 'pagespeed',
                dataType: 'pagespeed-result',
                payload: (metaIssue.metadata as Record<string, unknown>).data as PageSpeedData,
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
          completedSteps++;
        }
      }
    }

    // ── Cross-page typography consistency ──────────────────────────────
    if (typographyFingerprints.length >= 2) {
      onEvent({
        type: 'progress',
        page: '(cross-page)',
        category: 'typography',
        percent: 95,
        message: 'Comparing typography consistency across pages...',
      });

      const crossPageIssues = compareTypographyAcrossPages(typographyFingerprints);
      allIssues.push(...crossPageIssues);

      for (const issue of crossPageIssues) {
        onEvent({
          type: 'issue',
          severity: issue.severity,
          page: '(cross-page)',
          category: 'typography',
          message: issue.message,
        });
      }
    }

    if (context) await context.close();
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
