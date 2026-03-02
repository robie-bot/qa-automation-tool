import { TestIssue, ReviewConfig, SSEEvent, TestCategory, CATEGORY_INFO } from '@/types';
import { getProvider, AIUserContent } from './ai-providers';

interface AIFinding {
  severity: 'error' | 'warning' | 'info';
  message: string;
}

function groupIssuesByCategory(issues: TestIssue[]): string {
  const grouped: Record<string, TestIssue[]> = {};
  for (const issue of issues) {
    const catName = CATEGORY_INFO.find((c) => c.id === issue.category)?.name || issue.category;
    if (!grouped[catName]) grouped[catName] = [];
    grouped[catName].push(issue);
  }

  const lines: string[] = [];
  for (const [category, catIssues] of Object.entries(grouped)) {
    lines.push(`\n## ${category}`);
    const byPage: Record<string, TestIssue[]> = {};
    for (const issue of catIssues) {
      if (!byPage[issue.pageUrl]) byPage[issue.pageUrl] = [];
      byPage[issue.pageUrl].push(issue);
    }
    for (const [page, pageIssues] of Object.entries(byPage)) {
      lines.push(`\n### Page: ${page}`);
      for (const issue of pageIssues) {
        lines.push(`- [${issue.severity.toUpperCase()}] ${issue.message}`);
      }
    }
  }
  return lines.join('\n');
}

function truncateForContext(summary: string, maxChars: number): string {
  if (summary.length <= maxChars) return summary;

  // Remove info-severity lines first to save space
  const lines = summary.split('\n');
  const filtered = lines.filter((line) => !line.includes('[INFO]'));
  const result = filtered.join('\n');
  if (result.length <= maxChars) return result;

  return result.substring(0, maxChars) + '\n\n... (truncated)';
}

function collectScreenshots(issues: TestIssue[], maxCount: number): Array<{ base64: string; page: string; category: string }> {
  // Prioritize errors over warnings
  const withScreenshots = issues.filter((i) => i.screenshot);
  const errors = withScreenshots.filter((i) => i.severity === 'error');
  const warnings = withScreenshots.filter((i) => i.severity === 'warning');
  const rest = withScreenshots.filter((i) => i.severity === 'info');

  const prioritized = [...errors, ...warnings, ...rest].slice(0, maxCount);
  return prioritized.map((i) => ({
    base64: i.screenshot!,
    page: i.pageUrl,
    category: i.category,
  }));
}

export async function runAIReviewTests(
  targetUrl: string,
  pages: string[],
  existingIssues: TestIssue[],
  config: ReviewConfig,
  onEvent: (event: SSEEvent) => void
): Promise<TestIssue[]> {
  const issues: TestIssue[] = [];

  const provider = getProvider(config.aiProvider);
  const apiKey = provider.getApiKey();
  if (!apiKey) {
    issues.push({
      severity: 'warning',
      message: `${provider.envVarName} environment variable is not set. AI Review requires a valid ${provider.name} API key to function. Set the key in your environment and try again.`,
      category: 'ai-review',
      pageUrl: targetUrl,
    });
    return issues;
  }

  if (existingIssues.length === 0) {
    issues.push({
      severity: 'info',
      message: 'No automated test results to analyze. AI Review works best when other test categories have been run first, so it can provide expert analysis of the findings. Consider running AI Review together with other test categories for the most useful insights.',
      category: 'ai-review',
      pageUrl: targetUrl,
    });
    return issues;
  }

  onEvent({
    type: 'progress',
    page: targetUrl,
    category: 'ai-review',
    percent: 90,
    message: `${provider.name} is analyzing test results...`,
  });

  try {
    const issueSummary = groupIssuesByCategory(existingIssues);
    const truncated = truncateForContext(issueSummary, 80000);

    const errorCount = existingIssues.filter((i) => i.severity === 'error').length;
    const warningCount = existingIssues.filter((i) => i.severity === 'warning').length;
    const infoCount = existingIssues.filter((i) => i.severity === 'info').length;

    const userContent: AIUserContent[] = [];

    // Add screenshots if vision mode enabled
    if (config.aiReviewVision) {
      const screenshots = collectScreenshots(existingIssues, 10);
      for (const screenshot of screenshots) {
        userContent.push({
          type: 'image',
          base64: screenshot.base64,
          mediaType: 'image/jpeg',
        });
        userContent.push({
          type: 'text',
          text: `[Screenshot from page "${screenshot.page}" — ${screenshot.category} test]`,
        });
      }
    }

    userContent.push({
      type: 'text',
      text: `Here are the automated QA test results for ${targetUrl} (${pages.length} pages tested):

Summary: ${errorCount} errors, ${warningCount} warnings, ${infoCount} info items.

${truncated}

Please analyze these results and provide your expert QA assessment.`,
    });

    const systemPrompt = `You are an expert QA engineer reviewing automated test results for a website. Analyze the findings and return a JSON array of objects, each with "severity" ("error", "warning", or "info") and "message" (string) fields.

Your analysis should cover:
1. **Prioritization**: Which issues are most critical and should be fixed first?
2. **Patterns**: Are there recurring issues across pages that suggest a systemic problem?
3. **Root Causes**: What might be causing the detected issues?
4. **False Positives**: Flag any results that look like they might be false positives.
5. **Recommendations**: Specific, actionable recommendations for fixing key issues.
6. **Overall Assessment**: A summary of the website's quality based on these results.

Use "error" severity for critical findings, "warning" for moderate concerns, and "info" for observations and general guidance.

Write clear, concise messages. Each finding should be self-contained and actionable.

Respond ONLY with a valid JSON array. No markdown, no code fences, no additional text.`;

    const responseText = await provider.streamCompletion({ systemPrompt, userContent });

    // Parse JSON response
    let findings: AIFinding[];
    try {
      // Strip markdown code fences if present
      let jsonText = responseText.trim();
      if (jsonText.startsWith('```')) {
        jsonText = jsonText.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
      }
      findings = JSON.parse(jsonText);

      if (!Array.isArray(findings)) {
        throw new Error('Response is not an array');
      }
    } catch {
      // Fallback: return raw AI text as a single info issue
      issues.push({
        severity: 'info',
        message: responseText,
        category: 'ai-review',
        pageUrl: targetUrl,
      });
      return issues;
    }

    for (const finding of findings) {
      const severity = ['error', 'warning', 'info'].includes(finding.severity)
        ? (finding.severity as 'error' | 'warning' | 'info')
        : 'info';

      issues.push({
        severity,
        message: finding.message,
        category: 'ai-review',
        pageUrl: targetUrl,
      });
    }
  } catch (error) {
    issues.push({
      severity: 'warning',
      message: `AI Review failed: ${error instanceof Error ? error.message : 'Unknown error'}. The rest of your test results are unaffected.`,
      category: 'ai-review',
      pageUrl: targetUrl,
    });
  }

  return issues;
}
