/**
 * Bush Platform - Next.js Middleware
 *
 * Route protection and authentication middleware.
 * Uses WorkOS AuthKit for session validation.
 * Reference: specs/12-authentication.md
 */
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Public paths that don't require authentication
 */
const PUBLIC_PATHS = [
  "/",
  "/login",
  "/signup",
  "/api/auth/callback",
  "/api/auth/login",
  "/api/auth/logout",
  "/share", // Share links have their own auth
];

/**
 * Static asset patterns that don't require auth
 */
const STATIC_PATTERNS = [
  /^\/_next\//,
  /^\/favicon/,
  /\.(png|jpg|jpeg|gif|svg|ico|css|js|woff|woff2)$/i,
];

/**
 * Check if path is public (no auth required)
 */
function isPublicPath(pathname: string): boolean {
  // Check exact matches
  if (PUBLIC_PATHS.includes(pathname)) {
    return true;
  }

  // Check share links (public access)
  if (pathname.startsWith("/share/")) {
    return true;
  }

  // Check static patterns
  for (const pattern of STATIC_PATTERNS) {
    if (pattern.test(pathname)) {
      return true;
    }
  }

  return false;
}

/**
 * Main middleware function
 */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public paths
  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  // Check for session cookie
  const sessionCookie = request.cookies.get("bush_session");

  if (!sessionCookie) {
    // Redirect to login, preserving the intended destination
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Session exists, allow request to proceed
  // Note: Actual session validation happens in API routes and server components
  return NextResponse.next();
}

/**
 * Configure which paths the middleware runs on
 */
export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder files
     */
    "/((?!_next/static|_next/image|favicon.ico|public/).*)",
  ],
};
