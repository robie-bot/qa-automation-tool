import { Page } from 'playwright';
import { TestIssue, ReviewConfig } from '@/types';

interface RGB {
  r: number;
  g: number;
  b: number;
}

// CIE2000 Delta-E approximation
function deltaE(lab1: [number, number, number], lab2: [number, number, number]): number {
  const [L1, a1, b1] = lab1;
  const [L2, a2, b2] = lab2;

  const dL = L2 - L1;
  const meanL = (L1 + L2) / 2;
  const C1 = Math.sqrt(a1 * a1 + b1 * b1);
  const C2 = Math.sqrt(a2 * a2 + b2 * b2);
  const meanC = (C1 + C2) / 2;
  const dC = C2 - C1;

  let dH = Math.sqrt(Math.max(0, (a1 - a2) * (a1 - a2) + (b1 - b2) * (b1 - b2) - dC * dC));

  const SL = 1 + (0.015 * (meanL - 50) * (meanL - 50)) / Math.sqrt(20 + (meanL - 50) * (meanL - 50));
  const SC = 1 + 0.045 * meanC;
  const SH = 1 + 0.015 * meanC;

  const result = Math.sqrt(
    (dL / SL) * (dL / SL) +
    (dC / SC) * (dC / SC) +
    (dH / SH) * (dH / SH)
  );

  return result;
}

function rgbToLab(r: number, g: number, b: number): [number, number, number] {
  // RGB to XYZ
  let rn = r / 255;
  let gn = g / 255;
  let bn = b / 255;

  rn = rn > 0.04045 ? Math.pow((rn + 0.055) / 1.055, 2.4) : rn / 12.92;
  gn = gn > 0.04045 ? Math.pow((gn + 0.055) / 1.055, 2.4) : gn / 12.92;
  bn = bn > 0.04045 ? Math.pow((bn + 0.055) / 1.055, 2.4) : bn / 12.92;

  const x = (rn * 0.4124 + gn * 0.3576 + bn * 0.1805) / 0.95047;
  const y = (rn * 0.2126 + gn * 0.7152 + bn * 0.0722) / 1.0;
  const z = (rn * 0.0193 + gn * 0.1192 + bn * 0.9505) / 1.08883;

  const fx = x > 0.008856 ? Math.cbrt(x) : (7.787 * x) + 16 / 116;
  const fy = y > 0.008856 ? Math.cbrt(y) : (7.787 * y) + 16 / 116;
  const fz = z > 0.008856 ? Math.cbrt(z) : (7.787 * z) + 16 / 116;

  const L = (116 * fy) - 16;
  const a = 500 * (fx - fy);
  const bLab = 200 * (fy - fz);

  return [L, a, bLab];
}

function rgbToHex(r: number, g: number, b: number): string {
  return `#${[r, g, b].map((c) => c.toString(16).padStart(2, '0')).join('')}`;
}

function extractDominantColors(imageData: Buffer, sampleSize: number = 1000): RGB[] {
  // Simple k-means-like color extraction from raw pixel data
  const pixels: RGB[] = [];

  // Sample pixels evenly
  const step = Math.max(1, Math.floor(imageData.length / (sampleSize * 4)));
  for (let i = 0; i < imageData.length - 3; i += step * 4) {
    pixels.push({
      r: imageData[i],
      g: imageData[i + 1],
      b: imageData[i + 2],
    });
  }

  // Quantize colors into buckets (8-bit to 4-bit)
  const buckets = new Map<string, { color: RGB; count: number }>();
  for (const p of pixels) {
    const key = `${Math.round(p.r / 16)}-${Math.round(p.g / 16)}-${Math.round(p.b / 16)}`;
    const existing = buckets.get(key);
    if (existing) {
      existing.count++;
      existing.color.r = Math.round((existing.color.r * (existing.count - 1) + p.r) / existing.count);
      existing.color.g = Math.round((existing.color.g * (existing.count - 1) + p.g) / existing.count);
      existing.color.b = Math.round((existing.color.b * (existing.count - 1) + p.b) / existing.count);
    } else {
      buckets.set(key, { color: { ...p }, count: 1 });
    }
  }

  // Sort by frequency and return top colors
  const sorted = [...buckets.values()].sort((a, b) => b.count - a.count);
  return sorted.slice(0, 10).map((b) => b.color);
}

