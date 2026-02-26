import { Page } from 'playwright-core';
import { TestIssue, ReviewConfig } from '@/types';

// ─── Types for page.evaluate() return values ───────────────────────────────

interface ImageInfo {
  src: string;
  alt: string;
  hasAlt: boolean;
  naturalWidth: number;
  naturalHeight: number;
  renderedWidth: number;
  renderedHeight: number;
  objectFit: string;
  objectPosition: string;
  parentOverflow: string;
  parentWidth: number;
  parentHeight: number;
  isDecorative: boolean;
  selector: string;
}

interface VideoInfo {
  type: 'video' | 'iframe-video';
  src: string;
  hasSrc: boolean;
  readyState?: number;
  networkState?: number;
  errorCode: number | null;
  width: number;
  height: number;
  selector: string;
}

interface SliderInfo {
  library: string;
  slideCount: number;
  hasNav: boolean;
  width: number;
  height: number;
  isVisible: boolean;
}

// ─── Constants ──────────────────────────────────────────────────────────────

const GENERIC_ALT_PATTERNS = [
  /^image$/i, /^img$/i, /^photo$/i, /^picture$/i,
  /^banner$/i, /^icon$/i, /^graphic$/i,
  /^thumbnail$/i, /^untitled$/i, /^placeholder$/i,
  /^screenshot$/i, /^hero$/i, /^header image$/i,
  /^default$/i, /^no image$/i, /^test$/i,
];

const MAX_SCREENSHOTS = 5;

// ─── Main Export ────────────────────────────────────────────────────────────

