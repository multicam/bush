/**
 * Bush Platform - WorkOS AuthKit Callback Route
 *
 * Standard AuthKit callback handler for OAuth flow.
 * Calls the Hono API to create a Bush session (avoids importing bun:sqlite in Node.js).
 * Reference: https://github.com/workos/authkit-nextjs
 */
import { handleAuth } from "@workos-inc/authkit-nextjs";
import { cookies } from "next/headers";
import { BUSH_SESSION_COOKIE } from "@/web/lib/session-cookie";

const API_URL = process.env.API_URL || "http://localhost:3001";

export const GET = handleAuth({
  returnPathname: "/dashboard",
  onSuccess: async (data) => {
    const { user, organizationId } = data;

    // Call the Hono API (runs on Bun, has bun:sqlite access) to create session
    const response = await fetch(`${API_URL}/v4/auth/callback-session`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        workos_user_id: user.id,
        email: user.email,
        first_name: user.firstName ?? undefined,
        last_name: user.lastName ?? undefined,
        avatar_url: user.profilePictureUrl ?? undefined,
        organization_id: organizationId || "",
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[Auth Callback] Failed to create session:", response.status, errorText);
      return;
    }

    const result = await response.json() as { data: { user_id: string; session_id: string } };

    // Set Bush session cookie
    const cookieStore = await cookies();
    cookieStore.set(BUSH_SESSION_COOKIE, `${result.data.user_id}:${result.data.session_id}`, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 604800, // 7 days
      path: "/",
    });
  },
});
