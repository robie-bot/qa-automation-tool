import { Page } from 'playwright-core';
import { TestIssue, ReviewConfig } from '@/types';

type DocumentFormat = 'pdf' | 'docx' | 'odt' | 'text';

/**
 * Detect document format from magic bytes.
 * PDF = %PDF, DOCX/ODT = PK (ZIP), else plain text.
 */
async function detectFormat(buffer: Buffer): Promise<DocumentFormat> {
  // PDF: starts with %PDF
  if (
    buffer[0] === 0x25 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x44 &&
    buffer[3] === 0x46
  ) {
    return 'pdf';
  }

  // ZIP-based: starts with PK (0x50 0x4B) — could be DOCX or ODT
  if (buffer[0] === 0x50 && buffer[1] === 0x4b) {
    try {
      const JSZip = (await import('jszip')).default;
      const zip = await JSZip.loadAsync(buffer);
      // DOCX contains word/document.xml
      if (zip.file('word/document.xml')) return 'docx';
      // ODT contains content.xml with ODF namespace
      if (zip.file('content.xml')) return 'odt';
    } catch {
      // Couldn't parse ZIP — fall through to text
    }
  }

  return 'text';
}

/**
 * Extract text from a PDF buffer using pdf-parse.
 */
async function extractPdfText(buffer: Buffer): Promise<string> {
  const pdfParse = (await import('pdf-parse')).default;
  const pdfData = await pdfParse(buffer);
  return pdfData.text;
}

/**
 * Extract text from a DOCX buffer using mammoth.
 */
async function extractDocxText(buffer: Buffer): Promise<string> {
  const mammoth = await import('mammoth');
  const result = await mammoth.extractRawText({ buffer });
  return result.value;
}

/**
 * Extract text from an ODT buffer by unzipping content.xml and stripping XML tags.
 */
