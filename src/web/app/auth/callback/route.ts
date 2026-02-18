/**
 * Bush Platform - WorkOS AuthKit Callback Route
 *
 * Standard AuthKit callback handler for OAuth flow.
 * Uses onSuccess to create Bush session alongside WorkOS session.
 * Reference: https://github.com/workos/authkit-nextjs
 *
 * NOTE: We use dynamic imports for database-dependent modules to avoid
 * bundling bun:sqlite during Next.js build (Node.js doesn't have bun:sqlite).
 */
import { handleAuth } from "@workos-inc/authkit-nextjs";
import { cookies } from "next/headers";
import { BUSH_SESSION_COOKIE } from "@/web/lib/session-cookie";

// Dynamic import for database-dependent module (avoid bundling bun:sqlite in Next.js)
async function getAuthService() {
  const { authService } = await import("@/auth");
  return authService;
}

export const GET = handleAuth({
  returnPathname: "/dashboard",
  onSuccess: async (data) => {
    const { user, organizationId } = data;

    // Use dynamic import to avoid bundling bun:sqlite
    const authService = await getAuthService();

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

    if (accounts.length > 0) {
      // Create Bush session in Redis
      const defaultAccount = accounts[0];
      const bushSession = await authService.createSession(
        userId,
        defaultAccount.accountId,
        organizationId || "",
        user.id
      );

      // Set Bush session cookie (store only the session token, not the full session data)
      const cookieStore = await cookies();
      cookieStore.set(BUSH_SESSION_COOKIE, `${bushSession.userId}:${bushSession.sessionId}`, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 604800, // 7 days
        path: "/",
      });
    }
  },
});
