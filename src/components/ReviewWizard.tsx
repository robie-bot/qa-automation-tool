'use client';

import { useState, useCallback, useRef } from 'react';
import { ArrowLeft, ArrowRight, Check } from 'lucide-react';
import Button from './ui/Button';
import StepUrlInput from './StepUrlInput';
import StepReviewScope from './StepReviewScope';
import StepCategorySelect from './StepCategorySelect';
import StepPageSelect from './StepPageSelect';
import StepConfirmRun from './StepConfirmRun';
import ReviewProgress from './ReviewProgress';
import ResultsDashboard from './ResultsDashboard';
import ReportDownload from './ReportDownload';
import {
  ReviewState,
  ReviewScope,
  TestCategory,
  DiscoveredPage,
  ALL_CATEGORIES,
  DEFAULT_CONFIG,
  SSEEvent,
  ReviewSummary,
  TestIssue,
  CATEGORY_INFO,
} from '@/types';

type WizardPhase = 'wizard' | 'running' | 'results';

const STEP_LABELS = ['Target', 'Scope', 'Configure', 'Confirm'];

export default function ReviewWizard() {
  const [phase, setPhase] = useState<WizardPhase>('wizard');
  const [step, setStep] = useState(0);
  const abortRef = useRef<AbortController | null>(null);

  const [state, setState] = useState<ReviewState>({
    targetUrl: '',
    pages: [],
    scope: 'full',
    selectedCategories: [...ALL_CATEGORIES],
    selectedPages: [],
    referenceImage: null,
    contentDocument: null,
    contentDocumentName: null,
    searchTerms: [],
    config: { ...DEFAULT_CONFIG },
  });

  // Progress state
  const [percent, setPercent] = useState(0);
  const [currentMessage, setCurrentMessage] = useState('');
  const [categoryStatuses, setCategoryStatuses] = useState<Record<TestCategory, 'pending' | 'running' | 'done'>>({
    layout: 'pending',
    typography: 'pending',
    'color-scheme': 'pending',
    'broken-links': 'pending',
    pagespeed: 'pending',
    'content-check': 'pending',
    'text-finder': 'pending',
    'images-media': 'pending',
  });
  const [issueCount, setIssueCount] = useState({ errors: 0, warnings: 0 });
  const [events, setEvents] = useState<SSEEvent[]>([]);

  // Results state
  const [allIssues, setAllIssues] = useState<TestIssue[]>([]);
  const [summary, setSummary] = useState<ReviewSummary | null>(null);
  const [reportId, setReportId] = useState<string | null>(null);

  const handlePagesDiscovered = useCallback((url: string, pages: DiscoveredPage[]) => {
    setState((prev) => ({
      ...prev,
      targetUrl: url,
      pages,
      selectedPages: pages.map((p) => p.path),
    }));
    setStep(1);
  }, []);

  const handleScopeChange = useCallback((scope: ReviewScope) => {
    setState((prev) => {
      const newState = { ...prev, scope };
      if (scope === 'full') {
        newState.selectedCategories = [...ALL_CATEGORIES];
        newState.selectedPages = prev.pages.map((p) => p.path);
      }
      return newState;
    });
  }, []);

  const getSteps = useCallback(() => {
    const steps: number[] = [0, 1]; // URL input, scope selection

    if (state.scope === 'by-category' || state.scope === 'custom') {
      steps.push(2); // category selection
    }
    if (state.scope === 'by-page' || state.scope === 'custom') {
      steps.push(3); // page selection
    }

    steps.push(4); // confirm
    return steps;
  }, [state.scope]);

  const currentStepIndex = getSteps().indexOf(step);
  const totalSteps = getSteps().length;

  const canGoNext = () => {
    switch (step) {
      case 0: return state.pages.length > 0;
      case 1: return true;
      case 2: return state.selectedCategories.length > 0;
      case 3: return state.selectedPages.length > 0;
      default: return true;
    }
  };

  const goNext = () => {
    const steps = getSteps();
    const idx = steps.indexOf(step);
    if (idx < steps.length - 1) {
      setStep(steps[idx + 1]);
    }
  };

  const goBack = () => {
    const steps = getSteps();
    const idx = steps.indexOf(step);
    if (idx > 0) {
      setStep(steps[idx - 1]);
    }
  };

  const handleRun = async () => {
    setPhase('running');
    setPercent(0);
    setCurrentMessage('Starting review...');
    setEvents([]);
    setIssueCount({ errors: 0, warnings: 0 });
    setCategoryStatuses({
      layout: 'pending',
      typography: 'pending',
      'color-scheme': 'pending',
      'broken-links': 'pending',
      pagespeed: 'pending',
      'content-check': 'pending',
      'text-finder': 'pending',
      'images-media': 'pending',
    });

    const pages = state.scope === 'full' || state.scope === 'by-category'
      ? state.pages.map((p) => p.path)
      : state.selectedPages;

    const categories = state.scope === 'full' || state.scope === 'by-page'
      ? ALL_CATEGORIES
      : state.selectedCategories;

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const response = await fetch('/api/run-review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetUrl: state.targetUrl,
          pages,
          categories,
          referenceImage: state.referenceImage,
          contentDocument: state.contentDocument,
          searchTerms: state.searchTerms,
          config: state.config,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error('Failed to start review');
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('No response stream');

      const decoder = new TextDecoder();
      let buffer = '';
      const collectedIssues: TestIssue[] = [];

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const event: SSEEvent = JSON.parse(line.slice(6));
            setEvents((prev) => [...prev, event]);

            switch (event.type) {
              case 'progress':
                setPercent(event.percent);
                setCurrentMessage(event.message);
                setCategoryStatuses((prev) => ({
                  ...prev,
                  [event.category]: 'running',
                }));
                break;

              case 'issue':
                if (event.severity === 'error') {
                  setIssueCount((prev) => ({ ...prev, errors: prev.errors + 1 }));
                } else if (event.severity === 'warning') {
                  setIssueCount((prev) => ({ ...prev, warnings: prev.warnings + 1 }));
                }
                collectedIssues.push({
                  severity: event.severity,
                  message: event.message,
                  category: event.category,
                  pageUrl: event.page,
                  screenshot: event.screenshot,
                });
                break;

              case 'complete':
                setPercent(100);
                setSummary(event.summary);
                setReportId(event.reportId);
                setAllIssues(collectedIssues);
                setCategoryStatuses(
                  Object.fromEntries(categories.map((c) => [c, 'done'])) as Record<TestCategory, 'done'>
                );
                setTimeout(() => setPhase('results'), 500);
                break;

              case 'error':
                setCurrentMessage(`Error: ${event.message}`);
                break;
            }
          } catch {
            // Skip malformed events
          }
        }
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        setPhase('wizard');
        return;
      }
      setCurrentMessage(`Review failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleCancel = () => {
    abortRef.current?.abort();
    setPhase('wizard');
  };

  const handleRunAgain = () => {
    setPhase('wizard');
    setStep(0);
    setState({
      targetUrl: '',
      pages: [],
      scope: 'full',
      selectedCategories: [...ALL_CATEGORIES],
      selectedPages: [],
      referenceImage: null,
      contentDocument: null,
      contentDocumentName: null,
      searchTerms: [],
      config: { ...DEFAULT_CONFIG },
    });
  };

  // Render progress view
  if (phase === 'running') {
    return (
      <ReviewProgress
        percent={percent}
        currentMessage={currentMessage}
        categoryStatuses={categoryStatuses}
        issueCount={issueCount}
        events={events}
        onCancel={handleCancel}
      />
    );
  }

  // Render results view
  if (phase === 'results' && summary) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-[#262626]">Review Complete</h2>
            <p className="text-sm text-gray-500 mt-1">
              Reviewed {summary.pagesReviewed} pages in {Math.round(summary.duration / 1000)}s
            </p>
          </div>
          <Button variant="outline" onClick={handleRunAgain}>
            Run Again
          </Button>
        </div>

        <ReportDownload reportId={reportId} />
        <ResultsDashboard issues={allIssues} summary={summary} />
      </div>
    );
  }

  // Render wizard steps
  const stepLabels = ['Target', 'Scope'];
  if (state.scope === 'by-category' || state.scope === 'custom') stepLabels.push('Categories');
  if (state.scope === 'by-page' || state.scope === 'custom') stepLabels.push('Pages');
  stepLabels.push('Confirm');

  return (
    <div className="space-y-8">
      {/* Step indicator */}
      <div className="flex items-center gap-2">
        {stepLabels.map((label, idx) => {
          const isActive = idx === currentStepIndex;
          const isDone = idx < currentStepIndex;
          return (
            <div key={label} className="flex items-center gap-2">
              {idx > 0 && <div className={`w-8 h-0.5 ${isDone ? 'bg-[#FF7F11]' : 'bg-gray-200'}`} />}
              <div className="flex items-center gap-2">
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium ${
                    isDone
                      ? 'bg-[#FF7F11] text-white'
                      : isActive
                      ? 'bg-[#FF7F11]/10 text-[#FF7F11] border-2 border-[#FF7F11]'
                      : 'bg-gray-100 text-gray-400'
                  }`}
                >
                  {isDone ? <Check className="w-3.5 h-3.5" /> : idx + 1}
                </div>
                <span className={`text-xs font-medium hidden sm:block ${isActive ? 'text-[#262626]' : 'text-gray-400'}`}>
                  {label}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Step content */}
      <div className="min-h-[400px]">
        {step === 0 && <StepUrlInput onPagesDiscovered={handlePagesDiscovered} />}
        {step === 1 && (
          <StepReviewScope
            scope={state.scope}
            onScopeChange={handleScopeChange}
            pageCount={state.pages.length}
          />
        )}
        {step === 2 && (
          <StepCategorySelect
            selectedCategories={state.selectedCategories}
            onCategoriesChange={(cats) => setState((prev) => ({ ...prev, selectedCategories: cats }))}
          />
        )}
        {step === 3 && (
          <StepPageSelect
            pages={state.pages}
            selectedPages={state.selectedPages}
            onPagesChange={(pages) => setState((prev) => ({ ...prev, selectedPages: pages }))}
          />
        )}
        {step === 4 && (
          <StepConfirmRun
            reviewState={state}
            onRun={handleRun}
            onReferenceImageChange={(img) => setState((prev) => ({ ...prev, referenceImage: img }))}
            onContentDocumentChange={(doc, name) => setState((prev) => ({ ...prev, contentDocument: doc, contentDocumentName: name }))}
            onSearchTermsChange={(terms) => setState((prev) => ({ ...prev, searchTerms: terms }))}
            loading={false}
          />
        )}
      </div>

      {/* Navigation */}
      {step > 0 && step < 4 && (
        <div className="flex justify-between pt-4 border-t border-gray-100">
          <Button variant="ghost" onClick={goBack}>
            <ArrowLeft className="w-4 h-4" />
            Back
          </Button>
          <Button onClick={goNext} disabled={!canGoNext()}>
            Next
            <ArrowRight className="w-4 h-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