export async function runColorSchemeTests(
  page: Page,
  pageUrl: string,
  config: ReviewConfig,
  referenceImage?: string | null
): Promise<TestIssue[]> {
  const issues: TestIssue[] = [];
  const threshold = config.colorThreshold;

  try {
    await page.setViewportSize({ width: 1440, height: 900 });

    // Take screenshot of the page
    const screenshot = await page.screenshot({ fullPage: false, type: 'png' });

    // Extract dominant colors from the page
    let pageColors: RGB[];
    try {
      const sharp = (await import('sharp')).default;
      const { data } = await sharp(screenshot).raw().toBuffer({ resolveWithObject: true });
      pageColors = extractDominantColors(data);
    } catch {
      // Fallback: extract colors via DOM
      const domColors = await page.evaluate(() => {
        const elements = Array.from(document.querySelectorAll('body *'));
        const colors = new Map<string, number>();

        for (const el of elements.slice(0, 200)) {
          const style = getComputedStyle(el);
          for (const prop of ['color', 'backgroundColor', 'borderColor']) {
            const color = style.getPropertyValue(prop === 'borderColor' ? 'border-color' : prop === 'backgroundColor' ? 'background-color' : prop);
            if (color && color !== 'rgba(0, 0, 0, 0)' && color !== 'transparent') {
              colors.set(color, (colors.get(color) || 0) + 1);
            }
          }
        }

        return [...colors.entries()]
          .sort((a, b) => b[1] - a[1])
          .slice(0, 10)
          .map(([c]) => c);
      });

      pageColors = domColors.map((c) => {
        const m = c.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
        if (m) return { r: parseInt(m[1]), g: parseInt(m[2]), b: parseInt(m[3]) };
        return { r: 0, g: 0, b: 0 };
      });
    }

    // Report extracted page colors
    const colorList = pageColors
      .map((c) => rgbToHex(c.r, c.g, c.b))
      .join(', ');

    issues.push({
      severity: 'info',
      message: `Dominant colors extracted: ${colorList}`,
      category: 'color-scheme',
      pageUrl,
      screenshot: screenshot.toString('base64'),
    });

    // Compare against reference if provided
    if (referenceImage) {
      try {
        const sharp = (await import('sharp')).default;
        const refBuffer = Buffer.from(referenceImage, 'base64');
        const { data: refData } = await sharp(refBuffer).raw().toBuffer({ resolveWithObject: true });
        const refColors = extractDominantColors(refData);

        // Find mismatched colors
        for (const pageColor of pageColors.slice(0, 5)) {
          const pageLab = rgbToLab(pageColor.r, pageColor.g, pageColor.b);

          let minDelta = Infinity;
          let closestRef: RGB | null = null;

          for (const refColor of refColors) {
            const refLab = rgbToLab(refColor.r, refColor.g, refColor.b);
            const d = deltaE(pageLab, refLab);
            if (d < minDelta) {
              minDelta = d;
              closestRef = refColor;
            }
          }

          if (minDelta > threshold && closestRef) {
            issues.push({
              severity: 'warning',
              message: `Color mismatch: page uses ${rgbToHex(pageColor.r, pageColor.g, pageColor.b)} but closest reference color is ${rgbToHex(closestRef.r, closestRef.g, closestRef.b)} (Delta-E: ${minDelta.toFixed(1)})`,
              category: 'color-scheme',
              pageUrl,
            });
          }
        }

        // Check for reference colors not present on the page
        for (const refColor of refColors.slice(0, 5)) {
          const refLab = rgbToLab(refColor.r, refColor.g, refColor.b);
          let found = false;

          for (const pageColor of pageColors) {
            const pageLab = rgbToLab(pageColor.r, pageColor.g, pageColor.b);
            if (deltaE(refLab, pageLab) <= threshold) {
              found = true;
              break;
            }
          }

          if (!found) {
            issues.push({
              severity: 'info',
              message: `Reference color ${rgbToHex(refColor.r, refColor.g, refColor.b)} not found on page`,
              category: 'color-scheme',
              pageUrl,
            });
          }
        }
      } catch (error) {
        issues.push({
          severity: 'warning',
          message: `Failed to compare with reference image: ${error instanceof Error ? error.message : 'Unknown error'}`,
          category: 'color-scheme',
          pageUrl,
        });
      }
    } else {
      issues.push({
        severity: 'info',
        message: 'No reference image provided — only color extraction performed',
        category: 'color-scheme',
        pageUrl,
      });
    }
  } catch (error) {
    issues.push({
      severity: 'warning',
      message: `Color scheme test error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      category: 'color-scheme',
      pageUrl,
    });
  }

  return issues;
}
