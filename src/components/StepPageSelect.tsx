'use client';

import { useState, useMemo } from 'react';
import { Search } from 'lucide-react';
import Card from './ui/Card';
import Checkbox from './ui/Checkbox';
import { DiscoveredPage } from '@/types';
import { groupByPathSegment } from '@/lib/utils';

interface StepPageSelectProps {
  pages: DiscoveredPage[];
  selectedPages: string[];
  onPagesChange: (pages: string[]) => void;
}

export default function StepPageSelect({
  pages,
  selectedPages,
  onPagesChange,
}: StepPageSelectProps) {
  const [search, setSearch] = useState('');

  const filteredPages = useMemo(() => {
    if (!search) return pages;
    const lower = search.toLowerCase();
    return pages.filter(
      (p) =>
        p.path.toLowerCase().includes(lower) ||
        p.title.toLowerCase().includes(lower) ||
        p.url.toLowerCase().includes(lower)
    );
  }, [pages, search]);

  const grouped = useMemo(() => groupByPathSegment(filteredPages), [filteredPages]);

  const allSelected = selectedPages.length === pages.length;

  const toggleAll = () => {
    if (allSelected) {
      onPagesChange([]);
    } else {
      onPagesChange(pages.map((p) => p.path));
    }
  };

  const togglePage = (path: string) => {
    if (selectedPages.includes(path)) {
      onPagesChange(selectedPages.filter((p) => p !== path));
    } else {
      onPagesChange([...selectedPages, path]);
    }
  };

  const toggleGroup = (groupPages: DiscoveredPage[]) => {
    const paths = groupPages.map((p) => p.path);
    const allGroupSelected = paths.every((p) => selectedPages.includes(p));
    if (allGroupSelected) {
      onPagesChange(selectedPages.filter((p) => !paths.includes(p)));
    } else {
      const newSelected = new Set([...selectedPages, ...paths]);
      onPagesChange([...newSelected]);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-[#262626]">Select Pages</h2>
          <p className="text-sm text-gray-500 mt-1">
            {selectedPages.length} of {pages.length} pages selected
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={toggleAll}
            className="text-sm font-medium text-[#FF7F11] hover:text-[#e6720f] transition-colors"
          >
            {allSelected ? 'Deselect All' : 'Select All'}
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          placeholder="Search pages..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 text-sm border border-gray-300 rounded-lg outline-none focus:border-[#FF7F11] focus:ring-2 focus:ring-[#FF7F11]/20 transition-all"
        />
      </div>

      {/* Page list grouped by path */}
      <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2">
        {Object.entries(grouped).map(([group, groupPages]) => (
          <div key={group}>
            <div className="flex items-center justify-between mb-2">
              <button
                onClick={() => toggleGroup(groupPages)}
                className="text-xs font-semibold text-gray-500 uppercase tracking-wide hover:text-[#FF7F11] transition-colors"
              >
                {group} ({groupPages.length})
              </button>
            </div>
            <div className="space-y-1">
              {groupPages.map((page) => (
                <Card
                  key={page.path}
                  selected={selectedPages.includes(page.path)}
                  hoverable
                  onClick={() => togglePage(page.path)}
                  className="p-3 !rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <Checkbox
                      checked={selectedPages.includes(page.path)}
                      onChange={() => togglePage(page.path)}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-[#262626] truncate">
                        {page.path || '/'}
                      </p>
                      {page.title && (
                        <p className="text-xs text-gray-400 truncate">{page.title}</p>
                      )}
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        ))}
      </div>

      {selectedPages.length === 0 && (
        <p className="text-sm text-[#E53E3E]">Please select at least one page.</p>
      )}
    </div>
  );
}
