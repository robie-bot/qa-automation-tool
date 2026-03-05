'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import ReportDownload from '@/components/ReportDownload';

function ResultsContent() {
  const searchParams = useSearchParams();
  const reportId = searchParams.get('reportId');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#262626]">Review Results</h1>
        <p className="text-gray-500 mt-1">Download your generated report.</p>
      </div>

      {reportId ? (
        <ReportDownload reportId={reportId} />
      ) : (
        <div className="text-center py-20">
          <p className="text-gray-400">No report ID provided.</p>
          <a href="/review" className="text-[#FF7F11] text-sm font-medium mt-2 inline-block hover:underline">
            Start a new review
          </a>
        </div>
      )}
    </div>
  );
}

export default function ResultsPage() {
  return (
    <Suspense fallback={<div className="text-gray-400 p-10">Loading...</div>}>
      <ResultsContent />
    </Suspense>
  );
}
