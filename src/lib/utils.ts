import { clsx, type ClassValue } from 'clsx';

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

export function normalizeUrl(url: string): string {
  try {
    const u = new URL(url.startsWith('http') ? url : `https://${url}`);
    return u.origin + u.pathname.replace(/\/$/, '');
  } catch {
    return url;
  }
}

export function getPathFromUrl(url: string, baseUrl: string): string {
  try {
    const u = new URL(url);
    const base = new URL(baseUrl);
    if (u.origin !== base.origin) return url;
    return u.pathname || '/';
  } catch {
    return url;
  }
}

export function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${minutes}m ${secs}s`;
}

export function severityColor(severity: string): string {
  switch (severity) {
    case 'error': return 'text-red-600 bg-red-50 border-red-200';
    case 'warning': return 'text-orange-600 bg-orange-50 border-orange-200';
    case 'info': return 'text-blue-600 bg-blue-50 border-blue-200';
    default: return 'text-gray-600 bg-gray-50 border-gray-200';
  }
}

export function severityBadgeColor(severity: string): string {
  switch (severity) {
    case 'error': return 'bg-red-100 text-red-700';
    case 'warning': return 'bg-orange-100 text-orange-700';
    case 'info': return 'bg-blue-100 text-blue-700';
    default: return 'bg-gray-100 text-gray-700';
  }
}

export function groupByPathSegment<T extends { path: string }>(pages: T[]): Record<string, T[]> {
  const groups: Record<string, T[]> = {};
  for (const page of pages) {
    const segments = page.path.split('/').filter(Boolean);
    const group = segments.length > 1 ? `/${segments[0]}/` : '/';
    if (!groups[group]) groups[group] = [];
    groups[group].push(page);
  }
  return groups;
}
