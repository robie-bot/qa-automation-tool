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

## Environment Variables

Create a `.env.local` file in the project root:

```env
# AI Providers (at least one required for AI Review)
ANTHROPIC_API_KEY=sk-ant-...        # Claude
OPENAI_API_KEY=sk-...               # GPT-4o
GEMINI_API_KEY=...                  # Gemini (free tier available)

# Ollama (local, no API key needed)
OLLAMA_MODEL=llama3.2               # Default model
OLLAMA_BASE_URL=http://localhost:11434

# Optional
PAGESPEED_API_KEY=...               # Google PageSpeed (free key, higher limits)
```

## Test Categories

| Category | What It Tests | Est. Time |
|----------|--------------|-----------|
| **General Layout** | Viewport responsiveness (5 breakpoints), element overlap, z-index stacking | ~2 min/page |
| **Typography & Content** | Font sizes, heading hierarchy, line heights, WCAG AA contrast, spelling | ~1 min/page |
| **Color Scheme** | Dominant color extraction, Delta-E comparison against reference image | ~1 min/page |
| **Broken Links & Images** | HTTP status checks, missing alt text, redirect chains | ~30 sec/page |
| **PageSpeed Insights** | Google Lighthouse performance, accessibility, best practices, SEO | ~30 sec/page |
| **Content Cross-Check** | Verify uploaded document content appears on website pages | ~15 sec/page |
| **Text Finder** | Search for specific words/sentences/paragraphs across pages | ~10 sec/page |
| **Images & Media** | Image quality, stretching, alt text quality, video loading, sliders | ~1 min/page |
| **AI Review** | LLM visits each page and performs independent QA review | ~30 sec/page |

## AI Providers

| Provider | Model | Cost | Vision Support |
|----------|-------|------|---------------|
| **Claude** (Anthropic) | claude-sonnet-4-6 | ~$0.01-0.05/review | Yes |
| **GPT** (OpenAI) | gpt-4o | ~$0.01-0.05/review | Yes |
| **Gemini** (Google) | gemini-2.0-flash | Free tier (1,500 req/day) | Yes |
| **Ollama** (Local) | llama3.2 (configurable) | Free (runs locally) | Yes |

## Review Flow

1. **Enter URL** — Website URL, sitemap URL, or upload sitemap.xml
2. **Choose Scope** — Full / By Category / By Page / Custom
3. **Select Categories** — Pick which tests to run, choose AI provider
4. **Upload Files** (optional) — Reference image, content document, search terms
5. **Run Review** — Watch real-time progress via Server-Sent Events
6. **View Results** — Filter by severity/category, expand screenshots, save images
7. **Download Report** — PDF report with all findings and screenshots

## File Upload Support

| File Type | Purpose | Formats |
|-----------|---------|---------|
| Reference Image | Color scheme comparison | PNG, JPG, WebP |
| Content Document | Cross-check content on site | PDF, DOCX, ODT, TXT |
| Sitemap | Discover pages | XML |
| Search Terms | Find text across pages | Multi-line text input |

## Results Dashboard

- **Summary cards** — Total issues, errors, warnings, info counts
- **Category breakdown** — Issues per test category with progress bars
- **Filtered issue list** — Filter by severity tab and category dropdown
- **Screenshots** — Auto-expanded for errors/warnings, with save button
- **PDF report** — Downloadable report with all findings embedded

## Tech Stack

- **Next.js 16** with App Router and TypeScript
- **Playwright** for browser automation and screenshot capture
- **PDFKit** for PDF report generation
- **Sharp** for image processing (color extraction)
- **Tailwind CSS 4** for styling
- **Lucide React** for icons
- **AI SDKs** — Anthropic, OpenAI, Google Generative AI

## Project Structure

```
src/
├── app/                          # Next.js pages and API routes
│   ├── page.tsx                  # Dashboard
│   ├── review/page.tsx           # Review wizard
│   └── api/
│       ├── discover-pages/       # POST — Crawl/parse sitemap
│       ├── run-review/           # POST — Execute review (SSE stream)
│       └── reports/[id]/         # GET — Download PDF report
├── components/
│   ├── ui/                       # Reusable UI primitives
│   ├── ReviewWizard.tsx          # Main wizard orchestrator
│   ├── ReviewProgress.tsx        # Real-time progress display
│   ├── ResultsDashboard.tsx      # Results with filters & screenshots
│   ├── PageSpeedResults.tsx      # Lighthouse metrics visualization
│   ├── Step*.tsx                 # Wizard step components
│   └── ReportDownload.tsx        # PDF download button
├── lib/
│   ├── crawler.ts                # Sitemap parser + BFS crawler
│   ├── browser.ts                # Playwright browser launcher
│   ├── test-runner.ts            # Test orchestration engine
│   ├── report-generator.ts       # PDF report generation
│   └── tests/                    # Individual test modules
│       ├── layout.ts
│       ├── typography.ts
│       ├── color-scheme.ts
│       ├── broken-links.ts
│       ├── pagespeed.ts
│       ├── content-check.ts
│       ├── text-finder.ts
│       ├── images-media.ts
│       ├── ai-review.ts
│       └── ai-providers/         # Claude, OpenAI, Gemini, Ollama
└── types/                        # TypeScript type definitions
```

## Deployment

### Docker

```bash
docker build -t qa-automation-tool .
docker run -p 3000:3000 --env-file .env.local qa-automation-tool
```

### VPS (Hetzner, DigitalOcean, etc.)

```bash
npm install
npx playwright install chromium
npm run build
npm start
```

**Minimum specs:** 2 vCPU, 4 GB RAM, 40 GB SSD
**Recommended:** 4 vCPU, 8 GB RAM (especially with Ollama)

### Vercel

Deploys automatically. Uses `@sparticuz/chromium` for serverless Playwright.

## Configuration Defaults

```typescript
{
  typography: {
    h1MinSize: 32,          // px
    h2MinSize: 24,
    h3MinSize: 20,
    bodyMinSize: 14,
    minLineHeightRatio: 1.4,
    minContrastRatio: 4.5,  // WCAG AA
  },
  colorThreshold: 10,       // Delta-E units
  linkTimeout: 5000,         // ms
  viewports: [1920, 1440, 1024, 768, 375],
  aiReviewVision: false,
  aiProvider: 'claude',
}
```

## API Endpoints

- `POST /api/discover-pages` — Crawl a site or parse a sitemap to discover pages
- `POST /api/run-review` — Execute a scoped review (returns SSE stream)
- `GET /api/reports/[id]` — Download a generated PDF report
