'use client';

import { Download, FileText } from 'lucide-react';
import Button from './ui/Button';
import Card from './ui/Card';

interface ReportDownloadProps {
  reportId: string | null;
}

export default function ReportDownload({ reportId }: ReportDownloadProps) {
  if (!reportId) return null;

  const handleDownload = () => {
    window.open(`/api/reports/${reportId}`, '_blank');
  };

  return (
    <Card className="p-5">
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 rounded-lg bg-[#FF7F11]/10 flex items-center justify-center">
          <FileText className="w-6 h-6 text-[#FF7F11]" />
        </div>
        <div className="flex-1">
          <h3 className="text-sm font-semibold text-[#262626]">PDF Report Ready</h3>
          <p className="text-xs text-gray-500 mt-0.5">
            Download the full QA review report with screenshots and details.
          </p>
        </div>
        <Button onClick={handleDownload} size="md">
          <Download className="w-4 h-4" />
          Download PDF
        </Button>
      </div>
    </Card>
  );
}
