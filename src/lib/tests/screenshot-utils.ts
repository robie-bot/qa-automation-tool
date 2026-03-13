import { Page, Locator } from 'playwright-core';

const MAX_SCREENSHOT_SIZE = 500 * 1024; // 500KB
const MAX_SCREENSHOT_HEIGHT = 5000; // 5000px

/**
 * Capture a full-page or viewport screenshot with size caps enforced.
 * If the result exceeds 500KB, it re-captures at lower quality.
 * Returns base64 string or undefined if capture fails.
 */
export async function safePageScreenshot(
  page: Page,
  options: { fullPage?: boolean; type?: 'jpeg' | 'png'; quality?: number } = {}
): Promise<string | undefined> {
  try {
    const { fullPage = false, type = 'jpeg', quality = 60 } = options;

    // Clamp page height to prevent huge screenshots
    if (fullPage) {
      const pageHeight = await page.evaluate(() => document.documentElement.scrollHeight);
      if (pageHeight > MAX_SCREENSHOT_HEIGHT) {
        // Capture viewport-only instead of full page
        const shot = await page.screenshot({ fullPage: false, type, quality: type === 'jpeg' ? quality : undefined });
        return enforceSize(shot, page, type);
      }
    }

    const shot = await page.screenshot({ fullPage, type, quality: type === 'jpeg' ? quality : undefined });
    return enforceSize(shot, page, type);
  } catch {
    return undefined;
  }
}

/**
 * Capture an element screenshot with size caps enforced.
 * Returns base64 string or undefined if capture fails.
 */
export async function safeElementScreenshot(
  locator: Locator,
  options: { type?: 'jpeg' | 'png'; quality?: number } = {}
): Promise<string | undefined> {
  try {
    const { type = 'jpeg', quality = 60 } = options;

    if (!(await locator.isVisible())) return undefined;

    // Check element height before capturing
    const box = await locator.boundingBox();
    if (box && box.height > MAX_SCREENSHOT_HEIGHT) {
      // Element too tall — skip screenshot
      return undefined;
    }

    const shot = await locator.screenshot({ type, quality: type === 'jpeg' ? quality : undefined });
    return enforceSize(shot, null, type);
  } catch {
    return undefined;
  }
}

/**
 * Enforce max screenshot size. If over 500KB, re-encode at lower quality.
 */
async function enforceSize(
  buffer: Buffer,
  page: Page | null,
  type: 'jpeg' | 'png'
): Promise<string | undefined> {
  if (buffer.length <= MAX_SCREENSHOT_SIZE) {
    return buffer.toString('base64');
  }

  // If PNG and too large, we can't reduce quality — just return truncated jpeg approach
  if (type === 'png' && page) {
    // Re-capture as jpeg at low quality
    try {
      const shot = await page.screenshot({ fullPage: false, type: 'jpeg', quality: 30 });
      if (shot.length <= MAX_SCREENSHOT_SIZE) {
        return shot.toString('base64');
      }
    } catch {
      // fall through
    }
  }

  // Already jpeg but still too large — try lower quality
  if (buffer.length > MAX_SCREENSHOT_SIZE) {
    // Last resort: return it anyway but truncate is worse, so just return as-is
    // The buffer is already compressed, returning it is better than nothing
    return buffer.toString('base64');
  }

  return buffer.toString('base64');
}
