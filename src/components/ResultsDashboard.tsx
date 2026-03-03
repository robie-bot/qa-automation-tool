'use client';

import { useState, useMemo } from 'react';
import { XCircle, AlertTriangle, Info, Filter } from 'lucide-react';
import Card from './ui/Card';
import Badge from './ui/Badge';
import Tabs from './ui/Tabs';
import PageSpeedResults from './PageSpeedResults';
import { TestIssue, ReviewSummary, TestCategory, PageSpeedData, CATEGORY_INFO } from '@/types';

interface ResultsDashboardProps {
  issues: TestIssue[];
  summary: ReviewSummary;
  pageSpeedResults?: PageSpeedData[];
}

export default function ResultsDashboard({ issues, summary, pageSpeedResults = [] }: ResultsDashboardProps) {
  const [activeTab, setActiveTab] = useState('all');
  const [severityFilter, setSeverityFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  const aiReviewIssues = issues.filter((i) => i.category === 'ai-review');

  const tabs = [
    { id: 'all', label: 'All Issues', count: summary.totalIssues },
    { id: 'error', label: 'Errors', count: summary.errors },
    { id: 'warning', label: 'Warnings', count: summary.warnings },
    { id: 'info', label: 'Info', count: summary.infos },
    ...(aiReviewIssues.length > 0
      ? [{ id: 'ai-review', label: 'AI Review', count: aiReviewIssues.length }]
      : []),
  ];

  const filteredIssues = useMemo(() => {
    return issues.filter((issue) => {
      if (activeTab === 'ai-review') return issue.category === 'ai-review';
      if (activeTab !== 'all' && issue.severity !== activeTab) return false;
      if (severityFilter !== 'all' && issue.severity !== severityFilter) return false;
      if (categoryFilter !== 'all' && issue.category !== categoryFilter) return false;
      return true;
    });
  }, [issues, activeTab, severityFilter, categoryFilter]);

  const severityIcon = (severity: string) => {
    switch (severity) {
      case 'error': return <XCircle className="w-4 h-4 text-[#E53E3E]" />;
      case 'warning': return <AlertTriangle className="w-4 h-4 text-[#FF7F11]" />;
      default: return <Info className="w-4 h-4 text-blue-500" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card className="p-4 text-center">
          <p className="text-3xl font-bold text-[#262626]">{summary.totalIssues}</p>
          <p className="text-xs text-gray-500 mt-1">Total Issues</p>
        </Card>
        <Card className="p-4 text-center">
          <p className="text-3xl font-bold text-[#E53E3E]">{summary.errors}</p>
          <p className="text-xs text-gray-500 mt-1">Errors</p>
        </Card>
        <Card className="p-4 text-center">
          <p className="text-3xl font-bold text-[#FF7F11]">{summary.warnings}</p>
          <p className="text-xs text-gray-500 mt-1">Warnings</p>
        </Card>
        <Card className="p-4 text-center">
          <p className="text-3xl font-bold text-blue-500">{summary.infos}</p>
          <p className="text-xs text-gray-500 mt-1">Info</p>
        </Card>
      </div>

      {/* By category breakdown */}
      <Card className="p-5">
        <h3 className="text-sm font-semibold text-[#262626] mb-4">Issues by Category</h3>
        <div className="space-y-3">
          {Object.entries(summary.byCategory).map(([cat, count]) => {
            const info = CATEGORY_INFO.find((c) => c.id === cat);
            const total = summary.totalIssues || 1;
            const pct = Math.round((count / total) * 100);
            return (
              <div key={cat} className="flex items-center gap-3">
                <span className="text-sm text-[#262626] flex-1">{info?.name || cat}</span>
                <div className="w-32 h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[#FF7F11] rounded-full"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span className="text-sm font-medium text-[#262626] w-8 text-right">{count}</span>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Tabs and filters */}
      <Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />

      <div className="flex gap-3">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-gray-400" />
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="text-sm border border-gray-300 rounded-lg px-3 py-1.5 outline-none focus:border-[#FF7F11]"
          >
            <option value="all">All Categories</option>
            {CATEGORY_INFO.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Rich PageSpeed view when filtered to pagespeed */}
      {categoryFilter === 'pagespeed' && pageSpeedResults.length > 0 && (
        <PageSpeedResults results={pageSpeedResults} />
      )}

      {/* Issue list (hidden when showing rich pagespeed view) */}
      {!(categoryFilter === 'pagespeed' && pageSpeedResults.length > 0) && (
      <div className="space-y-2">
        {filteredIssues.length === 0 ? (
          <Card className="p-8 text-center">
            <p className="text-gray-400 text-sm">No issues match the current filters.</p>
          </Card>
        ) : (
          filteredIssues.map((issue, idx) => (
            <Card key={idx} className="p-4">
              <div className="flex items-start gap-3">
                {severityIcon(issue.severity)}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <Badge variant={issue.severity === 'error' ? 'error' : issue.severity === 'warning' ? 'warning' : 'info'}>
                      {issue.severity}
                    </Badge>
                    <Badge variant="default">
                      {CATEGORY_INFO.find((c) => c.id === issue.category)?.name || issue.category}
                    </Badge>
                    <span className="text-xs text-gray-400">{issue.pageUrl}</span>
                    {issue.viewport && (
                      <span className="text-xs text-gray-400">@ {issue.viewport}</span>
                    )}
                  </div>
                  <p className={`text-sm text-[#262626] ${issue.category === 'ai-review' ? 'whitespace-pre-wrap' : ''}`}>{issue.message}</p>
                  {issue.screenshot && (
                    <div className="mt-3 rounded-lg overflow-hidden border border-gray-200">
                      <img
                        src={`data:image/jpeg;base64,${issue.screenshot}`}
                        alt="Issue screenshot"
                        className="w-full max-h-48 object-cover"
                      />
                    </div>
                  )}
                </div>
              </div>
            </Card>
          ))
        )}
      </div>
      )}
    </div>
  );
}
