/**
 * Bush Platform - Auth Context
 *
 * React Context for authentication state management.
 * Provides auth state and actions to the entire app.
 * Reference: IMPLEMENTATION_PLAN.md 1.7a
 */
"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import type { AuthState, AccountRole } from "@/auth";
import { getAuthState, login as authLogin, logout as authLogout, switchAccount as authSwitchAccount } from "@/web/lib/auth";

interface AuthContextValue extends AuthState {
  isLoading: boolean;
  login: (redirect?: string) => void;
  logout: () => Promise<void>;
  switchAccount: (accountId: string) => Promise<boolean>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [authState, setAuthState] = useState<AuthState>({
    isAuthenticated: false,
    isLoading: true,
    user: null,
    currentAccount: null,
    accounts: [],
  });

  const refresh = useCallback(async () => {
    try {
      const state = await getAuthState();
      setAuthState({
        ...state,
        isLoading: false,
      });
    } catch {
      setAuthState({
        isAuthenticated: false,
        isLoading: false,
        user: null,
        currentAccount: null,
        accounts: [],
      });
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const login = useCallback((redirect?: string) => {
    authLogin(redirect);
  }, []);

  const logout = useCallback(async () => {
    await authLogout();
    setAuthState({
      isAuthenticated: false,
      isLoading: false,
      user: null,
      currentAccount: null,
      accounts: [],
    });
  }, []);

  const switchAccount = useCallback(async (accountId: string) => {
    const success = await authSwitchAccount(accountId);
    if (success) {
      await refresh();
    }
    return success;
  }, [refresh]);

  return (
    <AuthContext.Provider
      value={{
        ...authState,
        isLoading: authState.isLoading,
        login,
        logout,
        switchAccount,
        refresh,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

/**
 * Hook to check if user has a required role
 */
export function useHasRole(requiredRole: AccountRole): boolean {
  const { currentAccount } = useAuth();

  if (!currentAccount) {
    return false;
  }

  const roleHierarchy: AccountRole[] = [
    "reviewer",
    "guest",
    "member",
    "content_admin",
    "owner",
  ];

  const userRoleIndex = roleHierarchy.indexOf(currentAccount.role);
  const requiredRoleIndex = roleHierarchy.indexOf(requiredRole);

  return userRoleIndex >= requiredRoleIndex;
}

/**
 * Hook to get the current workspace context
 * Note: This will be expanded when workspace context is added
 */
export function useCurrentWorkspace() {
  const { currentAccount } = useAuth();
  // TODO: Implement workspace context selection
  return {
    workspace: null as unknown,
    setWorkspace: (_workspace: unknown) => {},
  };
}
