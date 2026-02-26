'use client';

import { CheckCircle2, Loader2, Clock, XCircle, AlertTriangle } from 'lucide-react';
import Progress from './ui/Progress';
import Card from './ui/Card';
import Badge from './ui/Badge';
import Button from './ui/Button';
import { TestCategory, CATEGORY_INFO, SSEEvent } from '@/types';

interface ReviewProgressProps {
  percent: number;
  currentMessage: string;
  categoryStatuses: Record<TestCategory, 'pending' | 'running' | 'done'>;
  issueCount: { errors: number; warnings: number };
  events: SSEEvent[];
  onCancel: () => void;
}

export default function ReviewProgress({
  percent,
  currentMessage,
  categoryStatuses,
  issueCount,
  events,
  onCancel,
}: ReviewProgressProps) {
  const statusIcon = (status: 'pending' | 'running' | 'done') => {
    switch (status) {
      case 'done':
        return <CheckCircle2 className="w-4 h-4 text-[#5a7a4e]" />;
      case 'running':
        return <Loader2 className="w-4 h-4 text-[#FF7F11] animate-spin" />;
      case 'pending':
        return <Clock className="w-4 h-4 text-gray-300" />;
    }
  };

  const recentIssues = events
    .filter((e): e is Extract<SSEEvent, { type: 'issue' }> => e.type === 'issue')
    .slice(-5)
    .reverse();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-[#262626]">Review in Progress</h2>
        <p className="text-sm text-gray-500 mt-1">{currentMessage}</p>
      </div>

      {/* Overall progress */}
      <Card className="p-5">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-medium text-[#262626]">Overall Progress</span>
          <span className="text-sm text-gray-500">{percent}%</span>
        </div>
        <Progress value={percent} size="lg" />
      </Card>

      {/* Category statuses */}
      <Card className="p-5">
        <h3 className="text-sm font-semibold text-[#262626] mb-4">Test Categories</h3>
        <div className="space-y-3">
          {CATEGORY_INFO.map((cat) => {
            const status = categoryStatuses[cat.id] || 'pending';
            return (
              <div key={cat.id} className="flex items-center gap-3">
                {statusIcon(status)}
                <span className={`text-sm flex-1 ${status === 'running' ? 'text-[#262626] font-medium' : 'text-gray-500'}`}>
                  {cat.name}
                </span>
                <span className="text-xs text-gray-400">
                  {status === 'done' ? 'Complete' : status === 'running' ? 'Running...' : 'Pending'}
                </span>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Live issue counter */}
      <div className="flex gap-4">
        <Card className="flex-1 p-4 text-center">
          <div className="flex items-center justify-center gap-2 mb-1">
            <XCircle className="w-4 h-4 text-[#E53E3E]" />
            <span className="text-2xl font-bold text-[#E53E3E]">{issueCount.errors}</span>
          </div>
          <p className="text-xs text-gray-500">Errors</p>
        </Card>
        <Card className="flex-1 p-4 text-center">
          <div className="flex items-center justify-center gap-2 mb-1">
            <AlertTriangle className="w-4 h-4 text-[#FF7F11]" />
            <span className="text-2xl font-bold text-[#FF7F11]">{issueCount.warnings}</span>
          </div>
          <p className="text-xs text-gray-500">Warnings</p>
        </Card>
      </div>

      {/* Recent issues */}
      {recentIssues.length > 0 && (
        <Card className="p-5">
          <h3 className="text-sm font-semibold text-[#262626] mb-3">Recent Issues</h3>
          <div className="space-y-2">
            {recentIssues.map((issue, idx) => (
              <div key={idx} className="flex items-start gap-2 text-sm">
                <Badge variant={issue.severity === 'error' ? 'error' : 'warning'}>
                  {issue.severity}
                </Badge>
                <span className="text-gray-600 text-xs flex-1">{issue.message}</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Button variant="outline" onClick={onCancel} className="w-full">
        Cancel Review
      </Button>
    </div>
  );
}