async function extractOdtText(buffer: Buffer): Promise<string> {
  const JSZip = (await import('jszip')).default;
  const zip = await JSZip.loadAsync(buffer);
  const contentXml = zip.file('content.xml');
  if (!contentXml) {
    throw new Error('ODT file does not contain content.xml');
  }
  const xmlStr = await contentXml.async('text');

  // Extract text from ODF XML:
  // Replace paragraph/line-break tags with newlines, then strip all XML tags
  const withBreaks = xmlStr
    .replace(/<text:p[^>]*>/gi, '\n')
    .replace(/<text:line-break\s*\/?\s*>/gi, '\n')
    .replace(/<text:tab\s*\/?\s*>/gi, '\t')
    .replace(/<text:s\s*\/?\s*>/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");

  return withBreaks;
}

/**
 * Extract text from a base64 document (PDF, DOCX, ODT, or plain text).
 * Returns an array of meaningful text segments (paragraphs/sentences).
 */
async function extractDocumentText(base64Content: string): Promise<string[]> {
  const buffer = Buffer.from(base64Content, 'base64');
  const format = await detectFormat(buffer);

  let fullText = '';

  switch (format) {
    case 'pdf':
      try {
        fullText = await extractPdfText(buffer);
      } catch (error) {
        throw new Error(`Failed to parse PDF: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
      break;
    case 'docx':
      try {
        fullText = await extractDocxText(buffer);
      } catch (error) {
        throw new Error(`Failed to parse DOCX: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
      break;
    case 'odt':
      try {
        fullText = await extractOdtText(buffer);
      } catch (error) {
        throw new Error(`Failed to parse ODT: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
      break;
    default:
      fullText = buffer.toString('utf-8');
  }

  // Split into meaningful segments — paragraphs, then sentences
  const segments: string[] = [];

  // First split by double newlines (paragraphs)
  const paragraphs = fullText
    .split(/\n\s*\n/)
    .map((p) => p.replace(/\s+/g, ' ').trim())
    .filter((p) => p.length >= 10);

  for (const para of paragraphs) {
    // If a paragraph is long, also split by sentences
    if (para.length > 200) {
      const sentences = para
        .split(/(?<=[.!?])\s+/)
        .map((s) => s.trim())
        .filter((s) => s.length >= 10);
      segments.push(...sentences);
    } else {
      segments.push(para);
    }
  }

  return segments;
}

/**
 * Normalize text for fuzzy comparison — lowercase, collapse whitespace, strip punctuation edges.
 */
function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[""'']/g, '"')
    .replace(/[–—]/g, '-')
    .trim();
}

/**
 * Check if a page contains a text segment.
 * Returns a match score: 1 = exact, 0.5-0.99 = partial, 0 = not found.
 */
function matchScore(pageText: string, segment: string): number {
  const normPage = normalize(pageText);
  const normSegment = normalize(segment);

  // Exact match
  if (normPage.includes(normSegment)) {
    return 1;
  }

  // Try matching a significant substring (first 80 chars)
  const shortSegment = normSegment.substring(0, 80);
  if (shortSegment.length >= 15 && normPage.includes(shortSegment)) {
    return 0.8;
  }

  // Word-level overlap
  const segmentWords = normSegment.split(' ').filter((w) => w.length > 3);
  if (segmentWords.length === 0) return 0;

  let matched = 0;
  for (const word of segmentWords) {
    if (normPage.includes(word)) matched++;
  }

  const ratio = matched / segmentWords.length;
  return ratio >= 0.7 ? ratio * 0.7 : 0;
}

export async function runContentCheckTests(
  page: Page,
  pageUrl: string,
  _config: ReviewConfig,
  contentDocument: string | null
): Promise<TestIssue[]> {
  const issues: TestIssue[] = [];

  if (!contentDocument) {
    issues.push({
      severity: 'info',
      message: 'No document uploaded — skipping content cross-check',
      category: 'content-check',
      pageUrl,
    });
    return issues;
  }

  try {
    // Extract text segments from the uploaded document
    let segments: string[];
    try {
      segments = await extractDocumentText(contentDocument);
    } catch (error) {
      issues.push({
        severity: 'error',
        message: `Failed to extract text from document: ${error instanceof Error ? error.message : 'Unknown error'}`,
        category: 'content-check',
        pageUrl,
      });
      return issues;
    }

    if (segments.length === 0) {
      issues.push({
        severity: 'warning',
        message: 'No meaningful text segments found in the uploaded document',
        category: 'content-check',
        pageUrl,
      });
      return issues;
    }

    // Get all visible text from the page
    const pageText = await page.evaluate(() => {
      return document.body.innerText || '';
    });

    if (!pageText || pageText.trim().length < 10) {
      issues.push({
        severity: 'warning',
        message: 'Page has very little visible text content',
        category: 'content-check',
        pageUrl,
      });
      return issues;
    }

    let exactMatches = 0;
    let partialMatches = 0;
    let missingSegments = 0;

    for (const segment of segments) {
      const score = matchScore(pageText, segment);
      const preview = segment.length > 80 ? segment.substring(0, 80) + '...' : segment;

      if (score >= 1) {
        exactMatches++;
      } else if (score >= 0.5) {
        partialMatches++;
        issues.push({
          severity: 'warning',
          message: `Partial match (${Math.round(score * 100)}%): "${preview}"`,
          category: 'content-check',
          pageUrl,
        });
      } else {
        missingSegments++;
        issues.push({
          severity: 'error',
          message: `Content not found on page: "${preview}"`,
          category: 'content-check',
          pageUrl,
        });
      }
    }

    // Summary
    issues.push({
      severity: 'info',
      message: `Content cross-check: ${exactMatches} exact, ${partialMatches} partial, ${missingSegments} missing out of ${segments.length} segments`,
      category: 'content-check',
      pageUrl,
    });
  } catch (error) {
    issues.push({
      severity: 'warning',
      message: `Content check error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      category: 'content-check',
      pageUrl,
    });
  }

  return issues;
}
