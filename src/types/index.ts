export type Severity = 'error' | 'warning' | 'info';

export type TestCategory = 'layout' | 'typography' | 'color-scheme' | 'broken-links';

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
}

export interface ReviewRequest {
  targetUrl: string;
  pages: string[];
  categories: TestCategory[];
  referenceImage?: string | null;
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

export type SSEEvent = ProgressEvent | IssueEvent | CompleteEvent | ErrorEvent;

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
};

export const ALL_CATEGORIES: TestCategory[] = [
  'layout',
  'typography',
  'color-scheme',
  'broken-links',
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
];
