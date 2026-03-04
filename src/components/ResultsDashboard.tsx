'use client';

import { useState, useMemo, useCallback } from 'react';
import { XCircle, AlertTriangle, Info, Filter, Download, ChevronDown, ChevronUp } from 'lucide-react';
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
  // Track expanded screenshots by original issue index (stable across filters)
  const [expandedScreenshots, setExpandedScreenshots] = useState<Set<number>>(() => {
    const initial = new Set<number>();
    issues.forEach((issue, idx) => {
      if ((issue.severity === 'error' || issue.severity === 'warning') && issue.screenshot) initial.add(idx);
    });
    return initial;
  });

  const toggleScreenshot = useCallback((issueOrigIdx: number) => {
    setExpandedScreenshots((prev) => {
      const next = new Set(prev);
      if (next.has(issueOrigIdx)) next.delete(issueOrigIdx);
      else next.add(issueOrigIdx);
      return next;
    });
  }, []);

  const saveScreenshot = useCallback((base64: string, issueOrigIdx: number, category: string) => {
    const link = document.createElement('a');
    link.href = `data:image/jpeg;base64,${base64}`;
    link.download = `screenshot-${category}-${issueOrigIdx + 1}.jpg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, []);

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

  // Keep original index for stable screenshot expand/collapse tracking
  const filteredIssues = useMemo(() => {
    return issues
      .map((issue, origIdx) => ({ ...issue, _origIdx: origIdx }))
      .filter((issue) => {
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
          filteredIssues.map((issue) => {
            const origIdx = issue._origIdx;
            const isExpanded = expandedScreenshots.has(origIdx);
            const hasScreenshot = !!issue.screenshot;
            const isErrorOrWarning = issue.severity === 'error' || issue.severity === 'warning';

            return (
            <Card key={origIdx} className={`p-4 ${isErrorOrWarning && hasScreenshot ? 'border-l-4 ' + (issue.severity === 'error' ? 'border-l-[#E53E3E]' : 'border-l-[#FF7F11]') : ''}`}>
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
                  {hasScreenshot && (
                    <div className="mt-3">
                      <div className="flex items-center gap-2 mb-2">
                        <button
                          onClick={() => toggleScreenshot(origIdx)}
                          className="flex items-center gap-1 text-xs text-gray-500 hover:text-[#262626] transition-colors"
                        >
                          {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                          {isExpanded ? 'Collapse' : 'View'} Screenshot
                        </button>
                        <button
                          onClick={() => saveScreenshot(issue.screenshot!, origIdx, issue.category)}
                          className="flex items-center gap-1 text-xs text-gray-500 hover:text-[#FF7F11] transition-colors"
                        >
                          <Download className="w-3.5 h-3.5" />
                          Save
                        </button>
                      </div>
                      {isExpanded && (
                        <div className="rounded-lg overflow-hidden border border-gray-200 cursor-pointer" onClick={() => toggleScreenshot(origIdx)}>
                          <img
                            src={`data:image/jpeg;base64,${issue.screenshot}`}
                            alt="Issue screenshot"
                            className="w-full object-contain max-h-96"
                          />
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </Card>
            );
          })
        )}
      </div>
      )}
    </div>
  );
}
