import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Sanitize ID to prevent path traversal
    const sanitizedId = id.replace(/[^a-zA-Z0-9-]/g, '');
    if (!sanitizedId) {
      return NextResponse.json({ error: 'Invalid report ID' }, { status: 400 });
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
