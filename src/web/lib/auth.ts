/**
 * Bush Platform - Web App Auth Utilities
 *
 * Client-side and server-side auth utilities for the Next.js app.
 */
import type { AuthState, AccountRole } from "@/auth";
import { isRoleAtLeast } from "@/auth/types";

/**
 * Get the current auth state on the client side
 * This calls the /api/auth/session endpoint
 */
export async function getAuthState(): Promise<AuthState> {
  try {
    const response = await fetch("/api/auth/session", {
      credentials: "include",
    });

    if (!response.ok) {
      return {
        isAuthenticated: false,
        isLoading: false,
        user: null,
        currentAccount: null,
        accounts: [],
      };
    }

    return await response.json();
  } catch {
    return {
      isAuthenticated: false,
      isLoading: false,
      user: null,
      currentAccount: null,
      accounts: [],
    };
  }
}

/**
 * Login redirect - redirects to WorkOS AuthKit
 */
export function login(redirect?: string): void {
  const loginUrl = new URL("/api/auth/login", window.location.origin);
  if (redirect) {
    loginUrl.searchParams.set("redirect", redirect);
  }
  window.location.href = loginUrl.toString();
}

/**
 * Logout - clears session and redirects to home
 */
export async function logout(): Promise<void> {
  try {
    await fetch("/api/auth/logout", {
      method: "POST",
      credentials: "include",
    });
  } catch {
    // Ignore errors on logout
  }
  window.location.href = "/";
}

/**
 * Switch account - updates session context
 */
export async function switchAccount(accountId: string): Promise<boolean> {
  try {
    const response = await fetch("/api/auth/switch-account", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ accountId }),
      credentials: "include",
    });

    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Check if user has required role
 */
export function hasRole(authState: AuthState, requiredRole: AccountRole): boolean {
  if (!authState.currentAccount) {
    return false;
  }

  return isRoleAtLeast(authState.currentAccount.role, requiredRole);
}

/**
 * Get display name from user info
 */
export function getDisplayName(user: NonNullable<AuthState["user"]>): string {
  if (user.firstName && user.lastName) {
    return `${user.firstName} ${user.lastName}`;
  }
  if (user.firstName) {
    return user.firstName;
  }
  if (user.displayName) {
    return user.displayName;
  }
  return user.email;
}

/**
 * Get user initials for avatar
 */
export function getUserInitials(user: NonNullable<AuthState["user"]>): string {
  if (user.firstName && user.lastName) {
    return `${user.firstName[0]}${user.lastName[0]}`.toUpperCase();
  }
  if (user.firstName) {
    return user.firstName[0].toUpperCase();
  }
  return user.email[0].toUpperCase();
}
