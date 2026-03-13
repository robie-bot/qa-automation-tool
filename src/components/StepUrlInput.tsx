'use client';

import { useState, useRef } from 'react';
import { Globe, Upload, Link2, Loader2, CheckCircle2, FileSearch } from 'lucide-react';
import Button from './ui/Button';
import Input from './ui/Input';
import Card from './ui/Card';
import { DiscoveredPage } from '@/types';

interface StepUrlInputProps {
  onPagesDiscovered: (url: string, pages: DiscoveredPage[]) => void;
}

export default function StepUrlInput({ onPagesDiscovered }: StepUrlInputProps) {
  const [url, setUrl] = useState('');
  const [sitemapUrl, setSitemapUrl] = useState('');
  const [inputMode, setInputMode] = useState<'url' | 'single' | 'sitemap-url' | 'sitemap-file'>('url');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [pagesFound, setPagesFound] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState('');
  const [sitemapContent, setSitemapContent] = useState('');

  const MAX_SITEMAP_SIZE = 5 * 1024 * 1024; // 5MB

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > MAX_SITEMAP_SIZE) {
      setError(`Sitemap too large (${(file.size / 1024 / 1024).toFixed(1)}MB). Maximum is 5MB.`);
      e.target.value = '';
      return;
    }

    setError('');
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (ev) => {
      setSitemapContent(ev.target?.result as string);
    };
    reader.readAsText(file);
  };

  const handleDiscover = async () => {
    setError('');
    setPagesFound(null);
    setLoading(true);

    // Single page mode — skip crawling entirely
    if (inputMode === 'single') {
      if (!url) {
        setError('Please enter a URL');
        setLoading(false);
        return;
      }
      let targetUrl = url.trim();
      if (!targetUrl.startsWith('http')) {
        targetUrl = `https://${targetUrl}`;
      }
      const parsedUrl = new URL(targetUrl);
      const page: DiscoveredPage = {
        url: targetUrl,
        title: parsedUrl.pathname === '/' ? 'Home' : parsedUrl.pathname,
        path: parsedUrl.pathname || '/',
      };
      setPagesFound(1);
      onPagesDiscovered(targetUrl, [page]);
      setLoading(false);
      return;
    }

    let targetUrl = url;
    let sitemap: string | undefined;

    if (inputMode === 'sitemap-url') {
      targetUrl = sitemapUrl;
    } else if (inputMode === 'sitemap-file') {
      if (!sitemapContent) {
        setError('Please upload a sitemap file');
        setLoading(false);
        return;
      }
      if (!url) {
        setError('Please enter the website URL');
        setLoading(false);
        return;
      }
      sitemap = sitemapContent;
    }

    if (!targetUrl) {
      setError('Please enter a URL');
      setLoading(false);
      return;
    }

    try {
      const response = await fetch('/api/discover-pages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: targetUrl,
          sitemapContent: sitemap,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to discover pages');
      }

      setPagesFound(data.count);
      onPagesDiscovered(targetUrl, data.pages);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to discover pages');
    } finally {
      setLoading(false);
    }
  };

  const modes = [
    { id: 'url' as const, label: 'Website URL', icon: Globe, desc: 'Crawl & discover all pages' },
    { id: 'single' as const, label: 'Single Page', icon: FileSearch, desc: 'Review only the pasted link' },
    { id: 'sitemap-url' as const, label: 'Sitemap URL', icon: Link2, desc: 'Paste a sitemap.xml URL' },
    { id: 'sitemap-file' as const, label: 'Upload Sitemap', icon: Upload, desc: 'Upload a sitemap.xml file' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-t-primary">Enter Target Website</h2>
        <p className="text-sm text-t-secondary mt-1">
          Provide a website URL, sitemap URL, or upload a sitemap file to discover pages.
        </p>
      </div>

      {/* Input mode selection */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {modes.map((mode) => (
          <Card
            key={mode.id}
            selected={inputMode === mode.id}
            hoverable
            onClick={() => setInputMode(mode.id)}
            className="p-4 text-center"
          >
            <mode.icon className={`w-5 h-5 mx-auto mb-2 ${inputMode === mode.id ? 'text-[#FF7F11]' : 'text-t-tertiary'}`} />
            <p className="text-sm font-medium text-t-primary">{mode.label}</p>
            <p className="text-xs text-t-tertiary mt-1">{mode.desc}</p>
          </Card>
        ))}
      </div>

      {/* Input fields */}
      <div className="space-y-4">
        {(inputMode === 'url' || inputMode === 'single') && (
          <Input
            label={inputMode === 'single' ? 'Page URL' : 'Website URL'}
            placeholder={inputMode === 'single' ? 'https://example.com/about' : 'https://example.com'}
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            error={error && !loading ? error : undefined}
          />
        )}

        {inputMode === 'sitemap-url' && (
          <Input
            label="Sitemap URL"
            placeholder="https://example.com/sitemap.xml"
            value={sitemapUrl}
            onChange={(e) => setSitemapUrl(e.target.value)}
            error={error && !loading ? error : undefined}
          />
        )}

        {inputMode === 'sitemap-file' && (
          <>
            <Input
              label="Website URL"
              placeholder="https://example.com"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
            />
            <div>
              <label className="block text-sm font-medium text-t-primary mb-1.5">
                Sitemap File
              </label>
              <div
                className="border-2 border-dashed border-input-border rounded-lg p-6 text-center cursor-pointer hover:border-[#FF7F11]/50 transition-colors"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="w-8 h-8 mx-auto text-t-tertiary mb-2" />
                {fileName ? (
                  <p className="text-sm text-t-primary font-medium">{fileName}</p>
                ) : (
                  <p className="text-sm text-t-secondary">Click to upload sitemap.xml</p>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xml"
                  className="hidden"
                  onChange={handleFileUpload}
                />
              </div>
              {error && !loading && (
                <p className="mt-1 text-xs text-[#E53E3E]">{error}</p>
              )}
            </div>
          </>
        )}
      </div>

      {/* Discover button */}
      <div className="flex items-center gap-4">
        <Button onClick={handleDiscover} loading={loading} size="lg">
          {loading
            ? (inputMode === 'single' ? 'Loading...' : 'Discovering Pages...')
            : (inputMode === 'single' ? 'Continue' : 'Discover Pages')
          }
        </Button>

        {pagesFound !== null && (
          <div className="flex items-center gap-2 text-[#5a7a4e]">
            <CheckCircle2 className="w-5 h-5" />
            <span className="text-sm font-medium">{pagesFound} pages found</span>
          </div>
        )}
      </div>

      {/* Loading indicator */}
      {loading && (
        <div className="flex items-center gap-3 p-4 bg-[#E2E8CE]/30 rounded-lg">
          <Loader2 className="w-5 h-5 animate-spin text-[#FF7F11]" />
          <span className="text-sm text-t-primary">
            Crawling website and discovering pages. This may take a moment...
          </span>
        </div>
      )}
    </div>
  );
}
