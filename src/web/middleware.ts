/**
 * Bush Platform - Next.js Middleware
 *
 * Route protection and authentication middleware.
 * Uses WorkOS AuthKit for session validation.
 * Reference: specs/12-authentication.md
 */
import { authkitMiddleware } from "@workos-inc/authkit-nextjs";

/**
 * Paths that allow sign-up (not just sign-in)
 */
const SIGN_UP_PATHS = ["/signup"];

/**
 * Configure AuthKit middleware with route protection
 *
 * Using middlewareAuth mode to protect routes by default.
 * Unauthenticated paths are explicitly listed.
 */
export default authkitMiddleware({
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
