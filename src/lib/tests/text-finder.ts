import { Page } from 'playwright-core';
import { TestIssue, ReviewConfig } from '@/types';

/**
 * Normalize text for comparison — lowercase, collapse whitespace.
 */
function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[""'']/g, '"')
    .replace(/[–—]/g, '-')
    .trim();
}

/**
 * Find all occurrences of a term in text and return their approximate positions.
 */
function findOccurrences(haystack: string, needle: string): number[] {
  const normHay = normalize(haystack);
  const normNeedle = normalize(needle);
  const positions: number[] = [];

  if (normNeedle.length === 0) return positions;

  let idx = normHay.indexOf(normNeedle);
  while (idx !== -1) {
    positions.push(idx);
    idx = normHay.indexOf(normNeedle, idx + 1);
  }

  return positions;
}

export async function runTextFinderTests(
  page: Page,
  pageUrl: string,
  _config: ReviewConfig,
  searchTerms: string[]
): Promise<TestIssue[]> {
  const issues: TestIssue[] = [];

  if (!searchTerms || searchTerms.length === 0) {
    issues.push({
      severity: 'info',
      message: 'No search terms provided — skipping text finder',
      category: 'text-finder',
      pageUrl,
    });
    return issues;
  }

  try {
    // Get all text content from the page
    const pageText = await page.evaluate(() => {
      return document.body.innerText || '';
    });

    // Also get the HTML source for hidden text checks
    const pageHtml = await page.evaluate(() => {
      return document.body.innerHTML || '';
    });

    if (!pageText || pageText.trim().length < 5) {
      issues.push({
        severity: 'warning',
        message: 'Page has very little visible text content',
        category: 'text-finder',
        pageUrl,
      });
      return issues;
    }

    let foundCount = 0;
    let notFoundCount = 0;

    for (const term of searchTerms) {
      const trimmed = term.trim();
      if (trimmed.length === 0) continue;

      const preview = trimmed.length > 80 ? trimmed.substring(0, 80) + '...' : trimmed;

      // Search in visible text
      const visibleOccurrences = findOccurrences(pageText, trimmed);

      if (visibleOccurrences.length > 0) {
        foundCount++;

        // Find surrounding context for the first occurrence
        const normPage = normalize(pageText);
        const normTerm = normalize(trimmed);
        const pos = normPage.indexOf(normTerm);
        const contextStart = Math.max(0, pos - 40);
        const contextEnd = Math.min(normPage.length, pos + normTerm.length + 40);
        const context = normPage.substring(contextStart, contextEnd);

        issues.push({
          severity: 'info',
          message: `Found "${preview}" — ${visibleOccurrences.length} occurrence(s). Context: "...${context}..."`,
          category: 'text-finder',
          pageUrl,
        });
      } else {
        // Check if it exists in HTML but not visible
        const htmlOccurrences = findOccurrences(pageHtml, trimmed);

        if (htmlOccurrences.length > 0) {
          foundCount++;
          issues.push({
            severity: 'warning',
            message: `"${preview}" found in HTML source but NOT visible on page (${htmlOccurrences.length} occurrence(s) — may be hidden, in meta tags, or alt text)`,
            category: 'text-finder',
            pageUrl,
          });
        } else {
          notFoundCount++;
          issues.push({
            severity: 'error',
            message: `"${preview}" — NOT FOUND on this page`,
            category: 'text-finder',
            pageUrl,
          });
        }
      }
    }

    // Summary
    issues.push({
      severity: 'info',
      message: `Text finder summary: ${foundCount} found, ${notFoundCount} not found out of ${searchTerms.filter((t) => t.trim().length > 0).length} terms`,
      category: 'text-finder',
      pageUrl,
    });
  } catch (error) {
    issues.push({
      severity: 'warning',
      message: `Text finder error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      category: 'text-finder',
      pageUrl,
    });
  }

  return issues;
}
