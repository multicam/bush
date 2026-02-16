/**
 * Bush Platform - Auth API Routes
 *
 * API routes for authentication operations in the Next.js app.
 * Uses WorkOS AuthKit for authentication with Bush-specific session management.
 * Reference: specs/12-authentication.md
 */
import { NextRequest, NextResponse } from "next/server";
import {
  getSignInUrl,
  signOut as workosSignOut,
  withAuth,
  saveSession,
  getWorkOS,
} from "@workos-inc/authkit-nextjs";
import { config } from "@/config";
import { authService } from "@/auth";
import type { SessionData } from "@/auth/types";
import {
  BUSH_SESSION_COOKIE,
  encodeSessionCookie,
  decodeSessionCookie,
} from "@/web/lib/session-cookie";

/**
 * Set the Bush session cookie on a response
 */
function setBushSessionCookie(response: NextResponse, session: SessionData): void {
  response.cookies.set(BUSH_SESSION_COOKIE, encodeSessionCookie(session), {
    httpOnly: true,
    secure: config.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: config.SESSION_MAX_AGE,
    path: "/",
  });
}

/**
 * GET /api/auth/session - Get current session state
 *
 * Returns both WorkOS session (from AuthKit) and Bush session (from Redis).
 */
async function getSession(_request: NextRequest) {
  // Use withAuth to get the WorkOS session info
  const authInfo = await withAuth();

  if (!authInfo.user) {
    return NextResponse.json({
      isAuthenticated: false,
      isLoading: false,
      user: null,
      currentAccount: null,
      accounts: [],
    });
  }

  // Get Bush session from our cookie
  const bushSessionCookie = _request.cookies.get(BUSH_SESSION_COOKIE);

  if (!bushSessionCookie) {
    // WorkOS session exists but no Bush session - need to create one
    return NextResponse.json({
      isAuthenticated: true,
      isLoading: false,
      user: {
        id: authInfo.user.id,
        email: authInfo.user.email,
        firstName: authInfo.user.firstName ?? null,
        lastName: authInfo.user.lastName ?? null,
        displayName: [authInfo.user.firstName, authInfo.user.lastName]
          .filter(Boolean)
          .join(" ") || null,
        avatarUrl: authInfo.user.profilePictureUrl ?? null,
      },
      currentAccount: null,
      accounts: [],
      requiresAccountSetup: true,
    });
  }

  try {
    const bushSession = decodeSessionCookie(bushSessionCookie.value);
    if (!bushSession) {
      throw new Error("Invalid session cookie");
    }

    // Get user's accounts
    const accounts = await authService.getUserAccounts(bushSession.userId);

    // Find current account
    const currentAccount = accounts.find(
      (a) => a.accountId === bushSession.currentAccountId
    );

    return NextResponse.json({
      isAuthenticated: true,
      isLoading: false,
      user: {
        id: bushSession.userId,
        email: bushSession.email,
        displayName: bushSession.displayName,
        avatarUrl: bushSession.avatarUrl,
        firstName: null,
        lastName: null,
      },
      currentAccount: currentAccount
        ? {
            id: currentAccount.accountId,
            name: currentAccount.accountName,
            slug: currentAccount.accountSlug,
            role: currentAccount.role,
          }
        : null,
      accounts: accounts.map((a) => ({
        id: a.accountId,
        name: a.accountName,
        slug: a.accountSlug,
        role: a.role,
      })),
    });
  } catch {
    return NextResponse.json({
      isAuthenticated: true,
      isLoading: false,
      user: {
        id: authInfo.user.id,
        email: authInfo.user.email,
        firstName: authInfo.user.firstName ?? null,
        lastName: authInfo.user.lastName ?? null,
        displayName: [authInfo.user.firstName, authInfo.user.lastName]
          .filter(Boolean)
          .join(" ") || null,
        avatarUrl: authInfo.user.profilePictureUrl ?? null,
      },
      currentAccount: null,
      accounts: [],
      requiresAccountSetup: true,
    });
  }
}

/**
 * GET /api/auth/login - Redirect to WorkOS AuthKit
 */
async function login(request: NextRequest) {
  const redirect = request.nextUrl.searchParams.get("redirect") || "/dashboard";

  // Use WorkOS AuthKit's getSignInUrl for proper URL generation
  const signInUrl = await getSignInUrl();

  // Add state for redirect after auth
  const url = new URL(signInUrl);
  url.searchParams.set(
    "state",
    Buffer.from(JSON.stringify({ redirect })).toString("base64")
  );

  return NextResponse.redirect(url.toString());
}

/**
 * GET /api/auth/callback - Handle WorkOS callback
 *
 * This handles the OAuth callback from WorkOS AuthKit:
 * 1. Exchange authorization code for tokens
 * 2. Create or find Bush user
 * 3. Create Bush session
 * 4. Set both WorkOS and Bush session cookies
 */
