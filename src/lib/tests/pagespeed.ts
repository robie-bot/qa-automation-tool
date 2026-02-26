import { TestIssue, ReviewConfig } from '@/types';

// PageSpeed Insights API — free tier, no key required (rate-limited to ~25 req/day)
// Set PAGESPEED_API_KEY env var for higher limits (free key from Google Cloud Console)
const PSI_API = 'https://www.googleapis.com/pagespeedonline/v5/runPagespeed';

interface LighthouseCategory {
  id: string;
  title: string;
  score: number | null;
}

interface LighthouseAudit {
  id: string;
  title: string;
  description: string;
  score: number | null;
  scoreDisplayMode: string;
  displayValue?: string;
  numericValue?: number;
}

interface PSIResponse {
  lighthouseResult?: {
    categories: Record<string, LighthouseCategory>;
    audits: Record<string, LighthouseAudit>;
    finalScreenshot?: {
      screenshot?: { data: string };
    };
  };
  error?: { message: string };
}

function scoreToSeverity(score: number | null): 'error' | 'warning' | 'info' {
  if (score === null) return 'info';
  if (score < 0.5) return 'error';
  if (score < 0.9) return 'warning';
  return 'info';
}

function formatScore(score: number | null): string {
  if (score === null) return 'N/A';
  return `${Math.round(score * 100)}`;
}

const KEY_AUDITS = [
  'first-contentful-paint',
  'largest-contentful-paint',
  'total-blocking-time',
  'cumulative-layout-shift',
  'speed-index',
  'interactive',
  'server-response-time',
  'render-blocking-resources',
  'unused-css-rules',
  'unused-javascript',
  'modern-image-formats',
  'uses-optimized-images',
  'uses-responsive-images',
  'dom-size',
  'redirects',
  'uses-text-compression',
  'uses-rel-preconnect',
  'viewport',
  'document-title',
  'meta-description',
  'image-alt',
  'link-text',
  'crawlable-anchors',
  'is-crawlable',
  'robots-txt',
  'hreflang',
  'canonical',
  'color-contrast',
  'heading-order',
  'html-has-lang',
  'label',
  'tap-targets',
];

export async function runPageSpeedTests(
  pageUrl: string,
  _config: ReviewConfig
): Promise<TestIssue[]> {
  const issues: TestIssue[] = [];

  // Run both mobile and desktop
  for (const strategy of ['mobile', 'desktop'] as const) {
    try {
      const apiKey = process.env.PAGESPEED_API_KEY;
      const params = new URLSearchParams({
        url: pageUrl,
        strategy,
        category: 'performance',
        // The API accepts multiple category params
      });
      // Add all categories
      params.append('category', 'accessibility');
      params.append('category', 'best-practices');
      params.append('category', 'seo');

      if (apiKey) {
        params.set('key', apiKey);
      }

      const response = await fetch(`${PSI_API}?${params.toString()}`, {
        signal: AbortSignal.timeout(60000),
      });

      if (!response.ok) {
        const errorBody = await response.text();
        issues.push({
          severity: 'error',
          message: `PageSpeed API returned ${response.status} for ${strategy}: ${errorBody.substring(0, 200)}`,
          category: 'pagespeed',
          pageUrl,
        });
        continue;
      }

      const data: PSIResponse = await response.json();

      if (data.error) {
        issues.push({
          severity: 'error',
          message: `PageSpeed API error (${strategy}): ${data.error.message}`,
          category: 'pagespeed',
          pageUrl,
        });
        continue;
      }

      const lr = data.lighthouseResult;
      if (!lr) {
        issues.push({
          severity: 'warning',
          message: `No Lighthouse data returned for ${strategy}`,
          category: 'pagespeed',
          pageUrl,
        });
        continue;
      }

      // --- Category scores ---
      const categories = lr.categories;
      for (const [_key, cat] of Object.entries(categories)) {
        const score = cat.score;
        const severity = scoreToSeverity(score);

        // Only report non-perfect scores as warnings/errors, perfect as info
        issues.push({
          severity,
          message: `[${strategy.toUpperCase()}] ${cat.title}: ${formatScore(score)}/100`,
          category: 'pagespeed',
          pageUrl,
        });
      }

      // --- Key audit details (only failing ones) ---
      const audits = lr.audits;
      for (const auditId of KEY_AUDITS) {
        const audit = audits[auditId];
        if (!audit) continue;

        // Skip passing audits and informative/not-applicable ones
        if (
          audit.score === null ||
          audit.score >= 0.9 ||
          audit.scoreDisplayMode === 'notApplicable' ||
          audit.scoreDisplayMode === 'manual' ||
          audit.scoreDisplayMode === 'informative'
        ) {
          continue;
        }

        const severity = audit.score < 0.5 ? 'error' : 'warning';
        const displayVal = audit.displayValue ? ` (${audit.displayValue})` : '';

        issues.push({
          severity,
          message: `[${strategy.toUpperCase()}] ${audit.title}${displayVal}`,
          category: 'pagespeed',
          pageUrl,
        });
      }
    } catch (error) {
      issues.push({
        severity: 'warning',
        message: `PageSpeed test failed (${strategy}): ${error instanceof Error ? error.message : 'Unknown error'}`,
        category: 'pagespeed',
        pageUrl,
      });
    }
  }

  return issues;
}
