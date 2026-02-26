import { NextRequest } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { runReview } from '@/lib/test-runner';
import { generateReport } from '@/lib/report-generator';
import { ReviewRequest, ReviewSummary, TestCategory, SSEEvent, TestIssue } from '@/types';

export async function POST(request: NextRequest) {
  try {
    const body: ReviewRequest = await request.json();
    const { targetUrl, pages, categories, referenceImage, config } = body;

    if (!targetUrl || !pages?.length || !categories?.length) {
      return new Response(
        JSON.stringify({ error: 'targetUrl, pages, and categories are required' }),
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
            sendEvent
          );

          const duration = Date.now() - startTime;

          const summary: ReviewSummary = {
            totalIssues: allIssues.filter((i) => i.severity !== 'info').length,
            errors: allIssues.filter((i) => i.severity === 'error').length,
            warnings: allIssues.filter((i) => i.severity === 'warning').length,
            infos: allIssues.filter((i) => i.severity === 'info').length,
            byCategory: {} as Record<TestCategory, number>,
            pagesReviewed: pages.length,
            duration,
          };

          for (const cat of categories) {
            summary.byCategory[cat] = allIssues.filter(
              (i) => i.category === cat && i.severity !== 'info'
            ).length;
          }

          // Generate PDF report
          try {
            await generateReport(allIssues, summary, targetUrl, reportId);
          } catch (err) {
            console.error('Report generation error:', err);
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
      JSON.stringify({ error: error instanceof Error ? error.message : 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
