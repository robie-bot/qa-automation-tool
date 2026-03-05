import { NextRequest } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { runReview } from '@/lib/test-runner';
import { generateReport } from '@/lib/report-generator';
import { ReviewRequest, ReviewSummary, TestCategory, SSEEvent, TestIssue } from '@/types';
import { prisma } from '@/lib/db';
import { rateLimit, validatePublicUrl, validateBase64Size, sanitizeError, MAX_IMAGE_SIZE, MAX_DOCUMENT_SIZE } from '@/lib/security';

export async function POST(request: NextRequest) {
  try {
    // Get user from middleware headers
    const userId = request.headers.get('x-user-id');
    if (!userId) {
      return new Response(
        JSON.stringify({ error: 'Authentication required' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Rate limit: 5 reviews per minute per user
    const rl = rateLimit(`review:${userId}`, 5, 60000);
    if (!rl.allowed) {
      return new Response(
        JSON.stringify({ error: 'Too many reviews. Please wait before starting another.' }),
        { status: 429, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const body: ReviewRequest = await request.json();
    const { targetUrl, pages, categories, referenceImage, config, contentDocument, searchTerms } = body;

    if (!targetUrl || !pages?.length || !categories?.length) {
      return new Response(
        JSON.stringify({ error: 'targetUrl, pages, and categories are required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Validate target URL against SSRF
    const urlCheck = await validatePublicUrl(targetUrl);
    if (!urlCheck.valid) {
      return new Response(
        JSON.stringify({ error: urlCheck.error }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Validate file upload sizes
    if (referenceImage && !validateBase64Size(referenceImage, MAX_IMAGE_SIZE)) {
      return new Response(
        JSON.stringify({ error: 'Reference image too large (max 10MB)' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (contentDocument && !validateBase64Size(contentDocument, MAX_DOCUMENT_SIZE)) {
      return new Response(
        JSON.stringify({ error: 'Document too large (max 20MB)' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const reportId = uuidv4();
    const startTime = Date.now();

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const sendEvent = (event: SSEEvent) => {
          try {
            const data = JSON.stringify(event);
            controller.enqueue(encoder.encode(`data: ${data}\n\n`));
          } catch {
            // Stream may be closed
          }
        };

        try {
          const allIssues: TestIssue[] = await runReview(
            targetUrl,
            pages,
            categories,
            config,
            referenceImage || null,
            sendEvent,
            contentDocument || null,
            searchTerms || []
          );

          const duration = Date.now() - startTime;

          const summary: ReviewSummary = {
            totalIssues: allIssues.length,
            errors: allIssues.filter((i) => i.severity === 'error').length,
            warnings: allIssues.filter((i) => i.severity === 'warning').length,
            infos: allIssues.filter((i) => i.severity === 'info').length,
            byCategory: {} as Record<TestCategory, number>,
            pagesReviewed: pages.length,
            duration,
          };

          for (const cat of categories) {
            summary.byCategory[cat] = allIssues.filter(
              (i) => i.category === cat
            ).length;
          }

          // Generate PDF report
          try {
            await generateReport(allIssues, summary, targetUrl, reportId);
          } catch (err) {
            console.error('Report generation error:', err);
          }

          // Save report record to database
          try {
            await prisma.report.create({
              data: {
                id: reportId,
                userId,
                targetUrl,
              },
            });
          } catch (err) {
            console.error('Report DB save error:', err);
          }

          sendEvent({
            type: 'complete',
            reportId,
            summary,
          });
        } catch (error) {
          sendEvent({
            type: 'error',
            message: error instanceof Error ? error.message : 'Review failed',
          });
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({ error: sanitizeError(error) }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
