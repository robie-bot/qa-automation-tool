'use client';

import { Globe, Layers, FolderCheck, Clock, Upload } from 'lucide-react';
import Button from './ui/Button';
import Card from './ui/Card';
import { ReviewState, CATEGORY_INFO } from '@/types';
import { useRef, useState } from 'react';

interface StepConfirmRunProps {
  reviewState: ReviewState;
  onRun: () => void;
  onReferenceImageChange: (image: string | null) => void;
  loading: boolean;
}

export default function StepConfirmRun({
  reviewState,
  onRun,
  onReferenceImageChange,
  loading,
}: StepConfirmRunProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [refImageName, setRefImageName] = useState('');

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
    setRefImageName(file.name);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const result = ev.target?.result as string;
      // Remove data URL prefix to get just base64
      const base64 = result.split(',')[1];
      onReferenceImageChange(base64);
    };
    reader.readAsDataURL(file);
  };

  const showRefUpload = reviewState.selectedCategories.includes('color-scheme');

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-[#262626]">Review Summary</h2>
        <p className="text-sm text-gray-500 mt-1">
          Confirm the review configuration and start.
        </p>
      </div>

      <Card className="divide-y divide-gray-100">
        <div className="flex items-center gap-4 p-4">
          <div className="w-10 h-10 rounded-lg bg-[#FF7F11]/10 flex items-center justify-center">
            <Globe className="w-5 h-5 text-[#FF7F11]" />
          </div>
          <div className="flex-1">
            <p className="text-xs text-gray-500">Target Site</p>
            <p className="text-sm font-medium text-[#262626]">{reviewState.targetUrl}</p>
          </div>
        </div>

        <div className="flex items-center gap-4 p-4">
          <div className="w-10 h-10 rounded-lg bg-[#ACBFA4]/20 flex items-center justify-center">
            <Layers className="w-5 h-5 text-[#5a7a4e]" />
          </div>
          <div className="flex-1">
            <p className="text-xs text-gray-500">Pages to Test</p>
            <p className="text-sm font-medium text-[#262626]">{estimatedPages} pages</p>
          </div>
        </div>

        <div className="flex items-center gap-4 p-4">
          <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center">
            <FolderCheck className="w-5 h-5 text-blue-500" />
          </div>
          <div className="flex-1">
            <p className="text-xs text-gray-500">Categories</p>
            <p className="text-sm font-medium text-[#262626]">{categoryNames}</p>
          </div>
        </div>

        <div className="flex items-center gap-4 p-4">
          <div className="w-10 h-10 rounded-lg bg-purple-50 flex items-center justify-center">
            <Clock className="w-5 h-5 text-purple-500" />
          </div>
          <div className="flex-1">
            <p className="text-xs text-gray-500">Estimated Duration</p>
            <p className="text-sm font-medium text-[#262626]">~{estimatedMinutes} minutes</p>
          </div>
        </div>
      </Card>

      {/* Reference image upload for color scheme */}
      {showRefUpload && (
        <Card className="p-4">
          <div className="flex items-center gap-3 mb-3">
            <Upload className="w-4 h-4 text-gray-400" />
            <p className="text-sm font-medium text-[#262626]">Reference Image (Optional)</p>
          </div>
          <p className="text-xs text-gray-500 mb-3">
            Upload a reference image or design screenshot to compare colors against.
          </p>
          <div
            className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center cursor-pointer hover:border-[#FF7F11]/50 transition-colors"
            onClick={() => fileInputRef.current?.click()}
          >
            {refImageName ? (
              <p className="text-sm text-[#262626]">{refImageName}</p>
            ) : (
              <p className="text-sm text-gray-400">Click to upload reference image</p>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleRefImage}
            />
          </div>
        </Card>
      )}

      <Button onClick={onRun} loading={loading} size="lg" className="w-full">
        {loading ? 'Starting Review...' : 'Start Review'}
      </Button>
    </div>
  );
}
