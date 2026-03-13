# Roadmap

## Current State (v0.1.0)

A working QA automation tool with 9 test categories, 4 AI providers, PDF report generation, and a wizard-based UI. Runs locally or on a VPS.

### What works today:
- 9 test categories (layout, typography, color, links, PageSpeed, content, text, images, AI)
- 4 AI providers (Claude, OpenAI, Gemini, Ollama)
- Real-time SSE progress streaming
- PDF report generation with screenshots
- Sitemap parsing and BFS page discovery
- File uploads (images, documents, sitemaps)
- Screenshot save/expand in results

---

## Phase 1: Security Hardening (Priority)

**Goal:** Fix critical vulnerabilities before any public deployment.

- [x] **SSRF protection** — Block private IP ranges (127.0.0.1, 169.254.x.x, 10.0.0.0/8, 192.168.0.0/16)
- [x] **File upload limits** — 10MB images, 20MB documents, 5MB sitemaps
- [x] **Screenshot size caps** — Max 5000px height, 500KB per screenshot
- [x] **Rate limiting** — 10 reviews/hour per IP using in-memory or Redis store
- [x] **Security headers** — CSP, X-Frame-Options, HSTS, X-Content-Type-Options
- [x] **XML entity protection** — Prevent XXE in sitemap parsing
- [x] **Input sanitization** — Validate search terms, URLs, and file formats
- [x] **Error message sanitization** — Generic errors in production
- [x] **Report cleanup** — Auto-delete reports older than 30 days

---

## Phase 2: User Authentication & Multi-Tenancy

**Goal:** Support multiple users with their own reviews and API keys.

- [x] **User authentication** — Login/register (email + password)
- [x] **Session management** — JWT with httpOnly cookies (jose for Edge middleware)
- [x] **Per-user API keys** — Users bring their own AI provider keys (AES-256-GCM encrypted)
- [x] **Report ownership** — Reports tied to user accounts with ownership verification
- [x] **Review history** — Dashboard showing past reviews with status, pagination, download
- [x] **User settings** — Default AI provider, viewports, vision mode preferences

---

## Phase 3: UI/UX Improvements

**Goal:** Make the tool easier and more pleasant to use.

- [ ] **Dark mode** — Full dark theme support
- [ ] **Issue grouping** — Group related issues (e.g., all contrast issues together)
- [ ] **Side-by-side comparison** — Compare current vs. previous review results
- [ ] **Inline fix suggestions** — Show CSS/HTML fix suggestions for common issues
- [ ] **Bulk screenshot download** — Download all screenshots as ZIP
- [ ] **Export to CSV/JSON** — Export results in structured formats
- [ ] **Mobile-responsive UI** — Make the tool itself mobile-friendly
- [ ] **Keyboard shortcuts** — Quick navigation through results
- [ ] **Issue annotations** — Mark issues as false positive, acknowledged, or fixed

---

## Phase 4: Advanced Testing Features

**Goal:** Expand what the tool can detect.

- [ ] **Accessibility audit (WCAG 2.1)** — Full accessibility testing beyond contrast
- [ ] **SEO analysis** — Meta tags, structured data, canonical URLs, Open Graph
- [ ] **Form testing** — Detect broken forms, missing labels, validation issues
- [ ] **Cookie/privacy compliance** — Detect cookie banners, GDPR compliance
- [ ] **SSL/TLS checks** — Certificate validity, mixed content warnings
- [ ] **Custom test rules** — User-defined regex or CSS selector-based rules
- [ ] **Scheduled reviews** — Cron-based automatic reviews with email alerts
- [ ] **Diff detection** — Compare screenshots across review runs, detect visual regressions
- [ ] **Performance budget** — Set thresholds and alert when exceeded

---

## Phase 5: Collaboration & Reporting

**Goal:** Make the tool useful for teams.

- [ ] **Team workspaces** — Shared projects, roles (admin/reviewer/viewer)
- [ ] **Comments on issues** — Team discussion on individual findings
- [ ] **Assign issues** — Assign issues to team members
- [ ] **Status tracking** — Track issue lifecycle (open/in-progress/resolved/won't fix)
- [ ] **Slack/email notifications** — Alert when reviews complete or critical issues found
- [ ] **Branded PDF reports** — Custom logo, colors, company name in reports
- [ ] **Executive summary** — One-page summary for non-technical stakeholders
- [ ] **Trend dashboard** — Track issue counts over time, show improvement graphs

---

## Phase 6: API & Integrations

**Goal:** Let other tools and workflows use the QA engine.

- [ ] **REST API** — Programmatic access to run reviews and fetch results
- [ ] **Webhook support** — Trigger reviews from CI/CD pipelines
- [ ] **GitHub integration** — Create issues from findings, PR status checks
- [ ] **Jira integration** — Create tickets from findings
- [ ] **CI/CD plugin** — GitHub Actions, GitLab CI, Jenkins integration
- [ ] **WordPress plugin** — One-click QA for WordPress sites
- [ ] **Browser extension** — Run quick checks on any page from the browser

---

## Phase 7: Scale & Performance

**Goal:** Handle larger workloads and more concurrent users.

- [ ] **Parallel page testing** — Test multiple pages simultaneously
- [ ] **Queue system** — Redis/Bull queue for review jobs
- [ ] **Worker processes** — Separate browser workers from API server
- [ ] **CDN for reports** — Store reports on S3/R2 instead of local disk
- [ ] **Database** — PostgreSQL/SQLite for reviews, issues, users (replace in-memory)
- [ ] **Caching** — Cache PageSpeed results, crawl results
- [ ] **Horizontal scaling** — Docker Compose or Kubernetes for multiple workers

---

## Version Milestones

| Version | Phase | Target |
|---------|-------|--------|
| **v0.2** | Phase 1 | Security hardening |
| **v0.3** | Phase 2 | User auth & multi-tenancy |
| **v0.5** | Phase 3 | UI/UX improvements |
| **v1.0** | Phase 4 | Advanced testing (first stable release) |
| **v1.5** | Phase 5 | Team collaboration |
| **v2.0** | Phase 6 | API & integrations |
| **v3.0** | Phase 7 | Scale & performance |
