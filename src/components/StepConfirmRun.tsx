'use client';

import { Globe, Layers, FolderCheck, Clock, Upload, FileCheck, Search, X, Plus, Sparkles } from 'lucide-react';
import Button from './ui/Button';
import Card from './ui/Card';
import { ReviewState, CATEGORY_INFO, AIProvider } from '@/types';

const AI_PROVIDER_LABELS: Record<AIProvider, { name: string; envVar: string }> = {
  claude: { name: 'Claude (Anthropic)', envVar: 'ANTHROPIC_API_KEY' },
  openai: { name: 'GPT (OpenAI)', envVar: 'OPENAI_API_KEY' },
  gemini: { name: 'Gemini (Google)', envVar: 'GEMINI_API_KEY' },
  ollama: { name: 'Ollama (Local)', envVar: 'OLLAMA_MODEL' },
};
import { useRef, useState } from 'react';

interface StepConfirmRunProps {
  reviewState: ReviewState;
  onRun: () => void;
  onReferenceImageChange: (image: string | null) => void;
  onContentDocumentChange: (doc: string | null, name: string | null) => void;
  onSearchTermsChange: (terms: string[]) => void;
  loading: boolean;
}

export default function StepConfirmRun({
  reviewState,
  onRun,
  onReferenceImageChange,
  onContentDocumentChange,
  onSearchTermsChange,
  loading,
}: StepConfirmRunProps) {
  const refImageInputRef = useRef<HTMLInputElement>(null);
  const docInputRef = useRef<HTMLInputElement>(null);
  const [refImageName, setRefImageName] = useState('');
  const [newTerm, setNewTerm] = useState('');
  const [uploadError, setUploadError] = useState('');

  const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB
  const MAX_DOC_SIZE = 20 * 1024 * 1024; // 20MB

  const categoryNames = reviewState.selectedCategories
    .map((id) => CATEGORY_INFO.find((c) => c.id === id)?.name || id)
    .join(', ');

  const estimatedPages = reviewState.selectedPages.length || reviewState.pages.length;
  const estimatedMinutes = Math.ceil(
    estimatedPages * reviewState.selectedCategories.length * 0.5
  );

  const handleRefImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadError('');

    if (file.size > MAX_IMAGE_SIZE) {
      setUploadError(`Image too large (${(file.size / 1024 / 1024).toFixed(1)}MB). Maximum is 10MB.`);
      e.target.value = '';
      return;
    }

    setRefImageName(file.name);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const result = ev.target?.result as string;
      const base64 = result.split(',')[1];
      onReferenceImageChange(base64);
    };
    reader.readAsDataURL(file);
  };

  const handleDocUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadError('');

    if (file.size > MAX_DOC_SIZE) {
      setUploadError(`Document too large (${(file.size / 1024 / 1024).toFixed(1)}MB). Maximum is 20MB.`);
      e.target.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = (ev) => {
      const result = ev.target?.result as ArrayBuffer;
      const base64 = Buffer.from(result).toString('base64');
      onContentDocumentChange(base64, file.name);
    };
    reader.readAsArrayBuffer(file);
  };

  const addTerm = () => {
    const trimmed = newTerm.trim();
    if (trimmed && !reviewState.searchTerms.includes(trimmed)) {
      onSearchTermsChange([...reviewState.searchTerms, trimmed]);
      setNewTerm('');
    }
  };

  const removeTerm = (term: string) => {
    onSearchTermsChange(reviewState.searchTerms.filter((t) => t !== term));
  };

  const handleTermKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addTerm();
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const text = e.clipboardData.getData('text');
    // If pasting multi-line text, add each line as a separate term
    if (text.includes('\n')) {
      e.preventDefault();
      const lines = text.split('\n').map((l) => l.trim()).filter((l) => l.length > 0);
      const existing = new Set(reviewState.searchTerms);
      const newTerms = lines.filter((l) => !existing.has(l));
      onSearchTermsChange([...reviewState.searchTerms, ...newTerms]);
    }
  };

  const showRefUpload = reviewState.selectedCategories.includes('color-scheme');
  const showContentDoc = reviewState.selectedCategories.includes('content-check');
  const showTextFinder = reviewState.selectedCategories.includes('text-finder');
  const showAIReview = reviewState.selectedCategories.includes('ai-review');

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-t-primary">Review Summary</h2>
        <p className="text-sm text-t-secondary mt-1">
          Confirm the review configuration and start.
        </p>
      </div>

      <Card className="divide-y divide-b-light">
        <div className="flex items-center gap-4 p-4">
          <div className="w-10 h-10 rounded-lg bg-[#FF7F11]/10 flex items-center justify-center">
            <Globe className="w-5 h-5 text-[#FF7F11]" />
          </div>
          <div className="flex-1">
            <p className="text-xs text-t-secondary">Target Site</p>
            <p className="text-sm font-medium text-t-primary">{reviewState.targetUrl}</p>
          </div>
        </div>

        <div className="flex items-center gap-4 p-4">
          <div className="w-10 h-10 rounded-lg bg-[#ACBFA4]/20 flex items-center justify-center">
            <Layers className="w-5 h-5 text-[#5a7a4e]" />
          </div>
          <div className="flex-1">
            <p className="text-xs text-t-secondary">Pages to Test</p>
            <p className="text-sm font-medium text-t-primary">{estimatedPages} pages</p>
          </div>
        </div>

        <div className="flex items-center gap-4 p-4">
          <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center">
            <FolderCheck className="w-5 h-5 text-blue-500" />
          </div>
          <div className="flex-1">
            <p className="text-xs text-t-secondary">Categories</p>
            <p className="text-sm font-medium text-t-primary">{categoryNames}</p>
          </div>
        </div>

        <div className="flex items-center gap-4 p-4">
          <div className="w-10 h-10 rounded-lg bg-purple-50 flex items-center justify-center">
            <Clock className="w-5 h-5 text-purple-500" />
          </div>
          <div className="flex-1">
            <p className="text-xs text-t-secondary">Estimated Duration</p>
            <p className="text-sm font-medium text-t-primary">~{estimatedMinutes} minutes</p>
          </div>
        </div>
      </Card>

      {/* Reference image upload for color scheme */}
      {showRefUpload && (
        <Card className="p-4">
          <div className="flex items-center gap-3 mb-3">
            <Upload className="w-4 h-4 text-t-tertiary" />
            <p className="text-sm font-medium text-t-primary">Reference Image (Optional)</p>
          </div>
          <p className="text-xs text-t-secondary mb-3">
            Upload a reference image or design screenshot to compare colors against.
          </p>
          <div
            className="border-2 border-dashed border-input-border rounded-lg p-4 text-center cursor-pointer hover:border-[#FF7F11]/50 transition-colors"
            onClick={() => refImageInputRef.current?.click()}
          >
            {refImageName ? (
              <p className="text-sm text-t-primary">{refImageName}</p>
            ) : (
              <p className="text-sm text-t-tertiary">Click to upload reference image</p>
            )}
            <input
              ref={refImageInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleRefImage}
            />
          </div>
        </Card>
      )}

      {/* Content document upload for content cross-check */}
      {showContentDoc && (
        <Card className="p-4">
          <div className="flex items-center gap-3 mb-3">
            <FileCheck className="w-4 h-4 text-t-tertiary" />
            <p className="text-sm font-medium text-t-primary">Content Document</p>
          </div>
          <p className="text-xs text-t-secondary mb-3">
            Upload a document file. Its content will be checked against each page to verify
            that key text, paragraphs, and sentences appear on the website.
          </p>
          <div
            className="border-2 border-dashed border-input-border rounded-lg p-4 text-center cursor-pointer hover:border-[#FF7F11]/50 transition-colors"
            onClick={() => docInputRef.current?.click()}
          >
            {reviewState.contentDocumentName ? (
              <div className="flex items-center justify-center gap-2">
                <FileCheck className="w-4 h-4 text-[#5a7a4e]" />
                <p className="text-sm text-t-primary font-medium">{reviewState.contentDocumentName}</p>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onContentDocumentChange(null, null);
                  }}
                  className="ml-2 text-t-tertiary hover:text-[#E53E3E] transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <>
                <Upload className="w-6 h-6 mx-auto text-t-tertiary mb-1" />
                <p className="text-sm text-t-tertiary">Click to upload a document</p>
                <p className="text-xs text-t-muted mt-1">.pdf, .docx, .odt, .txt, .md supported</p>
              </>
            )}
            <input
              ref={docInputRef}
              type="file"
              accept=".pdf,.docx,.odt,.txt,.text,.md,.csv"
              className="hidden"
              onChange={handleDocUpload}
            />
          </div>
        </Card>
      )}

      {/* Search terms input for text finder */}
      {showTextFinder && (
        <Card className="p-4">
          <div className="flex items-center gap-3 mb-3">
            <Search className="w-4 h-4 text-t-tertiary" />
            <p className="text-sm font-medium text-t-primary">Search Terms</p>
          </div>
          <p className="text-xs text-t-secondary mb-3">
            Add words, sentences, or paragraphs to search for across all pages.
            Press Enter to add each term. Paste multi-line text to add multiple at once.
          </p>

          {/* Input area */}
          <div className="flex gap-2 mb-3">
            <textarea
              value={newTerm}
              onChange={(e) => setNewTerm(e.target.value)}
              onKeyDown={handleTermKeyDown}
              onPaste={handlePaste}
              placeholder="Type a word, sentence, or paragraph..."
              rows={2}
              className="flex-1 rounded-lg border border-input-border px-3 py-2 text-sm text-t-primary placeholder:text-t-tertiary outline-none focus:border-[#FF7F11] focus:ring-2 focus:ring-[#FF7F11]/20 resize-none transition-all"
            />
            <Button onClick={addTerm} size="sm" className="self-end">
              <Plus className="w-4 h-4" />
              Add
            </Button>
          </div>

          {/* Term list */}
          {reviewState.searchTerms.length > 0 && (
            <div className="space-y-1.5 max-h-48 overflow-y-auto">
              {reviewState.searchTerms.map((term, idx) => (
                <div
                  key={idx}
                  className="flex items-start gap-2 bg-surface-secondary rounded-lg px-3 py-2 group"
                >
                  <span className="text-xs text-t-tertiary font-mono mt-0.5 flex-shrink-0">
                    {idx + 1}.
                  </span>
                  <p className="text-sm text-t-primary flex-1 break-words">
                    {term.length > 120 ? term.substring(0, 120) + '...' : term}
                  </p>
                  <button
                    onClick={() => removeTerm(term)}
                    className="text-t-muted hover:text-[#E53E3E] transition-colors flex-shrink-0 mt-0.5"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
              <p className="text-xs text-t-tertiary pt-1">
                {reviewState.searchTerms.length} search term{reviewState.searchTerms.length !== 1 ? 's' : ''} added
              </p>
            </div>
          )}

          {reviewState.searchTerms.length === 0 && (
            <p className="text-xs text-[#FF7F11]">Add at least one search term.</p>
          )}
        </Card>
      )}

      {/* AI Review config */}
      {showAIReview && (() => {
        const providerInfo = AI_PROVIDER_LABELS[reviewState.config.aiProvider];
        return (
          <Card className="p-4">
            <div className="flex items-center gap-3 mb-3">
              <Sparkles className="w-4 h-4 text-[#FF7F11]" />
              <p className="text-sm font-medium text-t-primary">AI Review</p>
            </div>
            <p className="text-xs text-t-secondary mb-3">
              {providerInfo.name} will analyze all test results to provide expert QA insights, prioritization, and recommendations.
            </p>
            <div className="flex items-center gap-4 text-xs text-t-secondary">
              <span>Provider: <strong className="text-t-primary">{providerInfo.name}</strong></span>
              <span>Vision Mode: <strong className="text-t-primary">{reviewState.config.aiReviewVision ? 'Enabled' : 'Disabled'}</strong></span>
            </div>
            <p className="text-xs text-t-tertiary mt-2">
              {reviewState.config.aiProvider === 'ollama'
                ? 'Ollama must be running locally (default model: llama3.2)'
                : `Requires ${providerInfo.envVar} environment variable`}
            </p>
          </Card>
        );
      })()}

      {uploadError && (
        <div className="bg-red-50 text-red-600 text-sm px-4 py-3 rounded-lg">
          {uploadError}
        </div>
      )}

      <Button onClick={onRun} loading={loading} size="lg" className="w-full">
        {loading ? 'Starting Review...' : 'Start Review'}
      </Button>
    </div>
  );
}
