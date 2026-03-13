import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import path from 'path';
import fs from 'fs';

const CRON_SECRET = process.env.CRON_SECRET;

export async function POST(request: NextRequest) {
  try {
    // Verify cron secret to prevent unauthorized access
    if (CRON_SECRET) {
      const authHeader = request.headers.get('authorization');
      if (authHeader !== `Bearer ${CRON_SECRET}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
    }

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // Find old reports
    const oldReports = await prisma.report.findMany({
      where: {
        createdAt: { lt: thirtyDaysAgo },
      },
      select: { id: true },
    });

    // Delete PDF files
    const reportsDir = path.join(process.cwd(), 'reports');
    let filesDeleted = 0;

    for (const report of oldReports) {
      const filePath = path.join(reportsDir, `${report.id}.pdf`);
      try {
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
          filesDeleted++;
        }
      } catch {
        // Skip files that can't be deleted
      }
    }

    // Delete DB records
    const dbResult = await prisma.report.deleteMany({
      where: {
        createdAt: { lt: thirtyDaysAgo },
      },
    });

    return NextResponse.json({
      success: true,
      recordsDeleted: dbResult.count,
      filesDeleted,
    });
  } catch (error) {
    console.error('Cleanup error:', error);
    return NextResponse.json(
      { error: 'Cleanup failed' },
      { status: 500 }
    );
  }
}
