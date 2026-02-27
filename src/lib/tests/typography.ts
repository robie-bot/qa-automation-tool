import { Page } from 'playwright-core';
import { TestIssue, ReviewConfig } from '@/types';

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

// ─── Main Export ────────────────────────────────────────────────────────────

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

    // ─── Collect text data from the page ────────────────────────────────

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

        headings.push({
          tag,
          level,
          text: (el.textContent || '').trim().substring(0, 80),
          fontSize: parseFloat(style.fontSize),
          lineHeight: parseFloat(style.lineHeight) || parseFloat(style.fontSize) * 1.2,
          fontFamily: style.fontFamily,
          color: style.color,
          bgColor,
          selector: `${tag}:nth-of-type(${headingDomIndex + 1})`,
          domIndex: headingDomIndex,
        });
        headingDomIndex++;
      });

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
          text: text.substring(0, 200),
          fontSize: parseFloat(style.fontSize),
          lineHeight: parseFloat(style.lineHeight) || parseFloat(style.fontSize) * 1.2,
          color: style.color,
          bgColor,
          wordSpacing: parseFloat(style.wordSpacing) || 0,
          letterSpacing: parseFloat(style.letterSpacing) || 0,
          selector: el.tagName.toLowerCase(),
        });

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
          issues.push({
            severity: 'warning',
            message: `Heading order issue: "${h.text}" (${h.tag}) appears after h${lastLevel} — skips to h${h.level} in document flow`,
            category: 'typography',
            pageUrl,
            selector: h.selector,
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

    // ═══════════════════════════════════════════════════════════════════════
    // 2. BODY TEXT SIZE & LINE HEIGHT
    // ═══════════════════════════════════════════════════════════════════════

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
          issues.push({
            severity: 'error',
            message: `Low text contrast ratio (${ratio.toFixed(2)}:1, minimum ${minRatio}:1) for text "${text.substring(0, 40)}..." — color: ${t.color} on ${t.bgColor}`,
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
        issues.push({
          severity: 'warning',
          message: `Excessive word-spacing (${t.wordSpacing.toFixed(1)}px) detected: "${t.text.substring(0, 40)}..."`,
          category: 'typography',
          pageUrl,
        });
      }

      // Negative word spacing (compresses words together)
      if (t.wordSpacing < -1) {
        issues.push({
          severity: 'warning',
          message: `Negative word-spacing (${t.wordSpacing.toFixed(1)}px) — words may overlap: "${t.text.substring(0, 40)}..."`,
          category: 'typography',
          pageUrl,
        });
      }

      // Excessive letter spacing (> 5px is usually a problem)
      if (t.letterSpacing > 5) {
        issues.push({
          severity: 'info',
          message: `High letter-spacing (${t.letterSpacing.toFixed(1)}px) detected: "${t.text.substring(0, 40)}..."`,
          category: 'typography',
          pageUrl,
        });
      }

      // Negative letter spacing (compresses letters)
      if (t.letterSpacing < -1) {
        issues.push({
          severity: 'warning',
          message: `Negative letter-spacing (${t.letterSpacing.toFixed(1)}px) — characters may overlap: "${t.text.substring(0, 40)}..."`,
          category: 'typography',
          pageUrl,
        });
      }
    }

    // Check for double/triple spaces in visible text content
    const spacingIssueTexts = textData.bodyTexts.filter((t) => /\s{3,}/.test(t.text));
    for (const t of spacingIssueTexts.slice(0, 5)) {
      issues.push({
        severity: 'warning',
        message: `Excessive whitespace found in text: "${t.text.substring(0, 60)}..."`,
        category: 'typography',
        pageUrl,
      });
    }

    // Also check heading text for spacing issues
    for (const h of textData.headings) {
      if (/\s{3,}/.test(h.text)) {
        issues.push({
          severity: 'warning',
          message: `Excessive whitespace in ${h.tag}: "${h.text}"`,
          category: 'typography',
          pageUrl,
          selector: h.selector,
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
