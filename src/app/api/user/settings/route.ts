import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

// GET — Fetch user settings
export async function GET(request: NextRequest) {
  try {
    const userId = request.headers.get('x-user-id');
    if (!userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    let settings = await prisma.userSettings.findUnique({
      where: { userId },
    });

    // Return defaults if no settings exist yet
    if (!settings) {
      settings = {
        id: '',
        userId,
        defaultProvider: 'ollama',
        defaultViewports: '1920,1440,1024,768,375',
        aiReviewVision: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    }

    return NextResponse.json({ settings });
  } catch (error) {
    console.error('Settings fetch error:', error);
    return NextResponse.json({ error: 'Failed to fetch settings' }, { status: 500 });
  }
}

// PUT — Update user settings
export async function PUT(request: NextRequest) {
  try {
    const userId = request.headers.get('x-user-id');
    if (!userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const body = await request.json();
    const { defaultProvider, defaultViewports, aiReviewVision } = body;

    const validProviders = ['claude', 'openai', 'gemini', 'ollama'];
    const data: Record<string, unknown> = {};

    if (defaultProvider && validProviders.includes(defaultProvider)) {
      data.defaultProvider = defaultProvider;
    }

    if (typeof defaultViewports === 'string' && defaultViewports.length <= 100) {
      // Validate format: comma-separated numbers
      const viewports = defaultViewports.split(',').map(Number);
      if (viewports.every((v) => !isNaN(v) && v > 0 && v <= 5000)) {
        data.defaultViewports = defaultViewports;
      }
    }

    if (typeof aiReviewVision === 'boolean') {
      data.aiReviewVision = aiReviewVision;
    }

    const settings = await prisma.userSettings.upsert({
      where: { userId },
      update: data,
      create: {
        userId,
        defaultProvider: (data.defaultProvider as string) || 'ollama',
        defaultViewports: (data.defaultViewports as string) || '1920,1440,1024,768,375',
        aiReviewVision: (data.aiReviewVision as boolean) || false,
      },
    });

    return NextResponse.json({ settings });
  } catch (error) {
    console.error('Settings update error:', error);
    return NextResponse.json({ error: 'Failed to update settings' }, { status: 500 });
  }
}
