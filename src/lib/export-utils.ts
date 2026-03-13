import { TestIssue, ReviewSummary, CATEGORY_INFO } from '@/types';

/** Export issues as CSV string */
export function issuesToCSV(issues: TestIssue[], summary: ReviewSummary): string {
  const headers = ['Severity', 'Category', 'Page URL', 'Viewport', 'Message', 'Selector'];
  const rows = issues.map((issue) => [
    issue.severity,
    CATEGORY_INFO.find((c) => c.id === issue.category)?.name || issue.category,
    issue.pageUrl,
    issue.viewport || '',
    `"${(issue.message || '').replace(/"/g, '""')}"`,
    issue.selector || '',
  ]);

  const summaryRows = [
    [],
    ['Summary'],
    ['Total Issues', String(summary.totalIssues)],
    ['Errors', String(summary.errors)],
    ['Warnings', String(summary.warnings)],
    ['Info', String(summary.infos)],
    ['Pages Reviewed', String(summary.pagesReviewed)],
    ['Duration (ms)', String(summary.duration)],
  ];

  return [
    headers.join(','),
    ...rows.map((r) => r.join(',')),
    ...summaryRows.map((r) => r.join(',')),
  ].join('\n');
}

/** Export issues as JSON object */
export function issuesToJSON(issues: TestIssue[], summary: ReviewSummary) {
  return JSON.stringify(
    {
      summary: {
        totalIssues: summary.totalIssues,
        errors: summary.errors,
        warnings: summary.warnings,
        infos: summary.infos,
        pagesReviewed: summary.pagesReviewed,
        duration: summary.duration,
        byCategory: summary.byCategory,
      },
      issues: issues.map((issue) => ({
        severity: issue.severity,
        category: issue.category,
        categoryName: CATEGORY_INFO.find((c) => c.id === issue.category)?.name || issue.category,
        pageUrl: issue.pageUrl,
        viewport: issue.viewport || null,
        message: issue.message,
        selector: issue.selector || null,
        hasScreenshot: !!issue.screenshot,
      })),
    },
    null,
    2
  );
}

/** Download a string as a file */
export function downloadString(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/** Download all screenshots as a ZIP (uses JSZip-like manual approach) */
export async function downloadScreenshotsAsZip(issues: TestIssue[]) {
  const screenshotIssues = issues.filter((i) => i.screenshot);
  if (screenshotIssues.length === 0) return;

  // Dynamic import JSZip
  const JSZip = (await import('jszip')).default;
  const zip = new JSZip();

  screenshotIssues.forEach((issue, idx) => {
    const categoryName = CATEGORY_INFO.find((c) => c.id === issue.category)?.name || issue.category;
    const filename = `${String(idx + 1).padStart(3, '0')}-${issue.severity}-${categoryName.replace(/\s+/g, '-').toLowerCase()}.jpg`;

    // Convert base64 to binary
    const binaryString = atob(issue.screenshot!);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    zip.file(filename, bytes);
  });

  const blob = await zip.generateAsync({ type: 'blob' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'screenshots.zip';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
