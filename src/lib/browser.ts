import { Browser } from 'playwright-core';

/**
 * Launch a Chromium browser that works in both local dev and Vercel serverless.
 *
 * - On Vercel: uses @sparticuz/chromium (serverless-compatible binary)
 * - Locally: uses the full Playwright-managed Chromium
 */
export async function launchBrowser(): Promise<Browser> {
  const isVercel = !!process.env.VERCEL || !!process.env.AWS_LAMBDA_FUNCTION_NAME;

  if (isVercel) {
    const chromium = (await import('@sparticuz/chromium')).default;
    const { chromium: playwrightChromium } = await import('playwright-core');

    const executablePath = await chromium.executablePath();

    return playwrightChromium.launch({
      args: chromium.args,
      executablePath,
      headless: true,
    });
  } else {
    // Local dev — use the full Playwright install
    const { chromium } = await import('playwright');
    return chromium.launch({ headless: true });
  }
}
