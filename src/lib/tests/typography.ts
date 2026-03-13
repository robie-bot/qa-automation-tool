import { Page } from 'playwright-core';
import { TestIssue, ReviewConfig } from '@/types';
import { safeElementScreenshot } from './screenshot-utils';

// ─── Color / Contrast Utilities ─────────────────────────────────────────────

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

// ─── Common Misspellings Dictionary ─────────────────────────────────────────
// Maps misspelled word → correct spelling. Curated for web content to avoid
// false positives with brand/tech terms.

const COMMON_MISSPELLINGS: Record<string, string> = {
  'accomodate': 'accommodate',
  'acheive': 'achieve',
  'accross': 'across',
  'agressive': 'aggressive',
  'apparantly': 'apparently',
  'apperance': 'appearance',
  'arguement': 'argument',
  'assasination': 'assassination',
  'basicly': 'basically',
  'becuase': 'because',
  'begining': 'beginning',
  'beleive': 'believe',
  'buisness': 'business',
  'calender': 'calendar',
  'catagory': 'category',
  'cemetary': 'cemetery',
  'changeable': 'changeable',
  'collegue': 'colleague',
  'comming': 'coming',
  'commited': 'committed',
  'commitee': 'committee',
  'completly': 'completely',
  'concious': 'conscious',
  'curiousity': 'curiosity',
  'definately': 'definitely',
  'definatly': 'definitely',
  'definate': 'definite',
  'desparate': 'desperate',
  'develope': 'develop',
  'diffrence': 'difference',
  'dilema': 'dilemma',
  'disapear': 'disappear',
  'dissapoint': 'disappoint',
  'embarass': 'embarrass',
  'enviroment': 'environment',
  'enviromental': 'environmental',
  'essencial': 'essential',
  'exaggerrate': 'exaggerate',
  'excellant': 'excellent',
  'exersice': 'exercise',
  'existance': 'existence',
  'experiance': 'experience',
  'facinate': 'fascinate',
  'familar': 'familiar',
  'finaly': 'finally',
  'florescent': 'fluorescent',
  'foriegn': 'foreign',
  'fourty': 'forty',
  'freind': 'friend',
  'fulfil': 'fulfill',
  'goverment': 'government',
  'grammer': 'grammar',
  'gaurd': 'guard',
  'guidence': 'guidance',
  'happend': 'happened',
  'harrass': 'harass',
  'heighth': 'height',
  'heirarchy': 'hierarchy',
  'humourous': 'humorous',
  'hygeine': 'hygiene',
  'ignorence': 'ignorance',
  'immediatly': 'immediately',
  'incidently': 'incidentally',
  'independant': 'independent',
  'indispensible': 'indispensable',
  'innoculate': 'inoculate',
  'intelligance': 'intelligence',
  'intresting': 'interesting',
  'irresistable': 'irresistible',
  'jewellry': 'jewelry',
  'judgement': 'judgment',
  'knowlege': 'knowledge',
  'labelling': 'labeling',
  'lenght': 'length',
  'liase': 'liaise',
  'libary': 'library',
  'lisence': 'license',
  'maintainance': 'maintenance',
  'managment': 'management',
  'medival': 'medieval',
  'millenium': 'millennium',
  'minature': 'miniature',
  'mischevious': 'mischievous',
  'mispell': 'misspell',
  'necesary': 'necessary',
  'neccessary': 'necessary',
  'neigbour': 'neighbor',
  'noticable': 'noticeable',
  'occassion': 'occasion',
  'occassionally': 'occasionally',
  'occured': 'occurred',
  'occurence': 'occurrence',
  'occuring': 'occurring',
  'offically': 'officially',
  'oportunity': 'opportunity',
  'oppurtunity': 'opportunity',
  'orignal': 'original',
  'outragous': 'outrageous',
  'parliment': 'parliament',
  'particulary': 'particularly',
  'passtime': 'pastime',
  'persistant': 'persistent',
  'personaly': 'personally',
  'persue': 'pursue',
  'plagerism': 'plagiarism',
  'posession': 'possession',
  'potatos': 'potatoes',
  'practise': 'practice',
  'preceed': 'precede',
  'prefered': 'preferred',
  'predjudice': 'prejudice',
  'presance': 'presence',
  'privelege': 'privilege',
  'probaly': 'probably',
  'profesional': 'professional',
  'proffesional': 'professional',
  'progam': 'program',
  'pronounciation': 'pronunciation',
  'publically': 'publicly',
  'realy': 'really',
  'recieve': 'receive',
  'reciept': 'receipt',
  'recomend': 'recommend',
  'recommand': 'recommend',
  'refered': 'referred',
  'referance': 'reference',
  'relevent': 'relevant',
  'religous': 'religious',
  'remeber': 'remember',
  'repitition': 'repetition',
  'resistence': 'resistance',
  'restarant': 'restaurant',
  'rythm': 'rhythm',
  'scedule': 'schedule',
  'seperate': 'separate',
  'seige': 'siege',
  'sentance': 'sentence',
  'sergant': 'sergeant',
  'sincerly': 'sincerely',
  'speach': 'speech',
  'strenght': 'strength',
  'succesful': 'successful',
  'successfull': 'successful',
  'supercede': 'supersede',
  'suprize': 'surprise',
  'surelly': 'surely',
  'tendancy': 'tendency',
  'therefor': 'therefore',
  'threshhold': 'threshold',
  'tommorow': 'tomorrow',
  'tommorrow': 'tomorrow',
  'tounge': 'tongue',
  'truely': 'truly',
  'tyrany': 'tyranny',
  'underate': 'underrate',
  'unfortunatly': 'unfortunately',
  'untill': 'until',
  'unusuall': 'unusual',
  'usefull': 'useful',
  'vaccum': 'vacuum',
  'vegeterian': 'vegetarian',
  'vehical': 'vehicle',
  'visious': 'vicious',
  'wether': 'whether',
  'wierd': 'weird',
  'wellcome': 'welcome',
  'wich': 'which',
  'writting': 'writing',
  'writeing': 'writing',
  'yeild': 'yield',
  // Common web copy misspellings
  'availible': 'available',
  'benifits': 'benefits',
  'cancellation': 'cancellation',
  'compatability': 'compatibility',
  'configuraton': 'configuration',
  'connecton': 'connection',
  'custumer': 'customer',
  'discription': 'description',
  'documentaion': 'documentation',
  'downlod': 'download',
  'effeciency': 'efficiency',
  'functionaliy': 'functionality',
  'garantee': 'guarantee',
  'gaurantee': 'guarantee',
  'implmentation': 'implementation',
  'infomation': 'information',
  'informaton': 'information',
  'intergration': 'integration',
  'navagation': 'navigation',
  'notifcation': 'notification',
  'optimze': 'optimize',
  'perfomance': 'performance',
  'permision': 'permission',
  'platfrom': 'platform',
  'registraion': 'registration',
  'responce': 'response',
  'satisifed': 'satisfied',
  'securty': 'security',
  'subscribtion': 'subscription',
  'susbcribe': 'subscribe',
  'techincal': 'technical',
  'technolgy': 'technology',
  'upgarde': 'upgrade',
  'waranty': 'warranty',
};

