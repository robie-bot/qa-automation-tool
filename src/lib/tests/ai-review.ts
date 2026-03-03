import { Page } from 'playwright-core';
import { TestIssue, ReviewConfig, TestCategory, CATEGORY_INFO } from '@/types';
import { getProvider, AIUserContent } from './ai-providers';

interface AIFinding {
  severity: 'error' | 'warning' | 'info';
  message: string;
}

/** Viewports to capture when vision mode is enabled */
const VISION_VIEWPORTS = [
  { width: 1440, label: 'Desktop (1440px)' },
  { width: 768, label: 'Tablet (768px)' },
  { width: 375, label: 'Mobile (375px)' },
];

function buildCategoryChecklist(selectedCategories: TestCategory[]): string {
  const checklistItems = selectedCategories
    .filter((id) => id !== 'ai-review') // don't include ai-review itself
    .map((id) => {
      const info = CATEGORY_INFO.find((c) => c.id === id);
      if (!info) return null;
      return `- **${info.name}**: ${info.description}`;
    })
    .filter(Boolean);

  if (checklistItems.length === 0) {
    // If AI review is the only category selected, use a broad default checklist
    return [
      '- **Layout & Responsiveness**: Check for element overlap, spacing issues, broken layouts',
      '- **Typography**: Font sizes, readability, heading hierarchy, text contrast',
      '- **Links & Media**: Broken images, missing alt text, navigation issues',
      '- **Content Quality**: Placeholder text, spelling errors, inconsistent content',
      '- **Accessibility**: Color contrast, interactive element sizing, semantic structure',
    ].join('\n');
  }

  return checklistItems.join('\n');
}

async function extractPageInfo(page: Page): Promise<{
  title: string;
  metaDescription: string;
  textContent: string;
}> {
  const result = await page.evaluate(() => {
    const title = document.title || '';
    const metaDesc =
      document.querySelector('meta[name="description"]')?.getAttribute('content') || '';
    // Get visible text, truncated to keep context reasonable
    const text = document.body.innerText || '';
    return { title, metaDescription: metaDesc, textContent: text };
  });

  // Truncate text content to ~30k chars to stay within token limits
  if (result.textContent.length > 30000) {
    result.textContent = result.textContent.substring(0, 30000) + '\n\n... (truncated)';
  }

  return result;
}

async function captureScreenshots(
  page: Page,
  visionMode: boolean
): Promise<Array<{ base64: string; label: string }>> {
  const screenshots: Array<{ base64: string; label: string }> = [];

  if (!visionMode) {
    // Even without vision mode, capture one full-page screenshot for reference
    const shot = await page.screenshot({ fullPage: true, type: 'jpeg', quality: 50 });
    screenshots.push({ base64: shot.toString('base64'), label: 'Full page' });
    return screenshots;
  }

  // Vision mode: capture at multiple viewports
  const originalViewport = page.viewportSize();

  for (const vp of VISION_VIEWPORTS) {
    await page.setViewportSize({ width: vp.width, height: 900 });
    await page.waitForTimeout(500); // let layout settle

    const shot = await page.screenshot({ fullPage: true, type: 'jpeg', quality: 50 });
    screenshots.push({ base64: shot.toString('base64'), label: vp.label });
  }

  // Restore original viewport
  if (originalViewport) {
    await page.setViewportSize(originalViewport);
    await page.waitForTimeout(300);
  }

  return screenshots;
}

export async function runAIReviewTests(
  page: Page,
  pageUrl: string,
  config: ReviewConfig,
  selectedCategories: TestCategory[]
): Promise<TestIssue[]> {
  const issues: TestIssue[] = [];

  const provider = getProvider(config.aiProvider);
  const apiKey = provider.getApiKey();
  if (!apiKey) {
    issues.push({
      severity: 'warning',
      message: `${provider.envVarName} environment variable is not set. AI Review requires ${
        config.aiProvider === 'ollama'
          ? 'Ollama to be running locally'
          : `a valid ${provider.name} API key`
      }. Set up the provider and try again.`,
      category: 'ai-review',
      pageUrl,
    });
    return issues;
  }

  try {
    // 1. Extract page information
    const pageInfo = await extractPageInfo(page);

    // 2. Capture screenshots
    const screenshots = await captureScreenshots(page, config.aiReviewVision);

    // 3. Build the category checklist
    const checklist = buildCategoryChecklist(selectedCategories);

    // 4. Assemble user content for the AI
    const userContent: AIUserContent[] = [];

    // Add screenshots (always include at least a full-page shot in vision mode)
    if (config.aiReviewVision) {
      for (const screenshot of screenshots) {
        userContent.push({
          type: 'image',
          base64: screenshot.base64,
          mediaType: 'image/jpeg',
        });
        userContent.push({
          type: 'text',
          text: `[Screenshot: ${screenshot.label}]`,
        });
      }
    }

    // Add page context as text
    userContent.push({
      type: 'text',
      text: `Review this web page:

URL: ${pageUrl}
Title: ${pageInfo.title}
Meta Description: ${pageInfo.metaDescription || '(none)'}

--- Page Text Content ---
${pageInfo.textContent}

--- QA Checklist ---
Review the page against each of the following categories:
${checklist}

For each category above, identify any issues, concerns, or quality problems you find on this page. Be thorough and specific.`,
    });

    // 5. System prompt
    const systemPrompt = `You are an expert QA engineer performing an independent quality review of a web page. You are given the page content${config.aiReviewVision ? ' and screenshots at different viewport sizes' : ''}, along with a QA checklist of categories to evaluate.

Your job is to review the page against each category in the checklist and identify real issues. Return a JSON array of objects, each with:
- "severity": "error" (critical issues that must be fixed), "warning" (moderate concerns), or "info" (minor observations or suggestions)
- "message": A clear, actionable description of the finding. Start each message with the category name in brackets, e.g. "[Layout] ..." or "[Typography] ..."

Guidelines:
- Be specific: reference actual elements, text, or areas of the page
- Be practical: focus on real problems a user or developer would care about
- Cover every category in the checklist — report at least one finding per category (even if it's just an "info" confirming things look good)
${config.aiReviewVision ? '- Use the screenshots to check visual layout, responsiveness, spacing, and design consistency across viewports' : ''}
- Keep each finding concise (1-2 sentences)

Respond ONLY with a valid JSON array. No markdown, no code fences, no additional text.`;

    // 6. Call the AI
    const responseText = await provider.streamCompletion({ systemPrompt, userContent });

    // 7. Parse JSON response
    let findings: AIFinding[];
    try {
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
        pageUrl,
      });
      return issues;
    }

    // 8. Convert findings to TestIssues
    for (const finding of findings) {
      const severity = ['error', 'warning', 'info'].includes(finding.severity)
        ? (finding.severity as 'error' | 'warning' | 'info')
        : 'info';

      issues.push({
        severity,
        message: finding.message,
        category: 'ai-review',
        pageUrl,
      });
    }
  } catch (error) {
    issues.push({
      severity: 'warning',
      message: `AI Review failed: ${error instanceof Error ? error.message : 'Unknown error'}. The rest of your test results are unaffected.`,
      category: 'ai-review',
      pageUrl,
    });
  }

  return issues;
}
