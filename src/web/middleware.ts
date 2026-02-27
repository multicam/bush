/**
 * Bush Platform - Next.js Middleware
 *
 * Route protection and authentication middleware.
 * Uses WorkOS AuthKit for session validation.
 * In DEMO_MODE, all routes are accessible without authentication.
 * Reference: specs/02-authentication.md
 */
import { NextRequest, NextResponse } from "next/server";
import { authkitMiddleware } from "@workos-inc/authkit-nextjs";

const DEMO_MODE = process.env.DEMO_MODE === "true";

/**
 * Paths that allow sign-up (not just sign-in)
 */
const SIGN_UP_PATHS = ["/signup"];

/**
 * Demo middleware - passes all requests through without auth
 */
function demoMiddleware(_request: NextRequest) {
  return NextResponse.next();
}

/**
 * Configure AuthKit middleware with route protection
 *
 * Using middlewareAuth mode to protect routes by default.
 * Unauthenticated paths are explicitly listed.
 */
export default DEMO_MODE
  ? demoMiddleware
  : authkitMiddleware({
      debug: process.env.NODE_ENV === "development",

      middlewareAuth: {
        enabled: true,
        unauthenticatedPaths: [
          // Home page
          "/",
          // Auth flows
          "/login",
          "/signup",
          "/auth/callback", // WorkOS AuthKit callback (canonical)
          "/api/auth/login",
          "/api/auth/session",
          "/api/auth/logout",
          // Share links (public access)
          "/share/:path*",
          // WebSocket upgrade (auth handled by API server)
          "/ws",
          // API health check
          "/api/health",
        ],
      },

      // Sign up paths allow new user registration
      signUpPaths: SIGN_UP_PATHS,
    });

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
     * - Static assets
     */
    "/((?!_next/static|_next/image|favicon.ico|public/|.*\\.(?:png|jpg|jpeg|gif|svg|ico|css|js|woff|woff2)$).*)",
  ],
};
