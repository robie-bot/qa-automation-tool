'use client';

import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { XCircle, AlertTriangle, Info, Filter, Download, ChevronDown, ChevronUp, FileDown, FileJson, ImageDown, Layers, Code, Keyboard, CheckCircle, XOctagon, Eye } from 'lucide-react';
import Card from './ui/Card';
import Badge from './ui/Badge';
import Tabs from './ui/Tabs';
import PageSpeedResults from './PageSpeedResults';
import { TestIssue, ReviewSummary, TestCategory, PageSpeedData, CATEGORY_INFO } from '@/types';
import { issuesToCSV, issuesToJSON, downloadString, downloadScreenshotsAsZip } from '@/lib/export-utils';
import { groupIssues, getFixSuggestion, IssueGroup } from '@/lib/issue-utils';
import useKeyboardShortcuts, { SHORTCUTS } from '@/hooks/useKeyboardShortcuts';
import { useTheme } from './ThemeProvider';

type IssueAnnotation = 'none' | 'false-positive' | 'acknowledged' | 'fixed';

interface ResultsDashboardProps {
  issues: TestIssue[];
  summary: ReviewSummary;
  pageSpeedResults?: PageSpeedData[];
}

export default function ResultsDashboard({ issues, summary, pageSpeedResults = [] }: ResultsDashboardProps) {
  const { theme, setTheme } = useTheme();
  const [activeTab, setActiveTab] = useState('all');
  const [severityFilter, setSeverityFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'flat' | 'grouped'>('flat');
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [focusedIssueIdx, setFocusedIssueIdx] = useState(-1);
  const [annotations, setAnnotations] = useState<Record<number, IssueAnnotation>>({});
  const [showFixFor, setShowFixFor] = useState<number | null>(null);
  const issueRefs = useRef<(HTMLDivElement | null)[]>([]);

  // Track expanded screenshots by original issue index
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
        // Filter out annotated-as-fixed if showing all
        const annotation = annotations[issue._origIdx];
        if (annotation === 'fixed') return false;
        return true;
      });
  }, [issues, activeTab, severityFilter, categoryFilter, annotations]);

  const issueGroups = useMemo(() => groupIssues(filteredIssues), [filteredIssues]);

  const screenshotCount = useMemo(() => issues.filter((i) => i.screenshot).length, [issues]);

  // Scroll focused issue into view
  useEffect(() => {
    if (focusedIssueIdx >= 0 && focusedIssueIdx < filteredIssues.length) {
      issueRefs.current[focusedIssueIdx]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [focusedIssueIdx, filteredIssues.length]);

  // Keyboard shortcuts
  useKeyboardShortcuts({
    onNextIssue: () => setFocusedIssueIdx((prev) => Math.min(prev + 1, filteredIssues.length - 1)),
    onPrevIssue: () => setFocusedIssueIdx((prev) => Math.max(prev - 1, 0)),
    onToggleScreenshot: () => {
      if (focusedIssueIdx >= 0 && focusedIssueIdx < filteredIssues.length) {
        toggleScreenshot(filteredIssues[focusedIssueIdx]._origIdx);
      }
    },
    onExpandAll: () => {
      const all = new Set<number>();
      issues.forEach((issue, idx) => { if (issue.screenshot) all.add(idx); });
      setExpandedScreenshots(all);
    },
    onCollapseAll: () => setExpandedScreenshots(new Set()),
    onFilterErrors: () => setActiveTab('error'),
    onFilterWarnings: () => setActiveTab('warning'),
    onFilterAll: () => setActiveTab('all'),
    onToggleDarkMode: () => setTheme(theme === 'dark' ? 'light' : theme === 'light' ? 'dark' : 'light'),
  });

  const setAnnotation = useCallback((origIdx: number, annotation: IssueAnnotation) => {
    setAnnotations((prev) => ({ ...prev, [origIdx]: annotation }));
  }, []);

  const severityIcon = (severity: string) => {
    switch (severity) {
      case 'error': return <XCircle className="w-4 h-4 text-[#E53E3E]" />;
      case 'warning': return <AlertTriangle className="w-4 h-4 text-[#FF7F11]" />;
      default: return <Info className="w-4 h-4 text-blue-500" />;
    }
  };

  const annotationBadge = (origIdx: number) => {
    const a = annotations[origIdx];
    if (!a || a === 'none') return null;
    const styles = {
      'false-positive': 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
      'acknowledged': 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
      'fixed': 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    };
    const labels = { 'false-positive': 'False Positive', 'acknowledged': 'Acknowledged', 'fixed': 'Fixed' };
    return (
      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${styles[a]}`}>
        {labels[a]}
      </span>
    );
  };

  const renderIssueCard = (issue: TestIssue & { _origIdx: number }, flatIdx: number) => {
    const origIdx = issue._origIdx;
    const isExpanded = expandedScreenshots.has(origIdx);
    const hasScreenshot = !!issue.screenshot;
    const isErrorOrWarning = issue.severity === 'error' || issue.severity === 'warning';
    const isFocused = focusedIssueIdx === flatIdx;
    const fixSuggestion = getFixSuggestion(issue);
    const showingFix = showFixFor === origIdx;

    return (
      <div
        key={origIdx}
        ref={(el) => { issueRefs.current[flatIdx] = el; }}
      >
        <Card className={`p-4 ${isErrorOrWarning && hasScreenshot ? 'border-l-4 ' + (issue.severity === 'error' ? 'border-l-[#E53E3E]' : 'border-l-[#FF7F11]') : ''} ${isFocused ? 'ring-2 ring-[#FF7F11]/40' : ''}`}>
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
                {annotationBadge(origIdx)}
                <span className="text-xs text-t-tertiary">{issue.pageUrl}</span>
                {issue.viewport && (
                  <span className="text-xs text-t-tertiary">@ {issue.viewport}</span>
                )}
              </div>
              <p className={`text-sm text-t-primary ${issue.category === 'ai-review' ? 'whitespace-pre-wrap' : ''}`}>{issue.message}</p>

              {/* Action row: screenshot + annotations + fix suggestion */}
              <div className="flex items-center gap-3 mt-2 flex-wrap">
                {hasScreenshot && (
                  <>
                    <button
                      onClick={() => toggleScreenshot(origIdx)}
                      className="flex items-center gap-1 text-xs text-t-secondary hover:text-t-primary transition-colors"
                    >
                      {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                      {isExpanded ? 'Collapse' : 'View'} Screenshot
                    </button>
                    <button
                      onClick={() => saveScreenshot(issue.screenshot!, origIdx, issue.category)}
                      className="flex items-center gap-1 text-xs text-t-secondary hover:text-[#FF7F11] transition-colors"
                    >
                      <Download className="w-3.5 h-3.5" />
                      Save
                    </button>
                  </>
                )}
                {fixSuggestion && (
                  <button
                    onClick={() => setShowFixFor(showingFix ? null : origIdx)}
                    className={`flex items-center gap-1 text-xs transition-colors ${showingFix ? 'text-[#FF7F11]' : 'text-t-secondary hover:text-[#FF7F11]'}`}
                  >
                    <Code className="w-3.5 h-3.5" />
                    Fix Suggestion
                  </button>
                )}

                {/* Annotation buttons */}
                <div className="flex items-center gap-1 ml-auto">
                  <button
                    onClick={() => setAnnotation(origIdx, annotations[origIdx] === 'false-positive' ? 'none' : 'false-positive')}
                    className={`p-1 rounded text-xs transition-colors ${annotations[origIdx] === 'false-positive' ? 'text-purple-600 bg-purple-50 dark:bg-purple-900/20' : 'text-t-tertiary hover:text-purple-600'}`}
                    title="Mark as false positive"
                  >
                    <XOctagon className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => setAnnotation(origIdx, annotations[origIdx] === 'acknowledged' ? 'none' : 'acknowledged')}
                    className={`p-1 rounded text-xs transition-colors ${annotations[origIdx] === 'acknowledged' ? 'text-yellow-600 bg-yellow-50 dark:bg-yellow-900/20' : 'text-t-tertiary hover:text-yellow-600'}`}
                    title="Acknowledge issue"
                  >
                    <Eye className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => setAnnotation(origIdx, annotations[origIdx] === 'fixed' ? 'none' : 'fixed')}
                    className={`p-1 rounded text-xs transition-colors ${annotations[origIdx] === 'fixed' ? 'text-green-600 bg-green-50 dark:bg-green-900/20' : 'text-t-tertiary hover:text-green-600'}`}
                    title="Mark as fixed (hides issue)"
                  >
                    <CheckCircle className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Fix suggestion code block */}
              {showingFix && fixSuggestion && (
                <div className="mt-3 bg-surface-secondary border border-b rounded-lg p-3 overflow-x-auto">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-t-secondary">Suggested Fix</span>
                    <button
                      onClick={() => navigator.clipboard.writeText(fixSuggestion)}
                      className="text-xs text-[#FF7F11] hover:underline"
                    >
                      Copy
                    </button>
                  </div>
                  <pre className="text-xs text-t-primary font-mono whitespace-pre-wrap">{fixSuggestion}</pre>
                </div>
              )}

              {/* Screenshot */}
              {hasScreenshot && isExpanded && (
                <div className="mt-3 rounded-lg overflow-hidden border border-b cursor-pointer" onClick={() => toggleScreenshot(origIdx)}>
                  <img
                    src={`data:image/jpeg;base64,${issue.screenshot}`}
                    alt="Issue screenshot"
                    className="w-full object-contain max-h-96"
                  />
                </div>
              )}
            </div>
          </div>
        </Card>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card className="p-4 text-center">
          <p className="text-3xl font-bold text-t-primary">{summary.totalIssues}</p>
          <p className="text-xs text-t-secondary mt-1">Total Issues</p>
        </Card>
        <Card className="p-4 text-center">
          <p className="text-3xl font-bold text-[#E53E3E]">{summary.errors}</p>
          <p className="text-xs text-t-secondary mt-1">Errors</p>
        </Card>
        <Card className="p-4 text-center">
          <p className="text-3xl font-bold text-[#FF7F11]">{summary.warnings}</p>
          <p className="text-xs text-t-secondary mt-1">Warnings</p>
        </Card>
        <Card className="p-4 text-center">
          <p className="text-3xl font-bold text-blue-500">{summary.infos}</p>
          <p className="text-xs text-t-secondary mt-1">Info</p>
        </Card>
      </div>

      {/* By category breakdown */}
      <Card className="p-5">
        <h3 className="text-sm font-semibold text-t-primary mb-4">Issues by Category</h3>
        <div className="space-y-3">
          {Object.entries(summary.byCategory).map(([cat, count]) => {
            const info = CATEGORY_INFO.find((c) => c.id === cat);
            const total = summary.totalIssues || 1;
            const pct = Math.round((count / total) * 100);
            return (
              <div key={cat} className="flex items-center gap-3">
                <span className="text-sm text-t-primary flex-1">{info?.name || cat}</span>
                <div className="w-32 h-2 bg-surface-secondary rounded-full overflow-hidden">
                  <div className="h-full bg-[#FF7F11] rounded-full" style={{ width: `${pct}%` }} />
                </div>
                <span className="text-sm font-medium text-t-primary w-8 text-right">{count}</span>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Export & view controls */}
      <div className="flex items-center gap-2 flex-wrap">
        <button
          onClick={() => downloadString(issuesToCSV(issues, summary), 'qa-review.csv', 'text/csv')}
          className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-b text-t-secondary hover:text-t-primary hover:bg-surface-secondary transition-colors"
        >
          <FileDown className="w-3.5 h-3.5" />
          Export CSV
        </button>
        <button
          onClick={() => downloadString(issuesToJSON(issues, summary), 'qa-review.json', 'application/json')}
          className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-b text-t-secondary hover:text-t-primary hover:bg-surface-secondary transition-colors"
        >
          <FileJson className="w-3.5 h-3.5" />
          Export JSON
        </button>
        {screenshotCount > 0 && (
          <button
            onClick={() => downloadScreenshotsAsZip(issues)}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-b text-t-secondary hover:text-t-primary hover:bg-surface-secondary transition-colors"
          >
            <ImageDown className="w-3.5 h-3.5" />
            Screenshots ZIP ({screenshotCount})
          </button>
        )}

        <div className="flex-1" />

        {/* View toggle: flat vs grouped */}
        <button
          onClick={() => setViewMode(viewMode === 'flat' ? 'grouped' : 'flat')}
          className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-colors ${
            viewMode === 'grouped'
              ? 'border-[#FF7F11] text-[#FF7F11] bg-[#FF7F11]/5'
              : 'border-b text-t-secondary hover:text-t-primary'
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          {viewMode === 'grouped' ? 'Grouped' : 'Flat'}
        </button>

        {/* Keyboard shortcuts toggle */}
        <button
          onClick={() => setShowShortcuts(!showShortcuts)}
          className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-colors ${
            showShortcuts
              ? 'border-[#FF7F11] text-[#FF7F11] bg-[#FF7F11]/5'
              : 'border-b text-t-secondary hover:text-t-primary'
          }`}
          title="Keyboard shortcuts"
        >
          <Keyboard className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Keyboard shortcuts panel */}
      {showShortcuts && (
        <Card className="p-4">
          <h4 className="text-xs font-semibold text-t-primary mb-3">Keyboard Shortcuts</h4>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {SHORTCUTS.map((s) => (
              <div key={s.key} className="flex items-center gap-2">
                <kbd className="inline-flex items-center justify-center w-6 h-6 rounded bg-surface-secondary border border-b text-xs font-mono text-t-primary">
                  {s.key}
                </kbd>
                <span className="text-xs text-t-secondary">{s.description}</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Tabs and filters */}
      <Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />

      <div className="flex gap-3">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-t-tertiary" />
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="text-sm border border-input-border bg-input-bg text-t-primary rounded-lg px-3 py-1.5 outline-none focus:border-[#FF7F11]"
          >
            <option value="all">All Categories</option>
            {CATEGORY_INFO.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
        {Object.values(annotations).some((a) => a === 'fixed') && (
          <span className="text-xs text-t-tertiary self-center">
            ({Object.values(annotations).filter((a) => a === 'fixed').length} fixed issues hidden)
          </span>
        )}
      </div>

      {/* Rich PageSpeed view when filtered to pagespeed */}
      {categoryFilter === 'pagespeed' && pageSpeedResults.length > 0 && (
        <PageSpeedResults results={pageSpeedResults} />
      )}

      {/* Issue list */}
      {!(categoryFilter === 'pagespeed' && pageSpeedResults.length > 0) && (
        <div className="space-y-2">
          {filteredIssues.length === 0 ? (
            <Card className="p-8 text-center">
              <p className="text-t-tertiary text-sm">No issues match the current filters.</p>
            </Card>
          ) : viewMode === 'grouped' ? (
            // Grouped view
            issueGroups.map((group) => (
              <GroupedIssueSection
                key={group.key}
                group={group}
                renderIssueCard={renderIssueCard}
                filteredIssues={filteredIssues}
              />
            ))
          ) : (
            // Flat view
            filteredIssues.map((issue, flatIdx) => renderIssueCard(issue, flatIdx))
          )}
        </div>
      )}
    </div>
  );
}

/** Collapsible grouped issue section */
function GroupedIssueSection({
  group,
  renderIssueCard,
  filteredIssues,
}: {
  group: IssueGroup;
  renderIssueCard: (issue: TestIssue & { _origIdx: number }, flatIdx: number) => React.ReactNode;
  filteredIssues: (TestIssue & { _origIdx: number })[];
}) {
  const [expanded, setExpanded] = useState(true);
  const severityColor = group.severity === 'error' ? 'text-[#E53E3E]' : group.severity === 'warning' ? 'text-[#FF7F11]' : 'text-blue-500';

  return (
    <div className="border border-b rounded-xl overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 px-4 py-3 bg-surface-secondary hover:bg-card-hover transition-colors text-left"
      >
        {expanded ? <ChevronUp className="w-4 h-4 text-t-tertiary" /> : <ChevronDown className="w-4 h-4 text-t-tertiary" />}
        <span className="text-sm font-medium text-t-primary flex-1">{group.label}</span>
        <span className={`text-xs font-medium ${severityColor}`}>{group.issues.length} issues</span>
      </button>
      {expanded && (
        <div className="space-y-2 p-2">
          {group.issues.map((issue) => {
            const flatIdx = filteredIssues.findIndex((fi) => fi._origIdx === issue._origIdx);
            return renderIssueCard(issue, flatIdx);
          })}
        </div>
      )}
    </div>
  );
}