// ─── Cross-Page Consistency Types ────────────────────────────────────────────

export interface TypographyFingerprint {
  pageUrl: string;
  headingStyles: {
    tag: string;
    avgFontSize: number;
    fontFamily: string;
    fontWeight: string;
    count: number;
  }[];
  bodyStyle: {
    avgFontSize: number;
    fontFamily: string;
    avgLineHeightRatio: number;
    sampleCount: number;
  } | null;
  fontFamiliesUsed: string[];
}

/**
 * Compare typography fingerprints across multiple pages and produce
 * cross-page consistency issues.
 */
export function compareTypographyAcrossPages(
  fingerprints: TypographyFingerprint[]
): TestIssue[] {
  if (fingerprints.length < 2) return [];

  const issues: TestIssue[] = [];

  // ── 1. Body font family consistency ──────────────────────────────────
  const bodyFamilies = fingerprints
    .filter((f) => f.bodyStyle)
    .map((f) => ({ pageUrl: f.pageUrl, family: normalizeFontFamily(f.bodyStyle!.fontFamily) }));

  if (bodyFamilies.length >= 2) {
    const uniqueFamilies = [...new Set(bodyFamilies.map((b) => b.family))];
    if (uniqueFamilies.length > 1) {
      const details = bodyFamilies
        .map((b) => `${b.pageUrl} → ${b.family}`)
        .join('; ');
      issues.push({
        severity: 'warning',
        message: `Inconsistent body font-family across pages: ${uniqueFamilies.join(' vs ')}. Details: ${details}`,
        category: 'typography',
        pageUrl: '(cross-page)',
      });
    }
  }

  // ── 2. Body font size consistency ────────────────────────────────────
  const bodySizes = fingerprints
    .filter((f) => f.bodyStyle)
    .map((f) => ({ pageUrl: f.pageUrl, size: f.bodyStyle!.avgFontSize }));

  if (bodySizes.length >= 2) {
    const min = Math.min(...bodySizes.map((b) => b.size));
    const max = Math.max(...bodySizes.map((b) => b.size));
    if (max - min > 2) {
      const details = bodySizes
        .map((b) => `${b.pageUrl} → ${b.size.toFixed(1)}px`)
        .join('; ');
      issues.push({
        severity: 'warning',
        message: `Body text font-size varies by ${(max - min).toFixed(1)}px across pages (${min.toFixed(1)}px – ${max.toFixed(1)}px). Details: ${details}`,
        category: 'typography',
        pageUrl: '(cross-page)',
      });
    }
  }

  // ── 3. Body line-height ratio consistency ────────────────────────────
  const bodyRatios = fingerprints
    .filter((f) => f.bodyStyle)
    .map((f) => ({ pageUrl: f.pageUrl, ratio: f.bodyStyle!.avgLineHeightRatio }));

  if (bodyRatios.length >= 2) {
    const min = Math.min(...bodyRatios.map((b) => b.ratio));
    const max = Math.max(...bodyRatios.map((b) => b.ratio));
    if (max - min > 0.3) {
      const details = bodyRatios
        .map((b) => `${b.pageUrl} → ${b.ratio.toFixed(2)}`)
        .join('; ');
      issues.push({
        severity: 'info',
        message: `Body line-height ratio varies across pages (${min.toFixed(2)} – ${max.toFixed(2)}). Details: ${details}`,
        category: 'typography',
        pageUrl: '(cross-page)',
      });
    }
  }

  // ── 4. Heading font-family consistency per level ─────────────────────
  const headingLevels = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'];
  for (const tag of headingLevels) {
    const entries = fingerprints
      .map((f) => {
        const h = f.headingStyles.find((s) => s.tag === tag);
        return h ? { pageUrl: f.pageUrl, family: normalizeFontFamily(h.fontFamily), size: h.avgFontSize } : null;
      })
      .filter((e): e is { pageUrl: string; family: string; size: number } => e !== null);

    if (entries.length < 2) continue;

    // Font family mismatch
    const uniqueFamilies = [...new Set(entries.map((e) => e.family))];
    if (uniqueFamilies.length > 1) {
      const details = entries.map((e) => `${e.pageUrl} → ${e.family}`).join('; ');
      issues.push({
        severity: 'warning',
        message: `${tag} font-family inconsistency across pages: ${uniqueFamilies.join(' vs ')}. Details: ${details}`,
        category: 'typography',
        pageUrl: '(cross-page)',
      });
    }

    // Font size mismatch (>2px difference)
    const min = Math.min(...entries.map((e) => e.size));
    const max = Math.max(...entries.map((e) => e.size));
    if (max - min > 2) {
      const details = entries.map((e) => `${e.pageUrl} → ${e.size.toFixed(1)}px`).join('; ');
      issues.push({
        severity: 'warning',
        message: `${tag} font-size varies by ${(max - min).toFixed(1)}px across pages (${min.toFixed(1)}px – ${max.toFixed(1)}px). Details: ${details}`,
        category: 'typography',
        pageUrl: '(cross-page)',
      });
    }
  }

  // ── 5. Overall font-family count ─────────────────────────────────────
  const allFamilies = new Set<string>();
  for (const f of fingerprints) {
    for (const fam of f.fontFamiliesUsed) {
      allFamilies.add(normalizeFontFamily(fam));
    }
  }
  if (allFamilies.size > 4) {
    issues.push({
      severity: 'info',
      message: `${allFamilies.size} different font families detected across all pages: ${[...allFamilies].join(', ')}. Consider consolidating for consistency.`,
      category: 'typography',
      pageUrl: '(cross-page)',
    });
  }

  return issues;
}

