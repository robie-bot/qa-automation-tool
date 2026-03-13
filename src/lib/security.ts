// --- SSRF Protection ---

const PRIVATE_RANGES = [
  // 127.0.0.0/8 (loopback)
  { start: 0x7F000000, end: 0x7FFFFFFF },
  // 10.0.0.0/8
  { start: 0x0A000000, end: 0x0AFFFFFF },
  // 172.16.0.0/12
  { start: 0xAC100000, end: 0xAC1FFFFF },
  // 192.168.0.0/16
  { start: 0xC0A80000, end: 0xC0A8FFFF },
  // 169.254.0.0/16 (link-local)
  { start: 0xA9FE0000, end: 0xA9FEFFFF },
  // 0.0.0.0/8
  { start: 0x00000000, end: 0x00FFFFFF },
];

function ipToInt(ip: string): number {
  const parts = ip.split('.').map(Number);
  return ((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0;
}

export function isPrivateIP(ip: string): boolean {
  // Check IPv6 loopback
  if (ip === '::1' || ip === '::' || ip.startsWith('fe80:') || ip.startsWith('fc00:') || ip.startsWith('fd')) {
    return true;
  }

  // Check IPv4-mapped IPv6 (::ffff:x.x.x.x)
  const v4Match = ip.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/i);
  const v4Ip = v4Match ? v4Match[1] : ip;

  // Validate IPv4 format
  if (!/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(v4Ip)) {
    return true; // Block if we can't parse
  }

  const ipInt = ipToInt(v4Ip);
  return PRIVATE_RANGES.some(range => ipInt >= range.start && ipInt <= range.end);
}

export async function validatePublicUrl(urlString: string): Promise<{ valid: boolean; error?: string }> {
  try {
    const parsed = new URL(urlString);

    // Only allow http/https
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return { valid: false, error: 'Only HTTP and HTTPS URLs are allowed' };
    }

    // Block credentials in URL
    if (parsed.username || parsed.password) {
      return { valid: false, error: 'URLs with credentials are not allowed' };
    }

    // Block private hostnames
    const hostname = parsed.hostname.toLowerCase();
    if (hostname === 'localhost' || hostname.endsWith('.local') || hostname.endsWith('.internal')) {
      return { valid: false, error: 'Local/internal hostnames are not allowed' };
    }

    // Resolve hostname and check if IP is private
    // For IP-based hostnames, check directly
    if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname)) {
      if (isPrivateIP(hostname)) {
        return { valid: false, error: 'Private IP addresses are not allowed' };
      }
    }

    return { valid: true };
  } catch {
    return { valid: false, error: 'Invalid URL format' };
  }
}

// --- Rate Limiting ---

interface RateLimitEntry {
  timestamps: number[];
}

const rateLimitStore = new Map<string, RateLimitEntry>();

// Clean up old entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore.entries()) {
    entry.timestamps = entry.timestamps.filter(t => now - t < 600000); // 10 min window
    if (entry.timestamps.length === 0) {
      rateLimitStore.delete(key);
    }
  }
}, 300000);

export function rateLimit(key: string, maxRequests: number, windowMs: number): { allowed: boolean; retryAfterMs?: number } {
  const now = Date.now();
  const entry = rateLimitStore.get(key) || { timestamps: [] };

  // Remove timestamps outside the window
  entry.timestamps = entry.timestamps.filter(t => now - t < windowMs);

  if (entry.timestamps.length >= maxRequests) {
    const oldestInWindow = entry.timestamps[0];
    const retryAfterMs = windowMs - (now - oldestInWindow);
    return { allowed: false, retryAfterMs };
  }

  entry.timestamps.push(now);
  rateLimitStore.set(key, entry);
  return { allowed: true };
}

// --- Input Validation ---

export function sanitizeSearchTerm(term: string): string {
  return term.slice(0, 500).trim();
}

export function sanitizeUrl(url: string): string {
  return url.slice(0, 2048).trim();
}

export function validateBase64Size(base64: string, maxSizeBytes: number): boolean {
  // Base64 encodes 3 bytes as 4 chars
  const sizeInBytes = Math.ceil((base64.length * 3) / 4);
  return sizeInBytes <= maxSizeBytes;
}

// --- File size constants ---
export const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB
export const MAX_DOCUMENT_SIZE = 20 * 1024 * 1024; // 20MB
export const MAX_SITEMAP_SIZE = 5 * 1024 * 1024; // 5MB
export const MAX_SCREENSHOT_HEIGHT = 5000;
export const MAX_SCREENSHOT_SIZE = 500 * 1024; // 500KB

// --- Error Sanitization ---
export function sanitizeError(error: unknown): string {
  if (process.env.NODE_ENV === 'production') {
    return 'An unexpected error occurred';
  }
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}
