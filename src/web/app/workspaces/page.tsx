/**
 * Bush Platform - Workspaces Page
 *
 * Lists all workspaces the user has access to.
 * Reference: IMPLEMENTATION_PLAN.md 1.7a
 */
"use client";

import { useState, useEffect } from "react";
import { AppLayout } from "@/web/components/layout";
import { Button } from "@/web/components/ui";
import { useAuth } from "@/web/context";
import { SpinnerIcon, PlusIcon, MagnifyingGlassIcon } from "@/web/lib/icons";
import {
  workspacesApi,
  extractCollectionAttributes,
  getErrorMessage,
  type WorkspaceAttributes,
} from "@/web/lib/api";

interface Workspace extends WorkspaceAttributes {
  id: string;
}

type LoadingState = "loading" | "error" | "loaded";

export default function WorkspacesPage() {
  const { isAuthenticated, isLoading: authLoading, login } = useAuth();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [loadingState, setLoadingState] = useState<LoadingState>("loading");
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    async function fetchWorkspaces() {
      // Wait for auth to load
      if (authLoading) return;

      // Redirect to login if not authenticated
      if (!isAuthenticated) {
        login(window.location.pathname);
        return;
      }

      try {
        setLoadingState("loading");
        const response = await workspacesApi.list();
        const items = extractCollectionAttributes(response);
        setWorkspaces(items as Workspace[]);
        setLoadingState("loaded");
      } catch (error) {
        console.error("Failed to fetch workspaces:", error);
        setErrorMessage(getErrorMessage(error));
        setLoadingState("error");
      }
    }

    fetchWorkspaces();
  }, [isAuthenticated, authLoading, login]);

  const filteredWorkspaces = workspaces.filter(
    (workspace) =>
      workspace.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (workspace.description?.toLowerCase() || "").includes(searchQuery.toLowerCase())
  );

  // Format date for display
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  // Loading state
  if (authLoading || loadingState === "loading") {
    return (
      <AppLayout>
        <div className="">
          <div className="flex flex-col items-center justify-center p-16 text-center text-secondary">
            <SpinnerIcon className="w-8 h-8 mb-4" />
            <p>Loading workspaces...</p>
          </div>
        </div>
      </AppLayout>
    );
  }

  // Error state
  if (loadingState === "error") {
    return (
      <AppLayout>
        <div className="">
          <div className="flex flex-col items-center justify-center p-16 text-center">
            <h2 className="text-primary m-0 mb-2">Failed to load workspaces</h2>
            <p className="text-secondary m-0 mb-6">{errorMessage}</p>
            <Button
              color="bush"
              onClick={() => {
                setLoadingState("loading");
                setErrorMessage("");
                // Re-trigger fetch
                window.location.reload();
              }}
            >
              Try Again
            </Button>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div>
        <div className="flex items-start justify-between mb-12 gap-4 flex-wrap">
          <div>
            <h1 className="text-3xl font-bold text-primary m-0 mb-2">Workspaces</h1>
            <p className="text-sm text-secondary m-0">
              Manage your workspaces and collaborate with your team
            </p>
          </div>
          <Button color="bush" onClick={() => (window.location.href = "/workspaces/new")}>
            <PlusIcon className="w-4 h-4 mr-1.5" />
            New Workspace
          </Button>
        </div>

        <div className="mb-10">
          <div className="relative max-w-lg">
            <MagnifyingGlassIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
            <input
              type="text"
              placeholder="Search workspaces..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 text-sm bg-surface-3 border border-border-hover rounded-lg text-primary transition-colors placeholder:text-muted focus:outline-none focus:border-accent focus:ring-[3px] focus:ring-accent/15"
            />
          </div>
        </div>

        <div className="grid grid-cols-[repeat(auto-fill,minmax(320px,1fr))] gap-6">
          {filteredWorkspaces.map((workspace) => (
            <a
              key={workspace.id}
              href={`/workspaces/${workspace.id}`}
              className="flex flex-col p-8 bg-surface-3 border border-border-hover rounded-xl no-underline transition-all hover:border-accent/50 hover:shadow-lg hover:-translate-y-0.5 group"
            >
              <div className="mb-3">
                <h3 className="text-base font-semibold text-primary m-0 group-hover:text-accent transition-colors">
                  {workspace.name}
                </h3>
              </div>
              <p className="text-sm text-secondary mb-6 leading-relaxed flex-1 line-clamp-2">
                {workspace.description || "No description"}
              </p>
              <div className="pt-5 border-t border-border-hover">
                <span className="text-xs font-medium text-muted uppercase tracking-widest">
                  Created {formatDate(workspace.createdAt)}
                </span>
              </div>
            </a>
          ))}
        </div>

        {filteredWorkspaces.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 px-8 text-center">
            <p className="text-sm text-secondary mb-5">No workspaces found</p>
            {searchQuery && (
              <Button outline onClick={() => setSearchQuery("")}>
                Clear search
              </Button>
            )}
            {workspaces.length === 0 && (
              <Button color="bush" onClick={() => (window.location.href = "/workspaces/new")}>
                Create your first workspace
              </Button>
            )}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
