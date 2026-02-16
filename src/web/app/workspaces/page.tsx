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
import {
  workspacesApi,
  extractCollectionAttributes,
  getErrorMessage,
  type WorkspaceAttributes,
} from "@/web/lib/api";
import styles from "./workspaces.module.css";

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

  const filteredWorkspaces = workspaces.filter((workspace) =>
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
        <div className={styles.page}>
          <div className={styles.loading}>
            <div className={styles.spinner}></div>
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
        <div className={styles.page}>
          <div className={styles.error}>
            <h2>Failed to load workspaces</h2>
            <p>{errorMessage}</p>
            <Button
              variant="primary"
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
      <div className={styles.page}>
        <div className={styles.header}>
          <div>
            <h1 className={styles.title}>Workspaces</h1>
            <p className={styles.subtitle}>
              Manage your workspaces and collaborate with your team
            </p>
          </div>
          <Button variant="primary" onClick={() => window.location.href = "/workspaces/new"}>
            New Workspace
          </Button>
        </div>

        {/* Search */}
        <div className={styles.searchContainer}>
          <input
            type="text"
            placeholder="Search workspaces..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={styles.searchInput}
          />
        </div>

        {/* Workspaces Grid */}
        <div className={styles.grid}>
          {filteredWorkspaces.map((workspace) => (
            <a
              key={workspace.id}
              href={`/workspaces/${workspace.id}`}
              className={styles.card}
            >
              <div className={styles.cardHeader}>
                <h3 className={styles.cardTitle}>{workspace.name}</h3>
              </div>
              <p className={styles.cardDescription}>
                {workspace.description || "No description"}
              </p>
              <div className={styles.cardStats}>
                <div className={styles.stat}>
                  <span className={styles.statLabel}>
                    Created {formatDate(workspace.createdAt)}
                  </span>
                </div>
              </div>
            </a>
          ))}
        </div>

        {filteredWorkspaces.length === 0 && (
          <div className={styles.empty}>
            <p>No workspaces found</p>
            {searchQuery && (
              <Button variant="secondary" onClick={() => setSearchQuery("")}>
                Clear search
              </Button>
            )}
            {workspaces.length === 0 && (
              <Button
                variant="primary"
                onClick={() => window.location.href = "/workspaces/new"}
              >
                Create your first workspace
              </Button>
            )}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