export async function runImagesMediaTests(
  page: Page,
  pageUrl: string,
  _config: ReviewConfig
): Promise<TestIssue[]> {
  const issues: TestIssue[] = [];
  let screenshotCount = 0;

  try {
    // Scroll page to trigger lazy-loaded images, then scroll back
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(1500);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(500);

    // ─── 1. Collect all image data ──────────────────────────────────────────

    const images: ImageInfo[] = await page.evaluate(() => {
      function buildSelector(el: Element, idx: number, tag: string): string {
        if (el.id) return `#${el.id}`;
        if (el.className && typeof el.className === 'string') {
          const cls = el.className.trim().split(/\s+/)[0];
          if (cls) return `${tag}.${CSS.escape(cls)}`;
        }
        return `${tag}:nth-of-type(${idx + 1})`;
      }

      return Array.from(document.querySelectorAll('img'))
        .map((img, idx) => {
          const rect = img.getBoundingClientRect();
          const style = getComputedStyle(img);
          const parent = img.parentElement;
          const parentStyle = parent ? getComputedStyle(parent) : null;
          const parentRect = parent ? parent.getBoundingClientRect() : null;

          return {
            src: (img.src || '').substring(0, 150),
            alt: img.alt || '',
            hasAlt: img.hasAttribute('alt'),
            naturalWidth: img.naturalWidth,
            naturalHeight: img.naturalHeight,
            renderedWidth: rect.width,
            renderedHeight: rect.height,
            objectFit: style.objectFit,
            objectPosition: style.objectPosition,
            parentOverflow: parentStyle?.overflow || '',
            parentWidth: parentRect?.width || 0,
            parentHeight: parentRect?.height || 0,
            isDecorative:
              img.getAttribute('role') === 'presentation' ||
              img.getAttribute('aria-hidden') === 'true' ||
              (img.alt === '' && img.hasAttribute('alt')),
            selector: buildSelector(img, idx, 'img'),
          };
        })
        .filter((img) => {
          // Only check visible, non-data-URI images
          return (
            img.renderedWidth > 0 &&
            img.renderedHeight > 0 &&
            !img.src.startsWith('data:')
          );
        });
    });

    // ─── 2. Check image stretching & pixelation ─────────────────────────────

    for (const img of images) {
      const srcShort = img.src.length > 100 ? img.src.substring(0, 100) + '...' : img.src;

      // Image failed to render (0×0 natural but has src)
      if (img.src && img.naturalWidth === 0 && img.naturalHeight === 0) {
        const issue: TestIssue = {
          severity: 'error',
          message: `Image failed to render (0×0 natural size): ${srcShort}`,
          category: 'images-media',
          pageUrl,
          selector: img.selector,
        };
        if (screenshotCount < MAX_SCREENSHOTS) {
          try {
            const shot = await page.locator(img.selector).first().screenshot({ type: 'jpeg', quality: 60 });
            issue.screenshot = shot.toString('base64');
            screenshotCount++;
          } catch { /* skip */ }
        }
        issues.push(issue);
        continue;
      }

      if (img.naturalWidth === 0 || img.naturalHeight === 0) continue;

      // Significant upscaling → pixelation risk
      const scaleX = img.renderedWidth / img.naturalWidth;
      const scaleY = img.renderedHeight / img.naturalHeight;
      if (scaleX > 1.5 || scaleY > 1.5) {
        const issue: TestIssue = {
          severity: 'warning',
          message: `Image likely pixelated: rendered at ${Math.round(img.renderedWidth)}×${Math.round(img.renderedHeight)} but natural size is ${img.naturalWidth}×${img.naturalHeight}: ${srcShort}`,
          category: 'images-media',
          pageUrl,
          selector: img.selector,
        };
        if (screenshotCount < MAX_SCREENSHOTS) {
          try {
            const shot = await page.locator(img.selector).first().screenshot({ type: 'jpeg', quality: 60 });
            issue.screenshot = shot.toString('base64');
            screenshotCount++;
          } catch { /* skip */ }
        }
        issues.push(issue);
      }

      // Aspect ratio distortion (stretching)
      const naturalAR = img.naturalWidth / img.naturalHeight;
      const renderedAR = img.renderedWidth / img.renderedHeight;
      const arDiff = Math.abs(naturalAR - renderedAR) / naturalAR;

      // Only flag if there's no object-fit that intentionally changes the AR
      if (arDiff > 0.1 && img.objectFit !== 'cover' && img.objectFit !== 'contain' && img.objectFit !== 'scale-down') {
        issues.push({
          severity: 'warning',
          message: `Image appears stretched: aspect ratio changed from ${naturalAR.toFixed(2)} to ${renderedAR.toFixed(2)}: ${srcShort}`,
          category: 'images-media',
          pageUrl,
          selector: img.selector,
        });
      }
    }

    // ─── 3. Check featured image cropping ───────────────────────────────────

    for (const img of images) {
      if (img.naturalWidth === 0 || img.naturalHeight === 0) continue;
      // Only check sizable images (likely hero/featured)
      if (img.renderedWidth < 100 || img.renderedHeight < 100) continue;

      const srcShort = img.src.length > 100 ? img.src.substring(0, 100) + '...' : img.src;
      const naturalAR = img.naturalWidth / img.naturalHeight;
      const containerAR = img.parentWidth / (img.parentHeight || 1);
      const arDiffPct = Math.abs(naturalAR - containerAR) / naturalAR;

      // object-fit:cover with heavy cropping
      if (img.objectFit === 'cover' && arDiffPct > 0.5) {
        issues.push({
          severity: 'warning',
          message: `Image with object-fit:cover may be heavily cropped: natural AR ${naturalAR.toFixed(2)} vs container AR ${containerAR.toFixed(2)}: ${srcShort}`,
          category: 'images-media',
          pageUrl,
          selector: img.selector,
        });
      }

      // object-fit:fill with mismatched AR (the default — causes distortion)
      if (
        (img.objectFit === 'fill' || img.objectFit === '') &&
        img.parentOverflow === 'hidden' &&
        arDiffPct > 0.15
      ) {
        issues.push({
          severity: 'warning',
          message: `Image in clipped container may be distorted (object-fit:fill, AR mismatch ${Math.round(arDiffPct * 100)}%): ${srcShort}`,
          category: 'images-media',
          pageUrl,
          selector: img.selector,
        });
      }
    }

    // ─── 4. Alt text quality analysis ───────────────────────────────────────

    const altTexts: string[] = [];

    for (const img of images) {
      // Skip decorative images and images already handled by broken-links (missing alt)
      if (img.isDecorative || !img.hasAlt) continue;

      const alt = img.alt.trim();
      const srcShort = img.src.length > 100 ? img.src.substring(0, 100) + '...' : img.src;

      if (alt.length > 0) {
        altTexts.push(alt.toLowerCase());
      }

      // Too short alt text
      if (alt.length > 0 && alt.length < 5) {
        issues.push({
          severity: 'warning',
          message: `Image alt text too short (${alt.length} chars): "${alt}" on ${srcShort}`,
          category: 'images-media',
          pageUrl,
        });
        continue;
      }

      // Generic/meaningless alt text
      if (GENERIC_ALT_PATTERNS.some((pattern) => pattern.test(alt))) {
        issues.push({
          severity: 'warning',
          message: `Image has generic alt text: "${alt}" — should be descriptive: ${srcShort}`,
          category: 'images-media',
          pageUrl,
        });
        continue;
      }

      // Filename-like alt text
      if (
        /\.(jpg|jpeg|png|gif|svg|webp|bmp|ico|avif)/i.test(alt) ||
        (alt.includes('_') && !alt.includes(' ') && alt.length > 3) ||
        (alt.includes('-') && !alt.includes(' ') && /^[a-z0-9_-]+$/i.test(alt) && alt.length > 5)
      ) {
        issues.push({
          severity: 'warning',
          message: `Image alt text appears to be a filename: "${alt}": ${srcShort}`,
          category: 'images-media',
          pageUrl,
        });
      }
    }

    // Check for duplicate alt text
    const altCounts: Record<string, number> = {};
    for (const alt of altTexts) {
      if (alt.length >= 3) {
        altCounts[alt] = (altCounts[alt] || 0) + 1;
      }
    }
    for (const [alt, count] of Object.entries(altCounts)) {
      if (count >= 3 && alt !== 'logo') {
        issues.push({
          severity: 'info',
          message: `Duplicate alt text "${alt}" used on ${count} images`,
          category: 'images-media',
          pageUrl,
        });
      }
    }

    // ─── 5. Video checks ────────────────────────────────────────────────────

    const videos: VideoInfo[] = await page.evaluate(() => {
      function buildSelector(el: Element, idx: number, tag: string): string {
        if (el.id) return `#${el.id}`;
        if (el.className && typeof el.className === 'string') {
          const cls = el.className.trim().split(/\s+/)[0];
          if (cls) return `${tag}.${CSS.escape(cls)}`;
        }
        return `${tag}:nth-of-type(${idx + 1})`;
      }

      const results: VideoInfo[] = [];

      // <video> elements
      document.querySelectorAll('video').forEach((video, idx) => {
        const sources = Array.from(video.querySelectorAll('source'));
        const src = video.src || (sources.length > 0 ? sources[0].src : '');
        results.push({
          type: 'video',
          src: (src || '').substring(0, 150),
          hasSrc: !!(video.src || sources.length > 0),
          readyState: video.readyState,
          networkState: video.networkState,
          errorCode: video.error ? video.error.code : null,
          width: video.getBoundingClientRect().width,
          height: video.getBoundingClientRect().height,
          selector: buildSelector(video, idx, 'video'),
        });
      });

      // <iframe> video embeds (YouTube, Vimeo, etc.)
      document.querySelectorAll('iframe').forEach((iframe, idx) => {
        const src = iframe.src || '';
        const isVideo = /youtube|vimeo|dailymotion|wistia|loom|vidyard|player/i.test(src);
        if (isVideo) {
          results.push({
            type: 'iframe-video',
            src: src.substring(0, 150),
            hasSrc: !!src,
            errorCode: null,
            width: iframe.getBoundingClientRect().width,
            height: iframe.getBoundingClientRect().height,
            selector: buildSelector(iframe, idx, 'iframe'),
          });
        }
      });

      return results;
    });

    for (const video of videos) {
      const srcShort = video.src.length > 100 ? video.src.substring(0, 100) + '...' : video.src;

      // No source
      if (!video.hasSrc) {
        issues.push({
          severity: 'error',
          message: `Video element has no source URL`,
          category: 'images-media',
          pageUrl,
          selector: video.selector,
        });
        continue;
      }

      // Load error (native <video> only)
      if (video.type === 'video' && video.errorCode !== null) {
        const errorNames: Record<number, string> = {
          1: 'MEDIA_ERR_ABORTED',
          2: 'MEDIA_ERR_NETWORK',
          3: 'MEDIA_ERR_DECODE',
          4: 'MEDIA_ERR_SRC_NOT_SUPPORTED',
        };
        const errName = errorNames[video.errorCode] || `code ${video.errorCode}`;
        const issue: TestIssue = {
          severity: 'error',
          message: `Video failed to load (${errName}): ${srcShort}`,
          category: 'images-media',
          pageUrl,
          selector: video.selector,
        };
        if (screenshotCount < MAX_SCREENSHOTS) {
          try {
            const shot = await page.locator(video.selector).first().screenshot({ type: 'jpeg', quality: 60 });
            issue.screenshot = shot.toString('base64');
            screenshotCount++;
          } catch { /* skip */ }
        }
        issues.push(issue);
        continue;
      }

      // NETWORK_NO_SOURCE
      if (video.type === 'video' && video.networkState === 3) {
        issues.push({
          severity: 'error',
          message: `Video source not found: ${srcShort}`,
          category: 'images-media',
          pageUrl,
          selector: video.selector,
        });
        continue;
      }

      // Tiny/collapsed video
      if (video.width < 10 || video.height < 10) {
        issues.push({
          severity: 'warning',
          message: `Video has zero/tiny dimensions (${Math.round(video.width)}×${Math.round(video.height)}): ${srcShort}`,
          category: 'images-media',
          pageUrl,
          selector: video.selector,
        });
      }
    }

    // ─── 6. Slider / Carousel checks ────────────────────────────────────────

    const sliders: SliderInfo[] = await page.evaluate(() => {
      const detectors = [
        { name: 'Swiper', selector: '.swiper, .swiper-container, [data-swiper]', slideSelector: '.swiper-slide', navSelector: '.swiper-button-next, .swiper-button-prev, .swiper-pagination' },
        { name: 'Slick', selector: '.slick-slider, .slick-carousel', slideSelector: '.slick-slide', navSelector: '.slick-arrow, .slick-dots' },
        { name: 'Owl Carousel', selector: '.owl-carousel, .owl-stage-outer', slideSelector: '.owl-item', navSelector: '.owl-nav, .owl-dots' },
        { name: 'Flickity', selector: '.flickity-enabled, .flickity-slider', slideSelector: '.flickity-cell', navSelector: '.flickity-prev-next-button, .flickity-page-dots' },
        { name: 'Splide', selector: '.splide, [data-splide]', slideSelector: '.splide__slide', navSelector: '.splide__arrow, .splide__pagination' },
        { name: 'Glide', selector: '.glide, [data-glide-el]', slideSelector: '.glide__slide', navSelector: '.glide__arrow, .glide__bullets' },
        { name: 'Embla', selector: '.embla, [data-embla]', slideSelector: '.embla__slide', navSelector: '' },
      ];

      const results: SliderInfo[] = [];

      for (const det of detectors) {
        const containers = document.querySelectorAll(det.selector);
        containers.forEach((container) => {
          const slides = container.querySelectorAll(det.slideSelector);
          const nav = det.navSelector ? container.querySelectorAll(det.navSelector) : new NodeList();
          const rect = container.getBoundingClientRect();
          results.push({
            library: det.name,
            slideCount: slides.length,
            hasNav: nav.length > 0,
            width: rect.width,
            height: rect.height,
            isVisible: rect.width > 0 && rect.height > 0,
          });
        });
      }

      return results;
    });

    for (const slider of sliders) {
      if (slider.slideCount === 0) {
        issues.push({
          severity: 'error',
          message: `${slider.library} slider found but contains no slides — may not have initialized`,
          category: 'images-media',
          pageUrl,
        });
      } else if (!slider.isVisible) {
        issues.push({
          severity: 'warning',
          message: `${slider.library} slider has zero dimensions — may be collapsed or hidden`,
          category: 'images-media',
          pageUrl,
        });
      } else if (slider.slideCount === 1) {
        issues.push({
          severity: 'info',
          message: `${slider.library} slider has only 1 slide — carousel may be unnecessary`,
          category: 'images-media',
          pageUrl,
        });
      }

      if (slider.slideCount > 1 && !slider.hasNav && slider.isVisible) {
        issues.push({
          severity: 'info',
          message: `${slider.library} slider has ${slider.slideCount} slides but no visible navigation controls`,
          category: 'images-media',
          pageUrl,
        });
      }
    }

    // ─── 7. Summary ─────────────────────────────────────────────────────────

    const problemCount = issues.filter((i) => i.severity !== 'info').length;
    if (problemCount === 0) {
      issues.push({
        severity: 'info',
        message: `All images and media appear healthy (${images.length} images, ${videos.length} videos, ${sliders.length} sliders checked)`,
        category: 'images-media',
        pageUrl,
      });
    }
  } catch (error) {
    issues.push({
      severity: 'warning',
      message: `Images & Media test error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      category: 'images-media',
      pageUrl,
    });
  }

  return issues;
}
