'use client';

import { Layout, Type, Palette, Link, Gauge, FileCheck, Search, Image, Sparkles } from 'lucide-react';
import Card from './ui/Card';
import Checkbox from './ui/Checkbox';
import { TestCategory, AIProvider, CATEGORY_INFO } from '@/types';

const AI_PROVIDER_OPTIONS: { value: AIProvider; label: string }[] = [
  { value: 'claude', label: 'Claude (Anthropic)' },
  { value: 'openai', label: 'GPT (OpenAI)' },
  { value: 'gemini', label: 'Gemini (Google)' },
  { value: 'ollama', label: 'Ollama (Local)' },
];

const AI_PROVIDER_ENV_VARS: Record<AIProvider, string> = {
  claude: 'ANTHROPIC_API_KEY',
  openai: 'OPENAI_API_KEY',
  gemini: 'GEMINI_API_KEY',
  ollama: 'OLLAMA_MODEL',
};

interface StepCategorySelectProps {
  selectedCategories: TestCategory[];
  onCategoriesChange: (categories: TestCategory[]) => void;
  aiReviewVision: boolean;
  onAIReviewVisionChange: (v: boolean) => void;
  aiProvider: AIProvider;
  onAIProviderChange: (provider: AIProvider) => void;
}

const ICONS: Record<string, React.ElementType> = {
  Layout,
  Type,
  Palette,
  LinkIcon: Link,
  Gauge,
  FileCheck,
  Search,
  Image,
  Sparkles,
};

export default function StepCategorySelect({
  selectedCategories,
  onCategoriesChange,
  aiReviewVision,
  onAIReviewVisionChange,
  aiProvider,
  onAIProviderChange,
}: StepCategorySelectProps) {
  const allSelected = selectedCategories.length === CATEGORY_INFO.length;

  const toggleAll = () => {
    if (allSelected) {
      onCategoriesChange([]);
    } else {
      onCategoriesChange(CATEGORY_INFO.map((c) => c.id));
    }
  };

  const toggleCategory = (id: TestCategory) => {
    if (selectedCategories.includes(id)) {
      onCategoriesChange(selectedCategories.filter((c) => c !== id));
    } else {
      onCategoriesChange([...selectedCategories, id]);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-[#262626]">Select Test Categories</h2>
          <p className="text-sm text-gray-500 mt-1">
            Choose which test categories to run.
          </p>
        </div>
        <button
          onClick={toggleAll}
          className="text-sm font-medium text-[#FF7F11] hover:text-[#e6720f] transition-colors"
        >
          {allSelected ? 'Deselect All' : 'Select All'}
        </button>
      </div>

      <div className="space-y-3">
        {CATEGORY_INFO.map((category) => {
          const Icon = ICONS[category.icon] || Layout;
          const isSelected = selectedCategories.includes(category.id);

          return (
            <Card
              key={category.id}
              selected={isSelected}
              hoverable
              onClick={() => toggleCategory(category.id)}
              className="p-4"
            >
              <div className="flex items-center gap-4">
                <Checkbox
                  checked={isSelected}
                  onChange={() => toggleCategory(category.id)}
                />
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                  isSelected ? 'bg-[#FF7F11]/10 text-[#FF7F11]' : 'bg-gray-100 text-gray-400'
                }`}>
                  <Icon className="w-5 h-5" />
                </div>
                <div className="flex-1">
                  <h3 className="text-sm font-semibold text-[#262626]">{category.name}</h3>
                  <p className="text-xs text-gray-500 mt-0.5">{category.description}</p>
                </div>
                <span className="text-xs text-gray-400 whitespace-nowrap">{category.estimatedTime}</span>
              </div>
            </Card>
          );
        })}

        {selectedCategories.includes('ai-review') && (
          <Card className="p-4 ml-14 border-dashed">
            <div className="mb-3">
              <label className="block text-sm font-medium text-[#262626] mb-1">AI Provider</label>
              <select
                value={aiProvider}
                onChange={(e) => onAIProviderChange(e.target.value as AIProvider)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-[#262626] outline-none focus:border-[#FF7F11] focus:ring-2 focus:ring-[#FF7F11]/20 transition-all bg-white"
              >
                {AI_PROVIDER_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
            <Checkbox
              checked={aiReviewVision}
              onChange={(e) => onAIReviewVisionChange(e.target.checked)}
              label="Vision Mode"
              description="Send screenshots to AI for visual analysis (uses more tokens)"
            />
            <p className="text-xs text-gray-400 mt-2 ml-8">
              {aiProvider === 'ollama'
                ? 'Ollama must be running locally. Set OLLAMA_MODEL to choose a model (default: llama3.2)'
                : `Requires ${AI_PROVIDER_ENV_VARS[aiProvider]} environment variable`}
            </p>
          </Card>
        )}
      </div>

      {selectedCategories.length === 0 && (
        <p className="text-sm text-[#E53E3E]">Please select at least one category.</p>
      )}
    </div>
  );
}
