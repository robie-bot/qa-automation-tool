'use client';

import { Search, FolderOpen, FileText, Settings } from 'lucide-react';
import Card from './ui/Card';
import { ReviewScope } from '@/types';

interface StepReviewScopeProps {
  scope: ReviewScope;
  onScopeChange: (scope: ReviewScope) => void;
  pageCount: number;
}

export default function StepReviewScope({ scope, onScopeChange, pageCount }: StepReviewScopeProps) {
  const options = [
    {
      id: 'full' as const,
      icon: Search,
      emoji: '\uD83D\uDD0D',
      title: 'Full Review',
      description: `Run all test categories on all ${pageCount} discovered pages`,
    },
    {
      id: 'by-category' as const,
      icon: FolderOpen,
      emoji: '\uD83D\uDCC2',
      title: 'Review by Category',
      description: 'Choose specific test categories to run on all pages',
    },
    {
      id: 'by-page' as const,
      icon: FileText,
      emoji: '\uD83D\uDCC4',
      title: 'Review by Page',
      description: 'Choose specific pages to review with all test categories',
    },
    {
      id: 'custom' as const,
      icon: Settings,
      emoji: '\u2699\uFE0F',
      title: 'Custom Review',
      description: 'Choose specific categories AND specific pages',
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-t-primary">Choose Review Scope</h2>
        <p className="text-sm text-t-secondary mt-1">
          Select how you want to scope this review.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {options.map((option) => (
          <Card
            key={option.id}
            selected={scope === option.id}
            hoverable
            onClick={() => onScopeChange(option.id)}
            className="p-5"
          >
            <div className="flex items-start gap-4">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-lg ${
                scope === option.id ? 'bg-[#FF7F11]/10' : 'bg-surface-secondary'
              }`}>
                {option.emoji}
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-semibold text-t-primary">{option.title}</h3>
                <p className="text-xs text-t-secondary mt-1">{option.description}</p>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
