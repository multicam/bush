/**
 * Bush Platform - Shares List Page
 *
 * Displays all shares for the current account with search and filtering.
 */
"use client";

import { useState, useEffect } from "react";
import { AppLayout } from "@/web/components/layout";
import { Button } from "@/web/components/ui";
import { useAuth } from "@/web/context";
import {
  sharesApi,
  projectsApi,
  workspacesApi,
  extractCollectionAttributes,
  getErrorMessage,
  type ShareAttributes,
  type ProjectAttributes,
  type WorkspaceAttributes,
} from "@/web/lib/api";
import { ShareCard } from "@/web/components/shares";
import type { ShareWithRelationships } from "@/web/components/shares/types";
import styles from "./shares.module.css";

interface Share extends ShareAttributes {
  id: string;
}

interface Project extends ProjectAttributes {
  id: string;
}

interface Workspace extends WorkspaceAttributes {
  id: string;
}

type LoadingState = "loading" | "error" | "loaded";

export default function SharesPage() {
  const { isAuthenticated, isLoading: authLoading, login, currentAccount } = useAuth();
  const [shares, setShares] = useState<ShareWithRelationships[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [loadingState, setLoadingState] = useState<LoadingState>("loading");
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");
  const [filterProject, setFilterProject] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      if (authLoading) return;

      if (!isAuthenticated || !currentAccount) {
        if (!isAuthenticated) {
          login(window.location.pathname);
        }
        return;
      }

      try {
        setLoadingState("loading");

        // Fetch workspaces and projects in parallel
        const [workspacesResponse] = await Promise.all([
          workspacesApi.list(),
        ]);

        const workspaceItems = extractCollectionAttributes(workspacesResponse) as Workspace[];
        setWorkspaces(workspaceItems);

        // Fetch projects for each workspace
        const allProjects: Project[] = [];
        for (const workspace of workspaceItems) {
          try {
            const projectsResponse = await projectsApi.list(workspace.id);
            const projectItems = extractCollectionAttributes(projectsResponse) as Project[];
            allProjects.push(...projectItems);
          } catch (error) {
            console.error(`Failed to fetch projects for workspace ${workspace.id}:`, error);
          }
        }
        setProjects(allProjects);

        // Fetch shares for the account
        const sharesResponse = await sharesApi.list(currentAccount.id, { limit: 100 });
        const shareItems = extractCollectionAttributes(sharesResponse) as Share[];

        // Transform shares to include relationships
        const sharesWithRelationships: ShareWithRelationships[] = shareItems.map((share) => {
          const project = allProjects.find((p) => p.id === share.projectId);
          return {
            ...share,
            id: share.id,
            project: project ? { id: project.id, name: project.name } : undefined,
            created_by: share.created_by,
          };
        });

        setShares(sharesWithRelationships);
        setLoadingState("loaded");
      } catch (error) {
        console.error("Failed to fetch data:", error);
        setErrorMessage(getErrorMessage(error));
        setLoadingState("error");
      }
    }

    fetchData();
  }, [isAuthenticated, authLoading, login, currentAccount]);

  const filteredShares = shares.filter((share) => {
    const matchesSearch =
      share.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      share.slug.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesProject = !filterProject || share.projectId === filterProject;
    return matchesSearch && matchesProject;
  });

  const handleDuplicate = async (shareId: string) => {
    try {
      await sharesApi.duplicate(shareId);
      // Refresh the list
      window.location.reload();
    } catch (error) {
      console.error("Failed to duplicate share:", error);
      alert("Failed to duplicate share: " + getErrorMessage(error));
    }
  };

  const handleDelete = async (shareId: string) => {
    if (!confirm("Are you sure you want to delete this share? This action cannot be undone.")) {
      return;
    }

    try {
      await sharesApi.delete(shareId);
      setShares((prev) => prev.filter((s) => s.id !== shareId));
    } catch (error) {
      console.error("Failed to delete share:", error);
      alert("Failed to delete share: " + getErrorMessage(error));
    }
  };

  // Loading state
  if (authLoading || loadingState === "loading") {
    return (
      <AppLayout>
        <div className={styles.sharesPage}>
          <div className={styles.loading}>
            <div className={styles.spinner}></div>
            <p>Loading shares...</p>
          </div>
        </div>
      </AppLayout>
    );
  }

  // Error state
  if (loadingState === "error") {
    return (
      <AppLayout>
        <div className={styles.sharesPage}>
          <div className={styles.error}>
            <h2>Failed to load shares</h2>
            <p>{errorMessage}</p>
            <Button
              variant="primary"
              onClick={() => {
                setLoadingState("loading");
                setErrorMessage("");
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
      <div className={styles.sharesPage}>
        <div className={styles.sharesHeader}>
          <div>
            <h1 className={styles.sharesTitle}>Shares</h1>
            <p className={styles.sharesSubtitle}>
              Manage share links for presenting assets to stakeholders
            </p>
          </div>
          <Button variant="primary" onClick={() => window.location.href = "/shares/new"}>
            Create Share
          </Button>
        </div>

        {/* Toolbar */}
        <div className={styles.sharesToolbar}>
          <input
            type="text"
            placeholder="Search shares..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={styles.sharesSearch}
          />
          <select
            value={filterProject || "all"}
            onChange={(e) => setFilterProject(e.target.value === "all" ? null : e.target.value)}
            className={styles.sharesFilter}
          >
            <option value="all">All Projects</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>

        {/* Shares Grid */}
        {filteredShares.length > 0 ? (
          <div className={styles.sharesGrid}>
            {filteredShares.map((share) => (
              <ShareCard
                key={share.id}
                share={share}
                onDuplicate={handleDuplicate}
                onDelete={handleDelete}
              />
            ))}
          </div>
        ) : (
          <div className={styles.sharesEmpty}>
            <span className={styles.sharesEmptyIcon}>🔗</span>
            <h3 className={styles.sharesEmptyTitle}>
              {searchQuery || filterProject ? "No shares found" : "No shares yet"}
            </h3>
            <p className={styles.sharesEmptyDescription}>
              {searchQuery || filterProject
                ? "Try adjusting your search or filters"
                : "Create your first share to start presenting assets to stakeholders"}
            </p>
            {!searchQuery && !filterProject && (
              <Button variant="primary" onClick={() => window.location.href = "/shares/new"}>
                Create Your First Share
              </Button>
            )}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
