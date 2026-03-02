export type Severity = 'error' | 'warning' | 'info';

export type AIProvider = 'claude' | 'openai' | 'gemini';

export type TestCategory = 'layout' | 'typography' | 'color-scheme' | 'broken-links' | 'pagespeed' | 'content-check' | 'text-finder' | 'images-media' | 'ai-review';

export interface DiscoveredPage {
  url: string;
  title: string;
  path: string;
}

export interface TestIssue {
  severity: Severity;
  message: string;
  selector?: string;
  screenshot?: string;
  category: TestCategory;
  pageUrl: string;
  viewport?: string;
  metadata?: Record<string, unknown>;
}

export interface TypographyConfig {
  h1MinSize: number;
  h2MinSize: number;
  h3MinSize: number;
  bodyMinSize: number;
  minLineHeightRatio: number;
  minContrastRatio: number;
}

export interface ReviewConfig {
  typography: TypographyConfig;
  colorThreshold: number;
  linkTimeout: number;
  viewports: number[];
  aiReviewVision: boolean;
  aiProvider: AIProvider;
}

export interface ReviewRequest {
  targetUrl: string;
  pages: string[];
  categories: TestCategory[];
  referenceImage?: string | null;
  contentDocument?: string | null;
  searchTerms?: string[];
  config: ReviewConfig;
}

export interface ProgressEvent {
  type: 'progress';
  page: string;
  category: TestCategory;
  percent: number;
  message: string;
}

export interface IssueEvent {
  type: 'issue';
  severity: Severity;
  page: string;
  category: TestCategory;
  message: string;
  screenshot?: string;
  metadata?: Record<string, unknown>;
}

export interface CompleteEvent {
  type: 'complete';
  reportId: string;
  summary: ReviewSummary;
}

export interface ErrorEvent {
  type: 'error';
  message: string;
}

export interface DataEvent {
  type: 'data';
  page: string;
  category: TestCategory;
  dataType: string;
  payload: unknown;
}

export type SSEEvent = ProgressEvent | IssueEvent | CompleteEvent | ErrorEvent | DataEvent;

// --- PageSpeed Insights structured types ---

export interface PageSpeedMetricValue {
  id: string;
  title: string;
  numericValue: number;
  displayValue: string;
  score: number | null;
}

export interface PageSpeedAudit {
  id: string;
  title: string;
  description: string;
  score: number | null;
  scoreDisplayMode: string;
  displayValue?: string;
  numericValue?: number;
  group?: string;
}

export interface PageSpeedCategoryResult {
  id: string;
  title: string;
  score: number | null;
  auditRefs: { id: string; weight: number; group?: string }[];
}

export interface PageSpeedStrategyResult {
  strategy: 'mobile' | 'desktop';
  categories: Record<string, PageSpeedCategoryResult>;
  audits: Record<string, PageSpeedAudit>;
  metrics: PageSpeedMetricValue[];
}

export interface PageSpeedData {
  pageUrl: string;
  mobile: PageSpeedStrategyResult | null;
  desktop: PageSpeedStrategyResult | null;
}

export interface ReviewSummary {
  totalIssues: number;
  errors: number;
  warnings: number;
  infos: number;
  byCategory: Record<TestCategory, number>;
  pagesReviewed: number;
  duration: number;
}

export interface CategoryInfo {
  id: TestCategory;
  name: string;
  description: string;
  icon: string;
  estimatedTime: string;
}

export type ReviewScope = 'full' | 'by-category' | 'by-page' | 'custom';

export interface ReviewState {
  targetUrl: string;
  pages: DiscoveredPage[];
  scope: ReviewScope;
  selectedCategories: TestCategory[];
  selectedPages: string[];
  referenceImage: string | null;
  contentDocument: string | null;       // base64 of uploaded PDF/TXT for content cross-check
  contentDocumentName: string | null;    // filename for display
  searchTerms: string[];                 // words/sentences/paragraphs for text-finder
  config: ReviewConfig;
}

export const DEFAULT_CONFIG: ReviewConfig = {
  typography: {
    h1MinSize: 32,
    h2MinSize: 24,
    h3MinSize: 20,
    bodyMinSize: 14,
    minLineHeightRatio: 1.4,
    minContrastRatio: 4.5,
  },
  colorThreshold: 10,
  linkTimeout: 5000,
  viewports: [1920, 1440, 1024, 768, 375],
  aiReviewVision: false,
  aiProvider: 'claude',
};

export const ALL_CATEGORIES: TestCategory[] = [
  'layout',
  'typography',
  'color-scheme',
  'broken-links',
  'pagespeed',
  'content-check',
  'text-finder',
  'images-media',
  'ai-review',
];

export const CATEGORY_INFO: CategoryInfo[] = [
  {
    id: 'layout',
    name: 'General Layout',
    description: 'Viewport responsiveness, element overlap, spacing consistency, z-index issues',
    icon: 'Layout',
    estimatedTime: '~2 min/page',
  },
  {
    id: 'typography',
    name: 'Typography & Content',
    description: 'Font sizes, font families, line heights, heading hierarchy, text contrast',
    icon: 'Type',
    estimatedTime: '~1 min/page',
  },
  {
    id: 'color-scheme',
    name: 'Color Scheme',
    description: 'Compare page colors against uploaded reference image/palette',
    icon: 'Palette',
    estimatedTime: '~1 min/page',
  },
  {
    id: 'broken-links',
    name: 'Broken Links & Images',
    description: 'Check all links return 200, all images load, missing alt text',
    icon: 'LinkIcon',
    estimatedTime: '~30 sec/page',
  },
  {
    id: 'pagespeed',
    name: 'PageSpeed Insights',
    description: 'Google Lighthouse performance, accessibility, best practices & SEO scores',
    icon: 'Gauge',
    estimatedTime: '~30 sec/page',
  },
  {
    id: 'content-check',
    name: 'Content Cross-Check',
    description: 'Upload a PDF, DOCX, ODT, or text document and verify its content appears on website pages',
    icon: 'FileCheck',
    estimatedTime: '~15 sec/page',
  },
  {
    id: 'text-finder',
    name: 'Text Finder',
    description: 'Search for specific words, sentences, or paragraphs across all pages',
    icon: 'TextSearch',
    estimatedTime: '~10 sec/page',
  },
  {
    id: 'images-media',
    name: 'Images & Media',
    description: 'Image quality, stretching, alt text quality, video loading, slider/carousel functionality',
    icon: 'Image',
    estimatedTime: '~1 min/page',
  },
  {
    id: 'ai-review',
    name: 'AI Review',
    description: 'Claude AI analyzes all test results to provide expert QA insights, prioritization, and recommendations',
    icon: 'Sparkles',
    estimatedTime: '~30 sec',
  },
];
