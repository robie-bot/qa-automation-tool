import { Page } from 'playwright';
import { TestIssue, ReviewConfig } from '@/types';

function luminance(r: number, g: number, b: number): number {
  const [rs, gs, bs] = [r, g, b].map((c) => {
    c = c / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

function contrastRatio(l1: number, l2: number): number {
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

function parseColor(color: string): { r: number; g: number; b: number } | null {
  const rgbMatch = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (rgbMatch) {
    return { r: parseInt(rgbMatch[1]), g: parseInt(rgbMatch[2]), b: parseInt(rgbMatch[3]) };
  }
  return null;
}

export async function runTypographyTests(
  page: Page,
  pageUrl: string,
  config: ReviewConfig
): Promise<TestIssue[]> {
  const issues: TestIssue[] = [];
  const typoConfig = config.typography;

  try {
    // Set a standard viewport for typography tests
    await page.setViewportSize({ width: 1440, height: 900 });

    const textData = await page.evaluate(() => {
      const headings: {
        tag: string;
        text: string;
        fontSize: number;
        lineHeight: number;
        fontFamily: string;
        color: string;
        bgColor: string;
        selector: string;
      }[] = [];

      const bodyTexts: {
        text: string;
        fontSize: number;
        lineHeight: number;
        color: string;
        bgColor: string;
        selector: string;
      }[] = [];

      // Collect headings
      for (const level of ['h1', 'h2', 'h3', 'h4', 'h5', 'h6']) {
        const els = document.querySelectorAll(level);
        els.forEach((el, idx) => {
          const style = getComputedStyle(el);
          const rect = el.getBoundingClientRect();
          if (rect.width === 0 || style.display === 'none') return;

          // Get background color from element or ancestors
          let bgColor = 'rgba(0, 0, 0, 0)';
          let current: Element | null = el;
          while (current) {
            const bg = getComputedStyle(current).backgroundColor;
            if (bg && bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent') {
              bgColor = bg;
              break;
            }
            current = current.parentElement;
          }
          if (bgColor === 'rgba(0, 0, 0, 0)') bgColor = 'rgb(255, 255, 255)';

          headings.push({
            tag: level,
            text: (el.textContent || '').trim().substring(0, 80),
            fontSize: parseFloat(style.fontSize),
            lineHeight: parseFloat(style.lineHeight) || parseFloat(style.fontSize) * 1.2,
            fontFamily: style.fontFamily,
            color: style.color,
            bgColor,
            selector: `${level}:nth-of-type(${idx + 1})`,
          });
        });
      }

      // Collect body text (paragraphs and list items)
      const bodyEls = document.querySelectorAll('p, li, td, span, div');
      const seen = new Set<string>();
      bodyEls.forEach((el) => {
        const text = (el.textContent || '').trim();
        if (text.length < 10 || seen.has(text.substring(0, 40))) return;
        seen.add(text.substring(0, 40));

        const style = getComputedStyle(el);
        const rect = el.getBoundingClientRect();
        if (rect.width === 0 || style.display === 'none') return;

        // Skip elements that contain headings
        if (el.querySelector('h1, h2, h3, h4, h5, h6')) return;

        let bgColor = 'rgba(0, 0, 0, 0)';
        let current: Element | null = el;
        while (current) {
          const bg = getComputedStyle(current).backgroundColor;
          if (bg && bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent') {
            bgColor = bg;
            break;
          }
          current = current.parentElement;
        }
        if (bgColor === 'rgba(0, 0, 0, 0)') bgColor = 'rgb(255, 255, 255)';

        bodyTexts.push({
          text: text.substring(0, 80),
          fontSize: parseFloat(style.fontSize),
          lineHeight: parseFloat(style.lineHeight) || parseFloat(style.fontSize) * 1.2,
          color: style.color,
          bgColor,
          selector: el.tagName.toLowerCase(),
        });

        if (bodyTexts.length > 20) return;
      });

      return { headings, bodyTexts };
    });

    // Validate heading hierarchy
    const headingSizes: Record<string, number[]> = {};
    for (const h of textData.headings) {
      if (!headingSizes[h.tag]) headingSizes[h.tag] = [];
      headingSizes[h.tag].push(h.fontSize);
    }

    const headingOrder = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'];
    for (let i = 0; i < headingOrder.length - 1; i++) {
      const currentSizes = headingSizes[headingOrder[i]];
      const nextSizes = headingSizes[headingOrder[i + 1]];
      if (currentSizes && nextSizes) {
        const avgCurrent = currentSizes.reduce((a, b) => a + b, 0) / currentSizes.length;
        const avgNext = nextSizes.reduce((a, b) => a + b, 0) / nextSizes.length;
        if (avgNext >= avgCurrent) {
          issues.push({
            severity: 'warning',
            message: `Heading hierarchy issue: ${headingOrder[i + 1]} (${avgNext}px) is not smaller than ${headingOrder[i]} (${avgCurrent}px)`,
            category: 'typography',
            pageUrl,
          });
        }
      }
    }

    // Check heading sizes against config
    const minSizes: Record<string, number> = {
      h1: typoConfig.h1MinSize,
      h2: typoConfig.h2MinSize,
      h3: typoConfig.h3MinSize,
    };

    for (const h of textData.headings) {
      const minSize = minSizes[h.tag];
      if (minSize && h.fontSize < minSize) {
        issues.push({
          severity: 'warning',
          message: `${h.tag} font size (${h.fontSize}px) is below minimum (${minSize}px): "${h.text}"`,
          selector: h.selector,
          category: 'typography',
          pageUrl,
        });
      }

      if (h.text.trim() === '') {
        issues.push({
          severity: 'warning',
          message: `Empty ${h.tag} heading detected`,
          selector: h.selector,
          category: 'typography',
          pageUrl,
        });
      }
    }

    // Check body text sizes
    for (const t of textData.bodyTexts) {
      if (t.fontSize < typoConfig.bodyMinSize) {
        issues.push({
          severity: 'warning',
          message: `Body text font size (${t.fontSize}px) is below minimum (${typoConfig.bodyMinSize}px): "${t.text.substring(0, 40)}..."`,
          category: 'typography',
          pageUrl,
        });
      }

      // Check line height ratio
      const ratio = t.lineHeight / t.fontSize;
      if (ratio < typoConfig.minLineHeightRatio) {
        issues.push({
          severity: 'info',
          message: `Line height ratio (${ratio.toFixed(2)}) is below recommended (${typoConfig.minLineHeightRatio}): "${t.text.substring(0, 40)}..."`,
          category: 'typography',
          pageUrl,
        });
      }
    }

    // Check text contrast (WCAG AA)
    const allText = [...textData.headings, ...textData.bodyTexts];
    for (const t of allText.slice(0, 30)) {
      const fg = parseColor(t.color);
      const bg = parseColor(t.bgColor);
      if (fg && bg) {
        const fgL = luminance(fg.r, fg.g, fg.b);
        const bgL = luminance(bg.r, bg.g, bg.b);
        const ratio = contrastRatio(fgL, bgL);
        const minRatio = typoConfig.minContrastRatio;

        if (ratio < minRatio) {
          const text = 'text' in t ? t.text : '';
          issues.push({
            severity: 'error',
            message: `Low text contrast ratio (${ratio.toFixed(2)}:1, minimum ${minRatio}:1) for text "${text.substring(0, 40)}..." — color: ${t.color} on ${t.bgColor}`,
            category: 'typography',
            pageUrl,
          });
        }
      }
    }

    // Check for missing h1
    if (!textData.headings.some((h) => h.tag === 'h1')) {
      issues.push({
        severity: 'warning',
        message: 'No h1 heading found on page',
        category: 'typography',
        pageUrl,
      });
    }

    // Check for multiple h1s
    const h1Count = textData.headings.filter((h) => h.tag === 'h1').length;
    if (h1Count > 1) {
      issues.push({
        severity: 'info',
        message: `Multiple h1 headings found (${h1Count})`,
        category: 'typography',
        pageUrl,
      });
    }
  } catch (error) {
    issues.push({
      severity: 'warning',
      message: `Typography test error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      category: 'typography',
      pageUrl,
    });
  }

  return issues;
}
