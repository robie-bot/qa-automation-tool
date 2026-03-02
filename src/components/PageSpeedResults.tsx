'use client';

import { useState } from 'react';
import { Smartphone, Monitor, ChevronDown, ChevronRight, ExternalLink } from 'lucide-react';
import Card from './ui/Card';
import ScoreGauge from './ui/ScoreGauge';
import Badge from './ui/Badge';
import { PageSpeedData, PageSpeedStrategyResult, PageSpeedAudit } from '@/types';

interface PageSpeedResultsProps {
  results: PageSpeedData[];
}

function getMetricColor(score: number | null): string {
  if (score === null) return '#d1d5db';
  if (score < 0.5) return '#E53E3E';
  if (score < 0.9) return '#FF7F11';
  return '#22c55e';
}

function getMetricBadge(score: number | null): 'error' | 'warning' | 'success' | 'default' {
  if (score === null) return 'default';
  if (score < 0.5) return 'error';
  if (score < 0.9) return 'warning';
  return 'success';
}

function stripMarkdownLinks(text: string): string {
  return text.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
}

function AuditItem({ audit }: { audit: PageSpeedAudit }) {
  const [expanded, setExpanded] = useState(false);
  const color = getMetricColor(audit.score);

  if (audit.scoreDisplayMode === 'notApplicable' || audit.scoreDisplayMode === 'manual') {
    return null;
  }

  return (
    <div className="border-b border-gray-100 last:border-0">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 py-2.5 px-3 text-left hover:bg-gray-50 transition-colors"
      >
        <div
          className="w-2 h-2 rounded-full flex-shrink-0"
          style={{ backgroundColor: color }}
        />
        <span className="text-sm text-[#262626] flex-1">{audit.title}</span>
        {audit.displayValue && (
          <span className="text-xs text-gray-500 mr-2">{audit.displayValue}</span>
        )}
        {expanded
          ? <ChevronDown className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
          : <ChevronRight className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />}
      </button>
      {expanded && audit.description && (
        <div className="px-3 pb-3 pl-8">
          <p className="text-xs text-gray-500 leading-relaxed">
            {stripMarkdownLinks(audit.description)}
          </p>
        </div>
      )}
    </div>
  );
}

function AuditGroup({
  title,
  audits,
  defaultOpen = true,
  count,
}: {
  title: string;
  audits: PageSpeedAudit[];
  defaultOpen?: boolean;
  count?: number;
}) {
  const [open, setOpen] = useState(defaultOpen);

  if (audits.length === 0) return null;

  return (
    <Card className="p-0 overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-3 p-4 text-left hover:bg-gray-50 transition-colors"
      >
        {open
          ? <ChevronDown className="w-4 h-4 text-gray-400" />
          : <ChevronRight className="w-4 h-4 text-gray-400" />}
        <span className="text-sm font-semibold text-[#262626] flex-1">{title}</span>
        <Badge variant="default">{count ?? audits.length}</Badge>
      </button>
      {open && (
        <div className="border-t border-gray-100">
          {audits.map((audit) => (
            <AuditItem key={audit.id} audit={audit} />
          ))}
        </div>
      )}
    </Card>
  );
}

