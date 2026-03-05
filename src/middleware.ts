import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'dev-secret-change-in-production'
);
const COOKIE_NAME = 'qa-session';

// Public paths that don't require authentication
const PUBLIC_PATHS = ['/login', '/register'];
const PUBLIC_API_PATHS = ['/api/auth/login', '/api/auth/register', '/api/auth/logout'];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public paths
  if (PUBLIC_PATHS.some(p => pathname === p)) {
    // If user is already logged in, redirect to dashboard
    const token = request.cookies.get(COOKIE_NAME)?.value;
    if (token) {
      try {
        await jwtVerify(token, JWT_SECRET);
        return NextResponse.redirect(new URL('/', request.url));
      } catch {
        // Token invalid, let them access login/register
      }
    }
    return NextResponse.next();
  }

  // Allow public API routes
  if (PUBLIC_API_PATHS.some(p => pathname === p)) {
    return NextResponse.next();
  }

  // Allow static assets, Next.js internals
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    pathname.includes('.')
  ) {
    return NextResponse.next();
  }

  // Verify authentication
  const token = request.cookies.get(COOKIE_NAME)?.value;

  if (!token) {
    // API routes get 401
    if (pathname.startsWith('/api/')) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }
    // Pages redirect to login
    return NextResponse.redirect(new URL('/login', request.url));
  }

  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    const userId = payload.userId as string;
    const userEmail = payload.email as string;

    // Set user headers for downstream routes
    const response = NextResponse.next();
    response.headers.set('x-user-id', userId);
    response.headers.set('x-user-email', userEmail);
    return response;
  } catch {
    // Invalid token
    if (pathname.startsWith('/api/')) {
      return NextResponse.json(
        { error: 'Invalid or expired session' },
        { status: 401 }
      );
    }
    // Clear bad cookie and redirect to login
    const response = NextResponse.redirect(new URL('/login', request.url));
    response.cookies.set(COOKIE_NAME, '', { maxAge: 0 });
    return response;
  }
}

export const config = {
  matcher: [
    /*
     * Match all paths except:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
