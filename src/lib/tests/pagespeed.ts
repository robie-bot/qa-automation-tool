import {
  TestIssue,
  ReviewConfig,
  PageSpeedData,
  PageSpeedStrategyResult,
  PageSpeedAudit,
  PageSpeedMetricValue,
  PageSpeedCategoryResult,
} from '@/types';

// PageSpeed Insights API — free tier, no key required (rate-limited to ~25 req/day)
// Set PAGESPEED_API_KEY env var for higher limits (free key from Google Cloud Console)
const PSI_API = 'https://www.googleapis.com/pagespeedonline/v5/runPagespeed';

interface LighthouseCategory {
  id: string;
  title: string;
  score: number | null;
  auditRefs?: { id: string; weight: number; group?: string }[];
}

interface LighthouseAudit {
  id: string;
  title: string;
  description: string;
  score: number | null;
  scoreDisplayMode: string;
  displayValue?: string;
  numericValue?: number;
  group?: string;
}

interface PSIResponse {
  lighthouseResult?: {
    categories: Record<string, LighthouseCategory>;
    audits: Record<string, LighthouseAudit>;
    categoryGroups?: Record<string, { title: string; description?: string }>;
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

const CORE_METRICS = [
  'first-contentful-paint',
  'largest-contentful-paint',
  'total-blocking-time',
  'cumulative-layout-shift',
  'speed-index',
  'interactive',
];

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

function extractStrategyResult(
  lr: NonNullable<PSIResponse['lighthouseResult']>,
  strategy: 'mobile' | 'desktop'
): PageSpeedStrategyResult {
  // Extract category results with auditRefs
  const categories: Record<string, PageSpeedCategoryResult> = {};
  for (const [key, cat] of Object.entries(lr.categories)) {
    categories[key] = {
      id: cat.id,
      title: cat.title,
      score: cat.score,
      auditRefs: (cat.auditRefs || []).map((ref) => ({
        id: ref.id,
        weight: ref.weight,
        group: ref.group,
      })),
    };
  }

  // Extract all audits
  const audits: Record<string, PageSpeedAudit> = {};
  for (const [id, audit] of Object.entries(lr.audits)) {
    audits[id] = {
      id: audit.id,
      title: audit.title,
      description: audit.description,
      score: audit.score,
      scoreDisplayMode: audit.scoreDisplayMode,
      displayValue: audit.displayValue,
      numericValue: audit.numericValue,
    };
  }

  // Build audit group mapping from category auditRefs
  for (const cat of Object.values(categories)) {
    for (const ref of cat.auditRefs) {
      if (ref.group && audits[ref.id]) {
        audits[ref.id].group = ref.group;
      }
    }
  }

  // Extract core metrics
  const metrics: PageSpeedMetricValue[] = [];
  for (const metricId of CORE_METRICS) {
    const audit = lr.audits[metricId];
    if (audit) {
      metrics.push({
        id: audit.id,
        title: audit.title,
        numericValue: audit.numericValue ?? 0,
        displayValue: audit.displayValue ?? '',
        score: audit.score,
      });
    }
  }

  return { strategy, categories, audits, metrics };
}

export interface PageSpeedTestResult {
  issues: TestIssue[];
  data: PageSpeedData;
}

export async function runPageSpeedTests(
  pageUrl: string,
  _config: ReviewConfig
): Promise<TestIssue[]> {
  const issues: TestIssue[] = [];
  const pageSpeedData: PageSpeedData = { pageUrl, mobile: null, desktop: null };

  // Run both mobile and desktop
  for (const strategy of ['mobile', 'desktop'] as const) {
    try {
      const apiKey = process.env.PAGESPEED_API_KEY;
      const params = new URLSearchParams({
        url: pageUrl,
        strategy,
        category: 'performance',
      });
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

      // Extract structured data for rich UI
      pageSpeedData[strategy] = extractStrategyResult(lr, strategy);

      // --- Category scores (flat text for backward compat / PDF / AI review) ---
      const categories = lr.categories;
      for (const [_key, cat] of Object.entries(categories)) {
        const score = cat.score;
        const severity = scoreToSeverity(score);
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

  // Add a metadata issue carrying the structured data for the rich UI
  if (pageSpeedData.mobile || pageSpeedData.desktop) {
    issues.push({
      severity: 'info',
      message: `PageSpeed Insights data collected for ${pageUrl}`,
      category: 'pagespeed',
      pageUrl,
      metadata: { type: 'pagespeed-result', data: pageSpeedData },
    });
  }

  return issues;
}
