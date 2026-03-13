import { TestIssue, CATEGORY_INFO } from '@/types';

/** Group issues by a common pattern/message prefix */
export interface IssueGroup {
  key: string;
  label: string;
  issues: (TestIssue & { _origIdx: number })[];
  severity: 'error' | 'warning' | 'info';
  category: string;
}

/** Get a normalized grouping key from an issue message */
function getGroupKey(issue: TestIssue): string {
  const msg = issue.message.toLowerCase();

  // Contrast ratio issues
  if (msg.includes('contrast ratio')) return `contrast-${issue.category}`;
  // Font size issues
  if (msg.includes('font size') || msg.includes('font-size')) return `font-size-${issue.category}`;
  // Missing alt text
  if (msg.includes('alt text') || msg.includes('alt attribute')) return `alt-text-${issue.category}`;
  // Broken links
  if (msg.includes('returned') && msg.includes('status')) return `broken-link-${issue.category}`;
  if (msg.includes('broken link') || msg.includes('404')) return `broken-link-${issue.category}`;
  // Overflow issues
  if (msg.includes('overflow') || msg.includes('overflows')) return `overflow-${issue.category}`;
  // Z-index issues
  if (msg.includes('z-index')) return `z-index-${issue.category}`;
  // Image loading issues
  if (msg.includes('image') && (msg.includes('failed') || msg.includes('broken'))) return `broken-image-${issue.category}`;
  // Non-functional buttons/links (dead clicks)
  if (msg.includes('non-functional')) return `dead-click-${issue.category}`;
  // Heading hierarchy
  if (msg.includes('heading') && msg.includes('hierarchy')) return `heading-hierarchy-${issue.category}`;
  // Line height
  if (msg.includes('line height') || msg.includes('line-height')) return `line-height-${issue.category}`;
  // Performance
  if (msg.includes('performance') || msg.includes('largest contentful')) return `performance-${issue.category}`;

  // Fallback: use category + severity
  return `${issue.category}-${issue.severity}-other`;
}

/** Get a human-readable group label */
function getGroupLabel(key: string): string {
  const labels: Record<string, string> = {
    'contrast': 'Contrast Ratio Issues',
    'font-size': 'Font Size Issues',
    'alt-text': 'Missing Alt Text',
    'broken-link': 'Broken Links',
    'overflow': 'Content Overflow',
    'z-index': 'Z-Index Issues',
    'broken-image': 'Broken Images',
    'dead-click': 'Non-Functional Buttons & Links',
    'heading-hierarchy': 'Heading Hierarchy',
    'line-height': 'Line Height Issues',
    'performance': 'Performance Issues',
  };

  for (const [prefix, label] of Object.entries(labels)) {
    if (key.startsWith(prefix)) return label;
  }

  // Fallback: use category name
  const catId = key.split('-')[0];
  const catInfo = CATEGORY_INFO.find((c) => c.id === catId);
  return catInfo ? `${catInfo.name} — Other` : 'Other Issues';
}

/** Group issues by common patterns */
export function groupIssues(issues: (TestIssue & { _origIdx: number })[]): IssueGroup[] {
  const groups = new Map<string, IssueGroup>();

  for (const issue of issues) {
    const key = getGroupKey(issue);
    if (!groups.has(key)) {
      groups.set(key, {
        key,
        label: getGroupLabel(key),
        issues: [],
        severity: issue.severity,
        category: issue.category,
      });
    }
    const group = groups.get(key)!;
    group.issues.push(issue);
    // Promote severity to worst in group
    if (issue.severity === 'error') group.severity = 'error';
    else if (issue.severity === 'warning' && group.severity !== 'error') group.severity = 'warning';
  }

  // Sort: errors first, then warnings, then info. Within same severity, most issues first.
  const severityOrder = { error: 0, warning: 1, info: 2 };
  return Array.from(groups.values()).sort((a, b) => {
    const sevDiff = severityOrder[a.severity] - severityOrder[b.severity];
    if (sevDiff !== 0) return sevDiff;
    return b.issues.length - a.issues.length;
  });
}

