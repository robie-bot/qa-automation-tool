# Security Audit Report

Last audited: March 2026

## Summary

| Severity | Count |
|----------|-------|
| Critical | 5 |
| High | 6 |
| Medium | 5 |
| Low | 4 |

---

## Critical Vulnerabilities

### 1. SSRF (Server-Side Request Forgery) in URL Handling

**Files:** `src/app/api/discover-pages/route.ts`, `src/lib/crawler.ts`

**Issue:** URL validation only checks format, not destination. Attacker can target internal services:
- `http://127.0.0.1:6379` (Redis)
- `http://169.254.169.254` (AWS metadata)
- `http://192.168.x.x` (internal network)

**Fix:** Add IP range validation to block private/reserved addresses before making requests.

---

### 2. XXE in XML Sitemap Parsing

**File:** `src/lib/crawler.ts`

**Issue:** `xml2js.parseStringPromise()` used without disabling external entity processing. Malicious sitemaps could read server files or cause DoS via billion laughs attack.

**Fix:** Switch to a safer XML parser or disable external entities. Validate sitemap size before parsing (max 5MB).

---

### 3. No Screenshot/Upload Size Limits

**Files:** `src/lib/tests/ai-review.ts`, `src/components/StepConfirmRun.tsx`

**Issue:** Screenshots captured without size limits. File uploads have no size validation. A very tall page or large upload can exhaust server memory.

**Fix:** Enforce max screenshot dimensions (5000px height), max file upload sizes (10MB images, 20MB documents), and cap base64 payload sizes.

---

### 4. Unvalidated Sitemap Content Size

**File:** `src/lib/crawler.ts`

**Issue:** User-provided sitemap content parsed without size validation. A multi-GB XML file causes out-of-memory.

**Fix:** Enforce max sitemap size (5MB) and max URL count (50,000) before processing.

---

### 5. Unauthenticated Report Access

**File:** `src/app/api/reports/[id]/route.ts`

**Issue:** Anyone can download any report by guessing the UUID. No authentication check. Reports contain QA findings about target websites.

**Fix:** Add session-based authentication or tie reports to user sessions.

---

## High Vulnerabilities

### 6. Missing Security Headers

**Issue:** No CSP, X-Frame-Options, HSTS, or X-Content-Type-Options headers set.

**Fix:** Add security headers via `next.config.ts`:
- `Content-Security-Policy`
- `X-Frame-Options: DENY`
- `X-Content-Type-Options: nosniff`
- `Strict-Transport-Security`

---

### 7. No Rate Limiting

**Files:** All API routes

**Issue:** No rate limiting on any endpoint. Unlimited `/api/run-review` requests spawn unlimited Playwright browsers.

**Fix:** Implement rate limiting (e.g., 10 reviews/hour per IP).

---

### 8. SSE Event Stream Injection

**File:** `src/app/api/run-review/route.ts`

**Issue:** Error messages from browser pages sent directly into SSE stream. Special characters could break SSE parsing.

**Fix:** Validate event structure and ensure no SSE delimiters (`\n\n`) in data payloads.

---

### 9. No File Size Limits on Uploads

**Files:** `src/components/StepConfirmRun.tsx`, `src/components/StepUrlInput.tsx`

**Issue:** Reference images, content documents, and sitemaps accepted without size validation on the frontend.

**Fix:** Add client-side size limits (10MB images, 20MB documents) before base64 encoding.

---

### 10. API Key in .env.local

**Issue:** The `.env.local` file contains a real PageSpeed API key. While gitignored, it could be in git history.

**Fix:** Rotate the key immediately. Check git history for accidental exposure: `git log -p --all -S "API_KEY"`.

---

### 11. Ollama Localhost SSRF

**File:** `src/lib/tests/ai-providers/ollama.ts`

**Issue:** Hardcoded `localhost:11434` for Ollama. On shared servers, this could access other services.

**Fix:** Validate `OLLAMA_BASE_URL` only allows localhost in development environments.

---

## Medium Vulnerabilities

### 12. No Search Term Validation

**Issue:** Search terms added without length or character validation. Could cause ReDoS if used in regex.

**Fix:** Limit term length (500 chars), term count (100), and validate characters.

### 13. Unbounded Crawling

**Issue:** Crawl can visit 100 pages at 30 seconds each (50 minutes). No timeout.

**Fix:** Add crawl timeout (5 minutes) and per-page link limit.

### 14. Error Messages Leak System Info

**Issue:** Detailed error messages expose file paths, service versions, and internal URLs.

**Fix:** Sanitize error messages in production — show generic messages only.

### 15. Playwright Sandbox Not Enforced

**Issue:** Browser launches without explicit security flags.

**Fix:** Add `--disable-extensions`, `--disable-plugins`, `--disable-dev-shm-usage` flags.

### 16. No Report Cleanup

**Issue:** Reports directory grows indefinitely. No rotation or cleanup.

**Fix:** Auto-delete reports older than 30 days on startup.

---

## Low Vulnerabilities

### 17. Weak Document Format Validation

**Issue:** File type detection via magic bytes is fragile. Malicious ZIPs could be misidentified.

### 18. TypeScript Not in Strict Mode

**Issue:** Allows implicit `any` types, which can hide injection vulnerabilities.

### 19. No CSRF Protection

**Issue:** API routes don't validate request origin. Forms could be submitted from external sites.

### 20. Missing Input Sanitization on Page URLs

**Issue:** Discovered page URLs not sanitized before display in results.

---

## Immediate Action Items

1. Rotate any exposed API keys
2. Add SSRF protection (block private IP ranges)
3. Add file upload size limits
4. Implement rate limiting on API endpoints
5. Add security headers
6. Add XML entity protection for sitemap parsing
