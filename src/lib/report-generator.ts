import PDFDocument from 'pdfkit';
import { TestIssue, ReviewSummary, TestCategory } from '@/types';
import path from 'path';
import fs from 'fs';

const COLORS = {
  primary: '#FF7F11',
  secondary: '#ACBFA4',
  dark: '#262626',
  light: '#E2E8CE',
  error: '#E53E3E',
  warning: '#FF7F11',
  info: '#4299E1',
  white: '#FFFFFF',
  gray: '#6B7280',
};

const CATEGORY_NAMES: Record<TestCategory, string> = {
  layout: 'General Layout',
  typography: 'Typography & Content',
  'color-scheme': 'Color Scheme',
  'broken-links': 'Broken Links & Images',
};

export async function generateReport(
  issues: TestIssue[],
  summary: ReviewSummary,
  targetUrl: string,
  reportId: string
): Promise<string> {
  const reportsDir = path.join(process.cwd(), 'reports');
  if (!fs.existsSync(reportsDir)) {
    fs.mkdirSync(reportsDir, { recursive: true });
  }

  const filePath = path.join(reportsDir, `${reportId}.pdf`);

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4',
      margins: { top: 50, bottom: 50, left: 50, right: 50 },
      bufferPages: true,
      info: {
        Title: `QA Review Report — ${targetUrl}`,
        Author: 'QA Automation Tool',
        Subject: 'Website Quality Assurance Review',
      },
    });

    const stream = fs.createWriteStream(filePath);
    doc.pipe(stream);

    // ========== COVER PAGE ==========
    doc.rect(0, 0, doc.page.width, doc.page.height).fill(COLORS.dark);

    // Title
    doc.fontSize(36).fillColor(COLORS.white).text('QA Review Report', 50, 150, {
      align: 'center',
    });

    // Orange accent line
    doc.rect(200, 210, 195, 4).fill(COLORS.primary);

    // Site URL
    doc.fontSize(16).fillColor(COLORS.primary).text(targetUrl, 50, 240, {
      align: 'center',
    });

    // Date
    doc.fontSize(12).fillColor('#9CA3AF').text(
      `Generated: ${new Date().toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })}`,
      50, 280,
      { align: 'center' }
    );

    // Summary stats boxes
    const statsY = 380;
    const boxWidth = 110;
    const boxSpacing = 15;
    const totalBoxWidth = 4 * boxWidth + 3 * boxSpacing;
    const startX = (doc.page.width - totalBoxWidth) / 2;

    const stats = [
      { label: 'Total Issues', value: summary.totalIssues.toString(), color: COLORS.white },
      { label: 'Errors', value: summary.errors.toString(), color: COLORS.error },
      { label: 'Warnings', value: summary.warnings.toString(), color: COLORS.warning },
      { label: 'Info', value: summary.infos.toString(), color: COLORS.info },
    ];

    stats.forEach((stat, i) => {
      const x = startX + i * (boxWidth + boxSpacing);
      doc.roundedRect(x, statsY, boxWidth, 80, 8).fill('#333333');
      doc.fontSize(28).fillColor(stat.color).text(stat.value, x, statsY + 15, {
        width: boxWidth,
        align: 'center',
      });
      doc.fontSize(9).fillColor('#9CA3AF').text(stat.label, x, statsY + 52, {
        width: boxWidth,
        align: 'center',
      });
    });

    // Pages reviewed and duration
    doc.fontSize(11).fillColor('#9CA3AF').text(
      `${summary.pagesReviewed} pages reviewed — Duration: ${Math.round(summary.duration / 1000)}s`,
      50, statsY + 110,
      { align: 'center' }
    );

    // ========== TABLE OF CONTENTS ==========
    doc.addPage();
    doc.rect(0, 0, doc.page.width, 80).fill(COLORS.dark);
    doc.fontSize(24).fillColor(COLORS.white).text('Table of Contents', 50, 28);

    let tocY = 110;
    const categories = Object.keys(summary.byCategory) as TestCategory[];

    doc.fontSize(13).fillColor(COLORS.dark);
    categories.forEach((cat, i) => {
      const count = summary.byCategory[cat] || 0;
      doc.fillColor(COLORS.dark).text(`${i + 1}. ${CATEGORY_NAMES[cat]}`, 70, tocY);
      doc.fillColor(COLORS.gray).text(`${count} issues`, 400, tocY);
      tocY += 28;
    });

    // ========== CATEGORY SECTIONS ==========
    for (const category of categories) {
      const categoryIssues = issues.filter((i) => i.category === category);
      if (categoryIssues.length === 0) continue;

      doc.addPage();

      // Category header
      doc.rect(0, 0, doc.page.width, 70).fill(COLORS.dark);
      doc.fontSize(20).fillColor(COLORS.white).text(CATEGORY_NAMES[category], 50, 25);

      const errorCount = categoryIssues.filter((i) => i.severity === 'error').length;
      const warningCount = categoryIssues.filter((i) => i.severity === 'warning').length;
      const infoCount = categoryIssues.filter((i) => i.severity === 'info').length;

      doc.fontSize(10).fillColor('#9CA3AF').text(
        `${errorCount} errors | ${warningCount} warnings | ${infoCount} info`,
        50, 50
      );

      let y = 90;

      for (const issue of categoryIssues) {
        // Check if we need a new page
        if (y > 700) {
          doc.addPage();
          y = 50;
        }

        // Severity indicator
        const sevColor =
          issue.severity === 'error' ? COLORS.error :
          issue.severity === 'warning' ? COLORS.warning :
          COLORS.info;

        doc.roundedRect(50, y, 6, 6, 3).fill(sevColor);

        // Severity label
        doc.fontSize(8).fillColor(sevColor).text(
          issue.severity.toUpperCase(),
          65, y - 1
        );

        // Page URL
        doc.fontSize(8).fillColor(COLORS.gray).text(
          issue.pageUrl,
          130, y - 1,
          { width: 360 }
        );

        // Message
        doc.fontSize(10).fillColor(COLORS.dark).text(
          issue.message,
          65, y + 12,
          { width: 430 }
        );

        // Calculate height used by message
        const messageHeight = doc.heightOfString(issue.message, { width: 430 });
        y += messageHeight + 25;

        // Add screenshot if available (limit to avoid huge PDFs)
        if (issue.screenshot && issue.severity !== 'info') {
          try {
            const imgBuffer = Buffer.from(issue.screenshot, 'base64');
            if (y + 160 > 700) {
              doc.addPage();
              y = 50;
            }
            doc.image(imgBuffer, 65, y, { width: 400, height: 150, fit: [400, 150] });
            y += 165;
          } catch {
            // Skip broken images
          }
        }
      }
    }

    // ========== FOOTER ON ALL PAGES ==========
    const pageCount = doc.bufferedPageRange().count;
    for (let i = 0; i < pageCount; i++) {
      doc.switchToPage(i);
      doc.fontSize(8).fillColor(COLORS.gray).text(
        `QA Automation Tool — Page ${i + 1} of ${pageCount}`,
        50,
        doc.page.height - 30,
        { align: 'center', width: doc.page.width - 100 }
      );
    }

    doc.end();

    stream.on('finish', () => resolve(filePath));
    stream.on('error', reject);
  });
}