/**
 * Normalize font family string for comparison.
 * Extracts the primary font (first in the stack) and lowercases it.
 */
function normalizeFontFamily(family: string): string {
  const first = family.split(',')[0].trim().replace(/["']/g, '').toLowerCase();
  return first || family.toLowerCase();
}

// ─── Main Export ────────────────────────────────────────────────────────────

const MAX_SCREENSHOTS = 10;

export async function runTypographyTests(
  page: Page,
  pageUrl: string,
  config: ReviewConfig
): Promise<{ issues: TestIssue[]; fingerprint: TypographyFingerprint }> {
  const issues: TestIssue[] = [];
  const typoConfig = config.typography;
  let screenshotCount = 0;
  let fingerprint: TypographyFingerprint = {
    pageUrl,
    headingStyles: [],
    bodyStyle: null,
    fontFamiliesUsed: [],
  };

  // Helper to capture an element screenshot by CSS selector
  async function captureElementScreenshot(selector: string): Promise<string | undefined> {
    if (screenshotCount >= MAX_SCREENSHOTS) return undefined;
    const result = await safeElementScreenshot(page.locator(selector).first(), { quality: 60 });
    if (result) screenshotCount++;
    return result;
  }

  try {
    // Set a standard viewport for typography tests
    await page.setViewportSize({ width: 1440, height: 900 });

    // ─── Collect text data from the page ────────────────────────────────

    // Tag elements with unique data attributes for reliable screenshot targeting
    const textData = await page.evaluate(() => {
      const headings: {
        tag: string;
        level: number;
        text: string;
        fontSize: number;
        lineHeight: number;
        fontFamily: string;
        color: string;
        bgColor: string;
        selector: string;
        domIndex: number;
      }[] = [];

      const bodyTexts: {
        text: string;
        fontSize: number;
        lineHeight: number;
        fontFamily: string;
        color: string;
        bgColor: string;
        wordSpacing: number;
        letterSpacing: number;
        selector: string;
      }[] = [];

      // Collect headings with DOM order
      let headingDomIndex = 0;
      const allHeadings = document.querySelectorAll('h1, h2, h3, h4, h5, h6');
      allHeadings.forEach((el) => {
        const style = getComputedStyle(el);
        const rect = el.getBoundingClientRect();
        if (rect.width === 0 || style.display === 'none') return;

        const tag = el.tagName.toLowerCase();
        const level = parseInt(tag.charAt(1));

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

        // Tag with unique attribute for screenshot targeting
        const qaId = `qa-typo-h-${headingDomIndex}`;
        el.setAttribute('data-qa-typo', qaId);

        headings.push({
          tag,
          level,
          text: (el.textContent || '').trim().substring(0, 80),
          fontSize: parseFloat(style.fontSize),
          lineHeight: parseFloat(style.lineHeight) || parseFloat(style.fontSize) * 1.2,
          fontFamily: style.fontFamily,
          color: style.color,
          bgColor,
          selector: `[data-qa-typo="${qaId}"]`,
          domIndex: headingDomIndex,
        });
        headingDomIndex++;
      });

      // Collect body text (paragraphs and list items)
      let bodyDomIndex = 0;
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

        // Tag with unique attribute for screenshot targeting
        const qaId = `qa-typo-b-${bodyDomIndex}`;
        el.setAttribute('data-qa-typo', qaId);

        bodyTexts.push({
          text: text.substring(0, 200),
          fontSize: parseFloat(style.fontSize),
          lineHeight: parseFloat(style.lineHeight) || parseFloat(style.fontSize) * 1.2,
          fontFamily: style.fontFamily,
          color: style.color,
          bgColor,
          wordSpacing: parseFloat(style.wordSpacing) || 0,
          letterSpacing: parseFloat(style.letterSpacing) || 0,
          selector: `[data-qa-typo="${qaId}"]`,
        });

        bodyDomIndex++;
        if (bodyTexts.length > 30) return;
      });

      // Collect all visible text for spelling checks
      const visibleText = document.body.innerText || '';

      return { headings, bodyTexts, visibleText };
    });

    // ═══════════════════════════════════════════════════════════════════════
    // 1. HEADING HIERARCHY CHECKER (enhanced)
    // ═══════════════════════════════════════════════════════════════════════

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

    // Check for skipped heading levels (e.g., h1 → h3 without h2)
    if (textData.headings.length > 0) {
      const usedLevels = new Set(textData.headings.map((h) => h.level));
      const minLevel = Math.min(...usedLevels);
      const maxLevel = Math.max(...usedLevels);

      for (let lvl = minLevel + 1; lvl < maxLevel; lvl++) {
        if (!usedLevels.has(lvl)) {
          issues.push({
            severity: 'warning',
            message: `Heading level h${lvl} is skipped — page jumps from h${lvl - 1} to h${lvl + 1}. This breaks accessibility hierarchy.`,
            category: 'typography',
            pageUrl,
          });
        }
      }

      // Check for heading levels going backwards in DOM order
      // (e.g., an h3 appearing before any h2)
      let lastLevel = 0;
      for (const h of textData.headings) {
        if (h.level > lastLevel + 1 && lastLevel > 0) {
          const screenshot = await captureElementScreenshot(h.selector);
          issues.push({
            severity: 'warning',
            message: `Heading order issue: "${h.text}" (${h.tag}) appears after h${lastLevel} — skips to h${h.level} in document flow`,
            category: 'typography',
            pageUrl,
            selector: h.selector,
            screenshot,
          });
        }
        lastLevel = h.level;
      }
    }

    // Check heading sizes — ensure visual hierarchy matches semantic hierarchy
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
            message: `Visual hierarchy mismatch: ${headingOrder[i + 1]} (${avgNext.toFixed(0)}px) is not visually smaller than ${headingOrder[i]} (${avgCurrent.toFixed(0)}px)`,
            category: 'typography',
            pageUrl,
          });
        }
      }
    }

    // Check heading sizes against config minimums
    const minSizes: Record<string, number> = {
      h1: typoConfig.h1MinSize,
      h2: typoConfig.h2MinSize,
      h3: typoConfig.h3MinSize,
    };

    for (const h of textData.headings) {
      const minSize = minSizes[h.tag];
      if (minSize && h.fontSize < minSize) {
        const screenshot = await captureElementScreenshot(h.selector);
        issues.push({
          severity: 'warning',
          message: `${h.tag} font size (${h.fontSize}px) is below minimum (${minSize}px): "${h.text}"`,
          selector: h.selector,
          screenshot,
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

    // ═══════════════════════════════════════════════════════════════════════
    // 2. BODY TEXT SIZE & LINE HEIGHT
    // ═══════════════════════════════════════════════════════════════════════

    for (const t of textData.bodyTexts) {
      if (t.fontSize < typoConfig.bodyMinSize) {
        const screenshot = await captureElementScreenshot(t.selector);
        issues.push({
          severity: 'warning',
          message: `Body text font size (${t.fontSize}px) is below minimum (${typoConfig.bodyMinSize}px): "${t.text.substring(0, 40)}..."`,
          selector: t.selector,
          screenshot,
          category: 'typography',
          pageUrl,
        });
      }

      // Check line height ratio
      const ratio = t.lineHeight / t.fontSize;
      if (ratio < typoConfig.minLineHeightRatio) {
        const screenshot = await captureElementScreenshot(t.selector);
        issues.push({
          severity: 'info',
          message: `Line height ratio (${ratio.toFixed(2)}) is below recommended (${typoConfig.minLineHeightRatio}): "${t.text.substring(0, 40)}..."`,
          selector: t.selector,
          screenshot,
          category: 'typography',
          pageUrl,
        });
      }
    }

    // ═══════════════════════════════════════════════════════════════════════
    // 3. TEXT CONTRAST (WCAG AA)
    // ═══════════════════════════════════════════════════════════════════════

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
          const screenshot = await captureElementScreenshot(t.selector);
          issues.push({
            severity: 'error',
            message: `Low text contrast ratio (${ratio.toFixed(2)}:1, minimum ${minRatio}:1) for text "${text.substring(0, 40)}..." — color: ${t.color} on ${t.bgColor}`,
            selector: t.selector,
            screenshot,
            category: 'typography',
            pageUrl,
          });
        }
      }
    }

    // ═══════════════════════════════════════════════════════════════════════
    // 4. WORD & LETTER SPACING CHECKS
    // ═══════════════════════════════════════════════════════════════════════

    for (const t of textData.bodyTexts) {
      // Excessive word spacing (> 8px is unusual)
      if (t.wordSpacing > 8) {
        const screenshot = await captureElementScreenshot(t.selector);
        issues.push({
          severity: 'warning',
          message: `Excessive word-spacing (${t.wordSpacing.toFixed(1)}px) detected: "${t.text.substring(0, 40)}..."`,
          selector: t.selector,
          screenshot,
          category: 'typography',
          pageUrl,
        });
      }

      // Negative word spacing (compresses words together)
      if (t.wordSpacing < -1) {
        const screenshot = await captureElementScreenshot(t.selector);
        issues.push({
          severity: 'warning',
          message: `Negative word-spacing (${t.wordSpacing.toFixed(1)}px) — words may overlap: "${t.text.substring(0, 40)}..."`,
          selector: t.selector,
          screenshot,
          category: 'typography',
          pageUrl,
        });
      }

      // Excessive letter spacing (> 5px is usually a problem)
      if (t.letterSpacing > 5) {
        const screenshot = await captureElementScreenshot(t.selector);
        issues.push({
          severity: 'info',
          message: `High letter-spacing (${t.letterSpacing.toFixed(1)}px) detected: "${t.text.substring(0, 40)}..."`,
          selector: t.selector,
          screenshot,
          category: 'typography',
          pageUrl,
        });
      }

      // Negative letter spacing (compresses letters)
      if (t.letterSpacing < -1) {
        const screenshot = await captureElementScreenshot(t.selector);
        issues.push({
          severity: 'warning',
          message: `Negative letter-spacing (${t.letterSpacing.toFixed(1)}px) — characters may overlap: "${t.text.substring(0, 40)}..."`,
          selector: t.selector,
          screenshot,
          category: 'typography',
          pageUrl,
        });
      }
    }

    // Check for double/triple spaces in visible text content
    const spacingIssueTexts = textData.bodyTexts.filter((t) => /\s{3,}/.test(t.text));
    for (const t of spacingIssueTexts.slice(0, 5)) {
      const screenshot = await captureElementScreenshot(t.selector);
      issues.push({
        severity: 'warning',
        message: `Excessive whitespace found in text: "${t.text.substring(0, 60)}..."`,
        selector: t.selector,
        screenshot,
        category: 'typography',
        pageUrl,
      });
    }

    // Also check heading text for spacing issues
    for (const h of textData.headings) {
      if (/\s{3,}/.test(h.text)) {
        const screenshot = await captureElementScreenshot(h.selector);
        issues.push({
          severity: 'warning',
          message: `Excessive whitespace in ${h.tag}: "${h.text}"`,
          category: 'typography',
          pageUrl,
          selector: h.selector,
          screenshot,
        });
      }
    }

    // ═══════════════════════════════════════════════════════════════════════
    // 5. SPELLING CHECKER
    // ═══════════════════════════════════════════════════════════════════════

    // Extract words from visible text
    const visibleText = textData.visibleText;
    if (visibleText && visibleText.length > 0) {
      // Split into words — only check alphabetic words ≥ 4 chars
      const words = visibleText
        .split(/[\s\n\r\t,.;:!?()[\]{}"'\/\\<>|@#$%^&*+=~`—–]+/)
        .map((w) => w.trim().toLowerCase())
        .filter((w) => /^[a-z]{4,}$/.test(w));

      // Deduplicate
      const uniqueWords = [...new Set(words)];
      const misspelledFound: { wrong: string; correct: string }[] = [];

      for (const word of uniqueWords) {
        if (COMMON_MISSPELLINGS[word]) {
          misspelledFound.push({
            wrong: word,
            correct: COMMON_MISSPELLINGS[word],
          });
        }
      }

      // Report misspellings (limit to 15 to avoid noise)
      for (const item of misspelledFound.slice(0, 15)) {
        issues.push({
          severity: 'warning',
          message: `Possible misspelling: "${item.wrong}" — did you mean "${item.correct}"?`,
          category: 'typography',
          pageUrl,
        });
      }

      // Check for common text quality issues in body content
      // Missing space after punctuation
      const missingSpaceAfterPunct = visibleText.match(/[.!?,;:][A-Z][a-z]/g);
      if (missingSpaceAfterPunct && missingSpaceAfterPunct.length > 0) {
        const examples = missingSpaceAfterPunct.slice(0, 3).join(', ');
        issues.push({
          severity: 'warning',
          message: `Missing space after punctuation found (${missingSpaceAfterPunct.length} instances): ${examples}`,
          category: 'typography',
          pageUrl,
        });
      }

      // Double spaces in text
      const doubleSpaces = visibleText.match(/[^\s] {2}[^\s]/g);
      if (doubleSpaces && doubleSpaces.length >= 3) {
        issues.push({
          severity: 'info',
          message: `Double spaces detected in text (${doubleSpaces.length} instances) — consider using single spaces`,
          category: 'typography',
          pageUrl,
        });
      }

      // Space before punctuation
      const spaceBeforePunct = visibleText.match(/\w\s+[.,;:!?]/g);
      if (spaceBeforePunct && spaceBeforePunct.length >= 3) {
        const examples = spaceBeforePunct.slice(0, 3).map((s) => `"${s.trim()}"`).join(', ');
        issues.push({
          severity: 'info',
          message: `Space before punctuation found (${spaceBeforePunct.length} instances): ${examples}`,
          category: 'typography',
          pageUrl,
        });
      }
    }
    // ═══════════════════════════════════════════════════════════════════════
    // BUILD FINGERPRINT for cross-page comparison
    // ═══════════════════════════════════════════════════════════════════════

    const headingStyleMap: Record<string, { sizes: number[]; families: string[]; weights: string[] }> = {};
    for (const h of textData.headings) {
      if (!headingStyleMap[h.tag]) headingStyleMap[h.tag] = { sizes: [], families: [], weights: [] };
      headingStyleMap[h.tag].sizes.push(h.fontSize);
      headingStyleMap[h.tag].families.push(h.fontFamily);
      // fontWeight is not currently collected — we'll use fontFamily as proxy
      headingStyleMap[h.tag].weights.push('');
    }

    const headingStyles = Object.entries(headingStyleMap).map(([tag, data]) => ({
      tag,
      avgFontSize: data.sizes.reduce((a, b) => a + b, 0) / data.sizes.length,
      fontFamily: mostCommon(data.families),
      fontWeight: mostCommon(data.weights),
      count: data.sizes.length,
    }));

    let bodyStyle: TypographyFingerprint['bodyStyle'] = null;
    if (textData.bodyTexts.length > 0) {
      const sizes = textData.bodyTexts.map((t) => t.fontSize);
      const families = textData.bodyTexts.map((t) => t.fontFamily);
      const ratios = textData.bodyTexts.map((t) => t.lineHeight / t.fontSize);
      bodyStyle = {
        avgFontSize: sizes.reduce((a, b) => a + b, 0) / sizes.length,
        fontFamily: mostCommon(families.filter(Boolean)) || 'unknown',
        avgLineHeightRatio: ratios.reduce((a, b) => a + b, 0) / ratios.length,
        sampleCount: textData.bodyTexts.length,
      };
    }

    const allFamilies = [
      ...textData.headings.map((h) => h.fontFamily),
      ...textData.bodyTexts.map((t) => t.fontFamily),
    ];
    const fontFamiliesUsed = [...new Set(allFamilies.map((f) => f.split(',')[0].trim().replace(/["']/g, '')))].filter(Boolean);

    fingerprint = {
      pageUrl,
      headingStyles,
      bodyStyle,
      fontFamiliesUsed,
    };
  } catch (error) {
    issues.push({
      severity: 'warning',
      message: `Typography test error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      category: 'typography',
      pageUrl,
    });
  }

  return { issues, fingerprint };
}

/** Return the most common string in an array */
function mostCommon(arr: string[]): string {
  if (arr.length === 0) return '';
  const counts: Record<string, number> = {};
  for (const s of arr) counts[s] = (counts[s] || 0) + 1;
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
}