/** Common CSS/HTML fix suggestions for known issues */
export function getFixSuggestion(issue: TestIssue): string | null {
  const msg = issue.message.toLowerCase();

  // Contrast ratio
  if (msg.includes('contrast ratio')) {
    const match = issue.message.match(/(\d+\.?\d*):1/);
    if (match) {
      return `/* Increase contrast to at least 4.5:1 for normal text, 3:1 for large text */\ncolor: /* use a darker/lighter color */;\n/* Tool: https://webaim.org/resources/contrastchecker/ */`;
    }
  }

  // Font size too small
  if (msg.includes('font size') && msg.includes('small')) {
    return `/* Minimum recommended font sizes */\nbody { font-size: 16px; }\nh1 { font-size: 2rem; } /* 32px */\nh2 { font-size: 1.5rem; } /* 24px */\nh3 { font-size: 1.25rem; } /* 20px */`;
  }

  // Missing alt text
  if (msg.includes('alt text') || msg.includes('alt attribute')) {
    return `<!-- Add descriptive alt text -->\n<img src="..." alt="Description of the image content" />\n\n<!-- For decorative images -->\n<img src="..." alt="" role="presentation" />`;
  }

  // Overflow
  if (msg.includes('overflow')) {
    return `/* Prevent horizontal overflow */\n.container {\n  max-width: 100%;\n  overflow-x: hidden;\n}\n\n/* Or use word-break for text */\n.text {\n  word-break: break-word;\n  overflow-wrap: break-word;\n}`;
  }

  // Z-index
  if (msg.includes('z-index')) {
    return `/* Use a z-index scale */\n:root {\n  --z-dropdown: 100;\n  --z-sticky: 200;\n  --z-fixed: 300;\n  --z-modal: 400;\n  --z-tooltip: 500;\n}`;
  }

  // Line height
  if (msg.includes('line height') || msg.includes('line-height')) {
    return `/* Recommended line heights */\nbody { line-height: 1.5; }\nh1, h2, h3 { line-height: 1.2; }\np { line-height: 1.6; }`;
  }

  // Heading hierarchy
  if (msg.includes('heading') && (msg.includes('skip') || msg.includes('hierarchy'))) {
    return `<!-- Correct heading hierarchy -->\n<h1>Page Title</h1>\n  <h2>Section</h2>\n    <h3>Subsection</h3>\n<!-- Never skip levels (e.g., h1 → h3) -->`;
  }

  // Broken link
  if (msg.includes('404') || (msg.includes('returned') && msg.includes('status'))) {
    return `<!-- Check the URL and update or remove the link -->\n<a href="/correct-url">Link text</a>\n\n<!-- For removed pages, set up a redirect -->\n/* In next.config.js */\nredirects: [{ source: '/old', destination: '/new', permanent: true }]`;
  }

  // Non-functional button/link
  if (msg.includes('non-functional')) {
    if (msg.includes('<a') || msg.includes('href')) {
      return `<!-- Replace dead link with a proper URL or button -->\n<a href="/actual-destination">Link text</a>\n\n<!-- Or use a button if it triggers an action -->\n<button type="button" onclick="handleClick()">Action</button>`;
    }
    return `<!-- Add a click handler or form association -->\n<button type="button" onclick="handleAction()">Action</button>\n\n<!-- Or wrap in a form -->\n<form action="/endpoint">\n  <button type="submit">Submit</button>\n</form>`;
  }

  // Image loading
  if (msg.includes('image') && (msg.includes('failed') || msg.includes('broken'))) {
    return `<!-- Verify image path and add fallback -->\n<img\n  src="/images/photo.jpg"\n  alt="Description"\n  loading="lazy"\n  onerror="this.src='/images/placeholder.jpg'"\n/>`;
  }

  return null;
}
