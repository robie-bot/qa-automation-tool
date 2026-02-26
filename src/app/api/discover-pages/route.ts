import { NextRequest, NextResponse } from 'next/server';
import { discoverPages } from '@/lib/crawler';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { url, sitemapContent } = body;

    if (!url) {
      return NextResponse.json(
        { error: 'URL is required' },
        { status: 400 }
      );
    }

    // Validate URL
    try {
      new URL(url.startsWith('http') ? url : `https://${url}`);
    } catch {
      return NextResponse.json(
        { error: 'Invalid URL format' },
        { status: 400 }
      );
    }

    const normalizedUrl = url.startsWith('http') ? url : `https://${url}`;
    const pages = await discoverPages(normalizedUrl, sitemapContent);

    return NextResponse.json({
      pages,
      count: pages.length,
    });
  } catch (error) {
    console.error('Discover pages error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to discover pages' },
      { status: 500 }
    );
  }
}
