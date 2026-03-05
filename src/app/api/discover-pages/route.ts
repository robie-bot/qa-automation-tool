import { NextRequest, NextResponse } from 'next/server';
import { discoverPages } from '@/lib/crawler';
import { rateLimit, validatePublicUrl, sanitizeUrl, sanitizeError } from '@/lib/security';

export async function POST(request: NextRequest) {
  try {
    // Get user from middleware headers
    const userId = request.headers.get('x-user-id');
    if (!userId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Rate limit: 10 discover requests per minute per user
    const rl = rateLimit(`discover:${userId}`, 10, 60000);
    if (!rl.allowed) {
      return NextResponse.json(
        { error: 'Too many requests. Please wait before trying again.' },
        { status: 429 }
      );
    }

    const body = await request.json();
    const { url, sitemapContent } = body;

    if (!url) {
      return NextResponse.json(
        { error: 'URL is required' },
        { status: 400 }
      );
    }

    const sanitizedInputUrl = sanitizeUrl(url);

    // Validate URL format
    let normalizedUrl: string;
    try {
      normalizedUrl = sanitizedInputUrl.startsWith('http') ? sanitizedInputUrl : `https://${sanitizedInputUrl}`;
      new URL(normalizedUrl);
    } catch {
      return NextResponse.json(
        { error: 'Invalid URL format' },
        { status: 400 }
      );
    }

    // SSRF protection: validate the URL is not pointing to private IPs
    const urlCheck = await validatePublicUrl(normalizedUrl);
    if (!urlCheck.valid) {
      return NextResponse.json(
        { error: urlCheck.error },
        { status: 400 }
      );
    }

    const pages = await discoverPages(normalizedUrl, sitemapContent);

    return NextResponse.json({
      pages,
      count: pages.length,
    });
  } catch (error) {
    console.error('Discover pages error:', error);
    return NextResponse.json(
      { error: sanitizeError(error) },
      { status: 500 }
    );
  }
}
