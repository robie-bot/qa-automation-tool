# QA Automation Tool

Automated website quality assurance reviews built with Next.js and Playwright. Run scoped website reviews — choose specific test categories, specific pages, or a full site review. Generates PDF reports with screenshots.

## Setup

```bash
# Install dependencies
npm install

# Install Playwright Chromium browser
npx playwright install chromium

# Start the development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Test Categories

- **General Layout** — Viewport responsiveness (5 breakpoints), element overlap detection, z-index stacking issues
- **Typography & Content** — Font size validation, heading hierarchy, line height ratios, WCAG AA contrast checking
- **Color Scheme** — Dominant color extraction, Delta-E (CIE2000) comparison against uploaded reference images
- **Broken Links & Images** — HTTP status checks for all links/images, missing alt attribute detection, redirect chain detection

## Review Flow

1. Enter a website URL, sitemap URL, or upload a sitemap.xml file
2. Choose review scope: Full / By Category / By Page / Custom
3. Configure which categories and/or pages to test
4. Review summary and start the review
5. Watch real-time progress via Server-Sent Events
6. View results and download the PDF report

## Tech Stack

- **Next.js 16** with App Router and TypeScript
- **Playwright** for browser automation and screenshot capture
- **PDFKit** for PDF report generation
- **Sharp** for image processing (color extraction)
- **Tailwind CSS** for styling
- **Lucide React** for icons

## Project Structure

```
src/
├── app/                    # Next.js pages and API routes
│   ├── page.tsx            # Dashboard
│   ├── review/page.tsx     # Review wizard
│   └── api/                # API endpoints
├── components/             # React components
│   ├── ui/                 # Reusable UI primitives
│   ├── ReviewWizard.tsx    # Main wizard orchestrator
│   └── ...                 # Step and result components
├── lib/                    # Core logic
│   ├── crawler.ts          # Sitemap parser + BFS crawler
│   ├── test-runner.ts      # Test orchestration
│   ├── tests/              # Individual test modules
│   └── report-generator.ts # PDF generation
└── types/                  # TypeScript types
```

## API Endpoints

- `POST /api/discover-pages` — Crawl a site or parse a sitemap to discover pages
- `POST /api/run-review` — Execute a scoped review (returns SSE stream)
- `GET /api/reports/[id]` — Download a generated PDF report