function StrategyView({ result }: { result: PageSpeedStrategyResult }) {
  const categoryOrder = ['performance', 'accessibility', 'best-practices', 'seo'];
  const categories = categoryOrder
    .map((id) => result.categories[id])
    .filter(Boolean);

  // Categorize audits from performance category auditRefs
  const perfCategory = result.categories['performance'];
  const auditRefGroups: Record<string, string[]> = {};
  if (perfCategory) {
    for (const ref of perfCategory.auditRefs) {
      const group = ref.group || 'other';
      if (!auditRefGroups[group]) auditRefGroups[group] = [];
      auditRefGroups[group].push(ref.id);
    }
  }

  // Also gather auditRefs from other categories
  for (const cat of Object.values(result.categories)) {
    if (cat.id === 'performance') continue;
    for (const ref of cat.auditRefs) {
      const group = ref.group || 'other';
      if (!auditRefGroups[group]) auditRefGroups[group] = [];
      if (!auditRefGroups[group].includes(ref.id)) {
        auditRefGroups[group].push(ref.id);
      }
    }
  }

  const getAuditsByGroup = (group: string, failing: boolean): PageSpeedAudit[] => {
    const ids = auditRefGroups[group] || [];
    return ids
      .map((id) => result.audits[id])
      .filter((a): a is PageSpeedAudit => {
        if (!a) return false;
        if (a.scoreDisplayMode === 'notApplicable' || a.scoreDisplayMode === 'manual') return false;
        if (failing) return a.score !== null && a.score < 0.9;
        return a.score === null || a.score >= 0.9;
      });
  };

  // Build audit groups
  const opportunities = getAuditsByGroup('load-opportunities', true);
  const diagnostics = getAuditsByGroup('diagnostics', true);

  // Passed audits: all audits scoring >= 0.9 across all categories
  const allReferencedIds = new Set<string>();
  for (const cat of Object.values(result.categories)) {
    for (const ref of cat.auditRefs) {
      allReferencedIds.add(ref.id);
    }
  }

  const passedAudits = Array.from(allReferencedIds)
    .map((id) => result.audits[id])
    .filter((a): a is PageSpeedAudit => {
      if (!a) return false;
      if (a.scoreDisplayMode === 'notApplicable' || a.scoreDisplayMode === 'manual' || a.scoreDisplayMode === 'informative') return false;
      return a.score !== null && a.score >= 0.9;
    });

  return (
    <div className="space-y-6">
      {/* Score gauges */}
      <Card className="p-6">
        <div className="flex items-center justify-center gap-6 sm:gap-10 flex-wrap">
          {categories.map((cat) => (
            <ScoreGauge key={cat.id} score={cat.score} label={cat.title} />
          ))}
        </div>
      </Card>

      {/* Core Web Vitals */}
      {result.metrics.length > 0 && (
        <Card className="p-5">
          <h3 className="text-sm font-semibold text-[#262626] mb-4">Core Web Vitals & Metrics</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {result.metrics.map((metric) => (
              <div key={metric.id} className="flex flex-col gap-1">
                <span className="text-xs text-gray-500">{metric.title}</span>
                <div className="flex items-center gap-2">
                  <span
                    className="text-lg font-semibold"
                    style={{ color: getMetricColor(metric.score) }}
                  >
                    {metric.displayValue || '—'}
                  </span>
                  <Badge variant={getMetricBadge(metric.score)}>
                    {metric.score !== null ? Math.round(metric.score * 100) : '?'}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Audit groups */}
      <div className="space-y-3">
        <AuditGroup
          title="Opportunities"
          audits={opportunities}
          defaultOpen={true}
        />
        <AuditGroup
          title="Diagnostics"
          audits={diagnostics}
          defaultOpen={true}
        />
        <AuditGroup
          title="Passed Audits"
          audits={passedAudits}
          defaultOpen={false}
        />
      </div>
    </div>
  );
}

export default function PageSpeedResults({ results }: PageSpeedResultsProps) {
  const [selectedPage, setSelectedPage] = useState(0);
  const [strategy, setStrategy] = useState<'mobile' | 'desktop'>('mobile');

  if (results.length === 0) return null;

  const currentData = results[selectedPage];
  const currentResult = strategy === 'mobile' ? currentData.mobile : currentData.desktop;

  return (
    <div className="space-y-4">
      {/* Controls row */}
      <div className="flex items-center gap-4 flex-wrap">
        {/* Page selector */}
        {results.length > 1 && (
          <select
            value={selectedPage}
            onChange={(e) => setSelectedPage(Number(e.target.value))}
            className="text-sm border border-gray-300 rounded-lg px-3 py-1.5 outline-none focus:border-[#FF7F11]"
          >
            {results.map((r, i) => (
              <option key={i} value={i}>
                {r.pageUrl}
              </option>
            ))}
          </select>
        )}

        {/* Strategy toggle */}
        <div className="flex items-center bg-gray-100 rounded-lg p-0.5">
          <button
            onClick={() => setStrategy('mobile')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              strategy === 'mobile'
                ? 'bg-white text-[#262626] shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <Smartphone className="w-4 h-4" />
            Mobile
          </button>
          <button
            onClick={() => setStrategy('desktop')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              strategy === 'desktop'
                ? 'bg-white text-[#262626] shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <Monitor className="w-4 h-4" />
            Desktop
          </button>
        </div>

        {/* Link to Google PSI */}
        <a
          href={`https://pagespeed.web.dev/analysis?url=${encodeURIComponent(currentData.pageUrl)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="ml-auto flex items-center gap-1 text-xs text-gray-400 hover:text-[#FF7F11] transition-colors"
        >
          View on PageSpeed Insights
          <ExternalLink className="w-3 h-3" />
        </a>
      </div>

      {/* Strategy result */}
      {currentResult ? (
        <StrategyView result={currentResult} />
      ) : (
        <Card className="p-8 text-center">
          <p className="text-gray-400 text-sm">
            No {strategy} data available for this page.
          </p>
        </Card>
      )}
    </div>
  );
}
