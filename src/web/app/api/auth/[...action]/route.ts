/**
 * Bush Platform - Auth API Routes
 *
 * API routes for authentication operations in the Next.js app.
 * Handles login, logout, callback, and session management.
 */
import { NextRequest, NextResponse } from "next/server";
import { config } from "@/config";
import { authService } from "@/auth";

/**
 * GET /api/auth/session - Get current session state
 */
async function getSession(request: NextRequest) {
  const sessionCookie = request.cookies.get("bush_session");

  if (!sessionCookie) {
    return NextResponse.json({
      isAuthenticated: false,
      isLoading: false,
      user: null,
      currentAccount: null,
      accounts: [],
    });
  }

  try {
    // Parse session from cookie
    const sessionData = JSON.parse(Buffer.from(sessionCookie.value, "base64").toString());

    // Get user's accounts
    const accounts = await authService.getUserAccounts(sessionData.userId);

    // Find current account
    const currentAccount = accounts.find((a) => a.accountId === sessionData.currentAccountId);

    return NextResponse.json({
      isAuthenticated: true,
      isLoading: false,
      user: {
        id: sessionData.userId,
        email: sessionData.email,
        firstName: sessionData.firstName || null,
        lastName: sessionData.lastName || null,
        displayName: sessionData.displayName,
        avatarUrl: sessionData.avatarUrl,
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
      isAuthenticated: false,
      isLoading: false,
      user: null,
      currentAccount: null,
      accounts: [],
    });
  }
}

/**
 * GET /api/auth/login - Redirect to WorkOS AuthKit
 */
async function login(request: NextRequest) {
  const redirect = request.nextUrl.searchParams.get("redirect") || "/dashboard";

  // Build WorkOS AuthKit authorization URL
  // In production, this would use the @workos-inc/authkit-nextjs SDK
  const authUrl = new URL("https://auth.workos.com/authorize");
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("client_id", config.WORKOS_CLIENT_ID);
  authUrl.searchParams.set("redirect_uri", config.WORKOS_REDIRECT_URI);
  authUrl.searchParams.set("state", Buffer.from(JSON.stringify({ redirect })).toString("base64"));

  return NextResponse.redirect(authUrl.toString());
}

/**
 * GET /api/auth/callback - Handle WorkOS callback
 */
async function callback(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");

  if (!code) {
    return NextResponse.redirect(new URL("/login?error=no_code", request.url));
  }

  try {
    // In production, this would exchange the code for tokens via WorkOS SDK
    // For now, create a placeholder session
    let redirectPath = "/dashboard";

    if (state) {
      try {
        const stateData = JSON.parse(Buffer.from(state, "base64").toString());
        redirectPath = stateData.redirect || "/dashboard";
      } catch {
        // Invalid state, use default redirect
      }
    }

    // TODO: Implement actual WorkOS token exchange
    // This is a placeholder that would be replaced with:
    // const { accessToken, refreshToken } = await workos.exchangeCode(code);
    // const claims = await workOS.validateAccessToken(accessToken);
    // const session = await authService.createSession(...);

    return NextResponse.redirect(new URL(redirectPath, request.url));
  } catch (error) {
    console.error("Auth callback error:", error);
    return NextResponse.redirect(new URL("/login?error=callback_failed", request.url));
  }
}

/**
 * POST /api/auth/logout - Clear session
 */
async function logout(request: NextRequest) {
  const sessionCookie = request.cookies.get("bush_session");

  if (sessionCookie) {
    try {
      const sessionData = JSON.parse(Buffer.from(sessionCookie.value, "base64").toString());
      await authService.invalidateSession(sessionData.userId, sessionData.sessionId);
    } catch {
      // Session already invalid
    }
  }

  const response = NextResponse.json({ success: true });
  response.cookies.delete("bush_session");
  return response;
}

/**
 * POST /api/auth/switch-account - Switch active account
 */
async function switchAccount(request: NextRequest) {
  const sessionCookie = request.cookies.get("bush_session");

  if (!sessionCookie) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { accountId } = body;

    if (!accountId) {
      return NextResponse.json({ error: "Account ID required" }, { status: 400 });
    }

    const sessionData = JSON.parse(Buffer.from(sessionCookie.value, "base64").toString());
    const updatedSession = await authService.switchAccount(
      sessionData.userId,
      sessionData.sessionId,
      accountId
    );

    if (!updatedSession) {
      return NextResponse.json({ error: "Failed to switch account" }, { status: 500 });
    }

    // Update cookie
    const response = NextResponse.json({ success: true });
    response.cookies.set("bush_session", Buffer.from(JSON.stringify(updatedSession)).toString("base64"), {
      httpOnly: true,
      secure: config.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: config.SESSION_MAX_AGE,
      path: "/",
    });

    return response;
  } catch (error) {
    console.error("Switch account error:", error);
    return NextResponse.json({ error: "Failed to switch account" }, { status: 500 });
  }
}

/**
 * Route handler for auth operations
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ action: string[] }> }> = { params: Promise.resolve({ action: [] }) }) {
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

export async function POST(request: NextRequest, { params }: { params: Promise<{ action: string[] }> }> = { params: Promise.resolve({ action: [] }) }) {
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
