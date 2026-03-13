'use client';

import { useEffect, useState } from 'react';
import { Clock, AlertCircle, AlertTriangle, Info, Download, ExternalLink, ChevronLeft, ChevronRight } from 'lucide-react';

interface Review {
  id: string;
  targetUrl: string;
  pagesReviewed: number;
  totalIssues: number;
  errors: number;
  warnings: number;
  infos: number;
  duration: number;
  categories: string;
  status: string;
  createdAt: string;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export default function ReviewHistory() {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);

  useEffect(() => {
    fetchReviews(page);
  }, [page]);

  const fetchReviews = async (p: number) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/user/reviews?page=${p}&limit=10`);
      if (res.ok) {
        const data = await res.json();
        setReviews(data.reviews);
        setPagination(data.pagination);
      }
    } catch {
      // Silently fail — API might not be connected yet
    } finally {
      setLoading(false);
    }
  };

  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${Math.floor(ms / 60000)}m ${Math.round((ms % 60000) / 1000)}s`;
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return d.toLocaleDateString();
  };

  const getHostname = (url: string) => {
    try {
      return new URL(url).hostname;
    } catch {
      return url;
    }
  };

  if (loading && reviews.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
        <p className="text-sm text-gray-400">Loading review history...</p>
      </div>
    );
  }

  if (!loading && reviews.length === 0) {
    return null; // Don't show section if no reviews
  }

  return (
    <div>
      <h2 className="text-lg font-semibold text-[#262626] mb-4">Recent Reviews</h2>
      <div className="space-y-3">
        {reviews.map((review) => (
          <div
            key={review.id}
            className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-sm transition-shadow"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <ExternalLink className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                  <p className="text-sm font-medium text-[#262626] truncate">
                    {getHostname(review.targetUrl)}
                  </p>
                  <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${
                    review.status === 'completed'
                      ? 'bg-green-50 text-green-600'
                      : review.status === 'failed'
                      ? 'bg-red-50 text-red-600'
                      : 'bg-yellow-50 text-yellow-600'
                  }`}>
                    {review.status}
                  </span>
                </div>

                <p className="text-xs text-gray-400 truncate mb-2">{review.targetUrl}</p>

                <div className="flex items-center gap-4 text-xs text-gray-500">
                  <span className="flex items-center gap-1">
                    <AlertCircle className="w-3 h-3 text-red-500" />
                    {review.errors}
                  </span>
                  <span className="flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3 text-yellow-500" />
                    {review.warnings}
                  </span>
                  <span className="flex items-center gap-1">
                    <Info className="w-3 h-3 text-blue-500" />
                    {review.infos}
                  </span>
                  <span className="text-gray-300">|</span>
                  <span>{review.pagesReviewed} pages</span>
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {formatDuration(review.duration)}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2 flex-shrink-0">
                <span className="text-xs text-gray-400">{formatDate(review.createdAt)}</span>
                <a
                  href={`/api/reports/${review.id}`}
                  className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
                  title="Download PDF report"
                >
                  <Download className="w-4 h-4 text-gray-400" />
                </a>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Pagination */}
      {pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <p className="text-xs text-gray-400">
            {pagination.total} total reviews
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage(page - 1)}
              disabled={page <= 1}
              className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="w-4 h-4 text-gray-600" />
            </button>
            <span className="text-xs text-gray-500">
              {page} / {pagination.totalPages}
            </span>
            <button
              onClick={() => setPage(page + 1)}
              disabled={page >= pagination.totalPages}
              className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ChevronRight className="w-4 h-4 text-gray-600" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
