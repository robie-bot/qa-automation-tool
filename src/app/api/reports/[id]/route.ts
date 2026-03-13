import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';
import { prisma } from '@/lib/db';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = request.headers.get('x-user-id');
    if (!userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { id } = await params;

    // Sanitize ID to prevent path traversal
    const sanitizedId = id.replace(/[^a-zA-Z0-9-]/g, '');
    if (!sanitizedId) {
      return NextResponse.json({ error: 'Invalid report ID' }, { status: 400 });
    }

    // Check report ownership
    const report = await prisma.report.findUnique({
      where: { id: sanitizedId },
    });

    if (!report || report.userId !== userId) {
      return NextResponse.json({ error: 'Report not found' }, { status: 404 });
    }

    const filePath = path.join(process.cwd(), 'reports', `${sanitizedId}.pdf`);

    if (!fs.existsSync(filePath)) {
      return NextResponse.json({ error: 'Report not found' }, { status: 404 });
    }

    const fileBuffer = fs.readFileSync(filePath);

    return new NextResponse(fileBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="qa-report-${sanitizedId}.pdf"`,
        'Content-Length': fileBuffer.length.toString(),
      },
    });
  } catch (error) {
    console.error('Report download error:', error);
    return NextResponse.json(
      { error: 'Failed to download report' },
      { status: 500 }
    );
  }
}
