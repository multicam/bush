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
import { isRoleAtLeast } from "@/auth/types";
import { getAuthState, login as authLogin, logout as authLogout, switchAccount as authSwitchAccount } from "@/web/lib/auth";
import { workspacesApi } from "@/web/lib/api";

interface AuthContextValue extends AuthState {
  isLoading: boolean;
  login: (redirect?: string) => void;
  logout: () => Promise<void>;
  switchAccount: (accountId: string) => Promise<boolean>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/**
 * Workspace context value type
 */
interface WorkspaceContextValue {
  workspace: Workspace | null;
  workspaces: Workspace[];
  setWorkspace: (workspace: Workspace | null) => void;
  isLoading: boolean;
}

/**
 * Workspace type for context
 */
export interface Workspace {
  id: string;
  name: string;
  description: string | null;
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

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
    let cancelled = false;
    getAuthState().then((state) => {
      if (!cancelled) {
        setAuthState({ ...state, isLoading: false });
      }
    }).catch(() => {
      if (!cancelled) {
        setAuthState({
          isAuthenticated: false,
          isLoading: false,
          user: null,
          currentAccount: null,
          accounts: [],
        });
      }
    });
    return () => { cancelled = true; };
  }, []);

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

  return isRoleAtLeast(currentAccount.role, requiredRole);
}

/**
 * Workspace Provider Component
 * Manages workspace state for the current account
 */
interface WorkspaceProviderProps {
  children: ReactNode;
}

export function WorkspaceProvider({ children }: WorkspaceProviderProps) {
  const { currentAccount, isAuthenticated } = useAuth();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [currentWorkspace, setCurrentWorkspace] = useState<Workspace | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Load workspaces when account changes
  useEffect(() => {
    let cancelled = false;

    async function loadWorkspaces() {
      if (!isAuthenticated || !currentAccount) {
        setWorkspaces([]);
        setCurrentWorkspace(null);
        return;
      }

      setIsLoading(true);
      try {
        const response = await workspacesApi.list({ limit: 100 });
        const workspaceList: Workspace[] = response.data.map((w) => ({
          id: w.id,
          name: w.attributes.name,
          description: w.attributes.description,
        }));

        if (!cancelled) {
          setWorkspaces(workspaceList);

          // Auto-select first workspace if none selected
          if (workspaceList.length > 0 && !currentWorkspace) {
            // Try to restore from localStorage
            const savedWorkspaceId = typeof window !== "undefined"
              ? localStorage.getItem(`bush_workspace_${currentAccount.id}`)
              : null;

            const savedWorkspace = savedWorkspaceId
              ? workspaceList.find((w) => w.id === savedWorkspaceId)
              : null;

            setCurrentWorkspace(savedWorkspace || workspaceList[0]);
          } else if (workspaceList.length === 0) {
            setCurrentWorkspace(null);
          }
        }
      } catch (error) {
        console.error("Failed to load workspaces:", error);
        if (!cancelled) {
          setWorkspaces([]);
          setCurrentWorkspace(null);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    loadWorkspaces();

    return () => { cancelled = true; };
  }, [currentAccount?.id, isAuthenticated]);

  // Handler to set workspace and persist to localStorage
  const setWorkspace = useCallback((workspace: Workspace | null) => {
    setCurrentWorkspace(workspace);

    // Persist to localStorage
    if (typeof window !== "undefined" && currentAccount) {
      if (workspace) {
        localStorage.setItem(`bush_workspace_${currentAccount.id}`, workspace.id);
      } else {
        localStorage.removeItem(`bush_workspace_${currentAccount.id}`);
      }
    }
  }, [currentAccount]);

  return (
    <WorkspaceContext.Provider
      value={{
        workspace: currentWorkspace,
        workspaces,
        setWorkspace,
        isLoading,
      }}
    >
      {children}
    </WorkspaceContext.Provider>
  );
}

/**
 * Hook to get the current workspace context
 * Returns the current workspace, all workspaces, and a setter
 */
export function useCurrentWorkspace(): WorkspaceContextValue {
  const context = useContext(WorkspaceContext);
  if (!context) {
    throw new Error("useCurrentWorkspace must be used within a WorkspaceProvider");
  }
  return context;
}
