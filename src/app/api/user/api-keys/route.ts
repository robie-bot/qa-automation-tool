import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { encrypt, decrypt, maskApiKey } from '@/lib/encryption';

// GET — List all API keys for the user (masked)
export async function GET(request: NextRequest) {
  try {
    const userId = request.headers.get('x-user-id');
    if (!userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const apiKeys = await prisma.apiKey.findMany({
      where: { userId },
      select: { id: true, provider: true, key: true, updatedAt: true },
      orderBy: { provider: 'asc' },
    });

    // Return masked keys
    const masked = apiKeys.map((k) => ({
      id: k.id,
      provider: k.provider,
      maskedKey: maskApiKey(decrypt(k.key)),
      updatedAt: k.updatedAt,
    }));

    return NextResponse.json({ apiKeys: masked });
  } catch (error) {
    console.error('API keys fetch error:', error);
    return NextResponse.json({ error: 'Failed to fetch API keys' }, { status: 500 });
  }
}

// POST — Save or update an API key
export async function POST(request: NextRequest) {
  try {
    const userId = request.headers.get('x-user-id');
    if (!userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const body = await request.json();
    const { provider, key } = body;

    const validProviders = ['claude', 'openai', 'gemini', 'ollama'];
    if (!provider || !validProviders.includes(provider)) {
      return NextResponse.json({ error: 'Invalid provider' }, { status: 400 });
    }

    if (!key || typeof key !== 'string' || key.length > 500) {
      return NextResponse.json({ error: 'Invalid API key' }, { status: 400 });
    }

    const encryptedKey = encrypt(key.trim());

    const apiKey = await prisma.apiKey.upsert({
      where: { userId_provider: { userId, provider } },
      update: { key: encryptedKey },
      create: { userId, provider, key: encryptedKey },
    });

    return NextResponse.json({
      apiKey: {
        id: apiKey.id,
        provider: apiKey.provider,
        maskedKey: maskApiKey(key.trim()),
      },
    });
  } catch (error) {
    console.error('API key save error:', error);
    return NextResponse.json({ error: 'Failed to save API key' }, { status: 500 });
  }
}

// DELETE — Remove an API key
export async function DELETE(request: NextRequest) {
  try {
    const userId = request.headers.get('x-user-id');
    if (!userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const provider = searchParams.get('provider');

    if (!provider) {
      return NextResponse.json({ error: 'Provider is required' }, { status: 400 });
    }

    await prisma.apiKey.deleteMany({
      where: { userId, provider },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('API key delete error:', error);
    return NextResponse.json({ error: 'Failed to delete API key' }, { status: 500 });
  }
}