async function callback(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const error = request.nextUrl.searchParams.get("error");
  const errorDescription = request.nextUrl.searchParams.get("error_description");

  // Handle OAuth errors
  if (error) {
    console.error("WorkOS auth error:", error, errorDescription);
    return NextResponse.redirect(
      new URL(`/login?error=${encodeURIComponent(errorDescription || error)}`, request.url)
    );
  }

  if (!code) {
    return NextResponse.redirect(new URL("/login?error=no_code", request.url));
  }

  try {
    // Exchange code for tokens using WorkOS SDK
    const authResponse = await getWorkOS().userManagement.authenticateWithCode({
      clientId: config.WORKOS_CLIENT_ID,
      code,
    });

    // Save WorkOS session to cookie (using AuthKit's saveSession)
    await saveSession(authResponse, request);

    // Extract user info
    const { user, organizationId } = authResponse;

    // Parse state to get redirect path
    let redirectPath = "/dashboard";
    if (state) {
      try {
        const stateData = JSON.parse(Buffer.from(state, "base64").toString());
        redirectPath = stateData.redirect || "/dashboard";
      } catch {
        // Invalid state, use default redirect
      }
    }

    // Create or find Bush user
    const { userId } = await authService.findOrCreateUser({
      workosUserId: user.id,
      email: user.email,
      firstName: user.firstName ?? undefined,
      lastName: user.lastName ?? undefined,
      avatarUrl: user.profilePictureUrl ?? undefined,
      organizationId: organizationId || "",
    });

    // Get user's accounts
    const accounts = await authService.getUserAccounts(userId);

    // If new user with no accounts, redirect to onboarding
    if (accounts.length === 0) {
      const response = NextResponse.redirect(
        new URL("/onboarding/create-account", request.url)
      );

      // Set a minimal session cookie so onboarding knows who the user is
      const minimalSession: Partial<SessionData> = {
        userId,
        email: user.email,
        displayName: [user.firstName, user.lastName].filter(Boolean).join(" ") || null,
        avatarUrl: user.profilePictureUrl,
        workosUserId: user.id,
        workosOrganizationId: organizationId || "",
      };

      response.cookies.set(
        BUSH_SESSION_COOKIE,
        encodeSessionCookie(minimalSession),
        {
          httpOnly: true,
          secure: config.NODE_ENV === "production",
          sameSite: "lax",
          maxAge: 3600, // 1 hour for onboarding
          path: "/",
        }
      );

      return response;
    }

    // Use first account as default
    const defaultAccount = accounts[0];

    // Create Bush session in Redis
    const bushSession = await authService.createSession(
      userId,
      defaultAccount.accountId,
      organizationId || "",
      user.id
    );

    // Redirect to the intended destination
    const response = NextResponse.redirect(new URL(redirectPath, request.url));
    setBushSessionCookie(response, bushSession);

    return response;
  } catch (err) {
    console.error("Auth callback error:", err);
    return NextResponse.redirect(
      new URL("/login?error=callback_failed", request.url)
    );
  }
}

/**
 * POST /api/auth/logout - Clear session
 */
async function logout(request: NextRequest) {
  const bushSessionCookie = request.cookies.get(BUSH_SESSION_COOKIE);

  if (bushSessionCookie) {
    const sessionData = decodeSessionCookie(bushSessionCookie.value);
    if (sessionData?.userId && sessionData?.sessionId) {
      await authService.invalidateSession(
        sessionData.userId,
        sessionData.sessionId
      );
    }
  }

  // Sign out from WorkOS
  await workosSignOut();

  const response = NextResponse.json({ success: true });
  response.cookies.delete(BUSH_SESSION_COOKIE);
  return response;
}

/**
 * POST /api/auth/switch-account - Switch active account
 */
async function switchAccount(request: NextRequest) {
  const bushSessionCookie = request.cookies.get(BUSH_SESSION_COOKIE);

  if (!bushSessionCookie) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { accountId } = body;

    if (!accountId) {
      return NextResponse.json(
        { error: "Account ID required" },
        { status: 400 }
      );
    }

    const sessionData = decodeSessionCookie(bushSessionCookie.value);
    if (!sessionData?.userId || !sessionData?.sessionId) {
      return NextResponse.json({ error: "Invalid session" }, { status: 401 });
    }

    const updatedSession = await authService.switchAccount(
      sessionData.userId,
      sessionData.sessionId,
      accountId
    );

    if (!updatedSession) {
      return NextResponse.json(
        { error: "Failed to switch account" },
        { status: 500 }
      );
    }

    // Update cookie
    const response = NextResponse.json({ success: true });
    setBushSessionCookie(response, updatedSession);

    return response;
  } catch (error) {
    console.error("Switch account error:", error);
    return NextResponse.json(
      { error: "Failed to switch account" },
      { status: 500 }
    );
  }
}

/**
 * Route handler for auth operations
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ action: string[] }> }
) {
  const { action } = await params;
  const actionPath = action?.join("/") || "";

  switch (actionPath) {
    case "session":
      return getSession(request);
    case "login":
      return login(request);
    case "callback":
      return callback(request);
    case "logout":
      return logout(request);
    default:
      return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ action: string[] }> }
) {
  const { action } = await params;
  const actionPath = action?.join("/") || "";

  switch (actionPath) {
    case "logout":
      return logout(request);
    case "switch-account":
      return switchAccount(request);
    default:
      return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}
