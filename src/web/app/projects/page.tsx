/**
 * Bush Platform - Projects Page
 *
 * Lists all projects across workspaces or within a specific workspace.
 * Reference: IMPLEMENTATION_PLAN.md 1.7a
 */
"use client";

import { useState, useEffect } from "react";
import { AppLayout } from "@/web/components/layout";
import { Button, Badge } from "@/web/components/ui";
import { useAuth } from "@/web/context";
import {
  workspacesApi,
  projectsApi,
  extractCollectionAttributes,
  getErrorMessage,
  type WorkspaceAttributes,
  type ProjectAttributes,
} from "@/web/lib/api";
import styles from "./projects.module.css";

interface Workspace extends WorkspaceAttributes {
  id: string;
}

interface Project extends ProjectAttributes {
  id: string;
  workspaceName?: string;
}

type LoadingState = "loading" | "error" | "loaded";

export default function ProjectsPage() {
  const { isAuthenticated, isLoading: authLoading, login } = useAuth();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loadingState, setLoadingState] = useState<LoadingState>("loading");
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");
  const [filterWorkspace, setFilterWorkspace] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  useEffect(() => {
    async function fetchData() {
      // Wait for auth to load
      if (authLoading) return;

      // Redirect to login if not authenticated
      if (!isAuthenticated) {
        login(window.location.pathname);
        return;
      }

      try {
        setLoadingState("loading");

        // Fetch workspaces first
        const workspacesResponse = await workspacesApi.list();
        const workspaceItems = extractCollectionAttributes(workspacesResponse) as Workspace[];
        setWorkspaces(workspaceItems);

        // Fetch projects for each workspace
        const allProjects: Project[] = [];
        for (const workspace of workspaceItems) {
          try {
            const projectsResponse = await projectsApi.list(workspace.id);
            const projectItems = extractCollectionAttributes(projectsResponse) as Project[];
            // Add workspace name to each project
            const projectsWithWorkspace = projectItems.map((p) => ({
              ...p,
              workspaceName: workspace.name,
            }));
            allProjects.push(...projectsWithWorkspace);
          } catch (error) {
            // Log but continue with other workspaces
            console.error(`Failed to fetch projects for workspace ${workspace.id}:`, error);
          }
        }

        setProjects(allProjects);
        setLoadingState("loaded");
      } catch (error) {
        console.error("Failed to fetch data:", error);
        setErrorMessage(getErrorMessage(error));
        setLoadingState("error");
      }
    }

    fetchData();
  }, [isAuthenticated, authLoading, login]);

  const filteredProjects = projects.filter((project) => {
    const matchesSearch =
      project.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (project.description?.toLowerCase() || "").includes(searchQuery.toLowerCase());
    const matchesWorkspace = !filterWorkspace || project.workspaceId === filterWorkspace;
    return matchesSearch && matchesWorkspace;
  });

  const getStatusBadgeVariant = (project: Project) => {
    if (project.archivedAt) {
      return "default";
    }
    if (project.isRestricted) {
      return "warning";
    }
    return "success";
  };

  const getStatusLabel = (project: Project) => {
    if (project.archivedAt) {
      return "archived";
    }
    if (project.isRestricted) {
      return "restricted";
    }
    return "active";
  };

  // Format relative time
  const formatRelativeTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 60) {
      return `${diffMins} minute${diffMins !== 1 ? "s" : ""} ago`;
    }
    if (diffHours < 24) {
      return `${diffHours} hour${diffHours !== 1 ? "s" : ""} ago`;
    }
    if (diffDays < 7) {
      return `${diffDays} day${diffDays !== 1 ? "s" : ""} ago`;
    }
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
            <p>Loading projects...</p>
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
            <h2>Failed to load projects</h2>
            <p>{errorMessage}</p>
            <Button
              variant="primary"
              onClick={() => {
                setLoadingState("loading");
                setErrorMessage("");
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
            <h1 className={styles.title}>Projects</h1>
            <p className={styles.subtitle}>
              Browse and manage your projects
            </p>
          </div>
          <Button variant="primary" onClick={() => window.location.href = "/projects/new"}>
            New Project
          </Button>
        </div>

        {/* Toolbar */}
        <div className={styles.toolbar}>
          <div className={styles.toolbarLeft}>
            <input
              type="text"
              placeholder="Search projects..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={styles.searchInput}
            />
            <select
              value={filterWorkspace || "all"}
              onChange={(e) => setFilterWorkspace(e.target.value === "all" ? null : e.target.value)}
              className={styles.filterSelect}
            >
              <option value="all">All Workspaces</option>
              {workspaces.map((w) => (
                <option key={w.id} value={w.id}>{w.name}</option>
              ))}
            </select>
          </div>
          <div className={styles.toolbarRight}>
            <div className={styles.viewToggle}>
              <button
                className={`${styles.viewBtn} ${viewMode === "grid" ? styles.active : ""}`}
                onClick={() => setViewMode("grid")}
                aria-label="Grid view"
              >
                +
              </button>
              <button
                className={`${styles.viewBtn} ${viewMode === "list" ? styles.active : ""}`}
                onClick={() => setViewMode("list")}
                aria-label="List view"
              >
                =
              </button>
            </div>
          </div>
        </div>

        {/* Projects */}
        {viewMode === "grid" ? (
          <div className={styles.grid}>
            {filteredProjects.map((project) => (
              <a
                key={project.id}
                href={`/projects/${project.id}`}
                className={styles.card}
              >
                <div className={styles.cardHeader}>
                  <Badge variant={getStatusBadgeVariant(project)} size="sm">
                    {getStatusLabel(project)}
                  </Badge>
                </div>
                <h3 className={styles.cardTitle}>{project.name}</h3>
                <p className={styles.cardDescription}>
                  {project.description || "No description"}
                </p>
                <div className={styles.cardMeta}>
                  <span className={styles.workspaceName}>{project.workspaceName}</span>
                </div>
                <div className={styles.cardFooter}>
                  <span className={styles.lastUpdated}>
                    Updated {formatRelativeTime(project.updatedAt)}
                  </span>
                </div>
              </a>
            ))}
          </div>
        ) : (
          <div className={styles.list}>
            {filteredProjects.map((project) => (
              <a
                key={project.id}
                href={`/projects/${project.id}`}
                className={styles.listItem}
              >
                <div className={styles.listInfo}>
                  <h3 className={styles.listTitle}>{project.name}</h3>
                  <p className={styles.listDescription}>
                    {project.description || "No description"}
                  </p>
                </div>
                <div className={styles.listMeta}>
                  <span className={styles.workspaceName}>{project.workspaceName}</span>
                  <Badge variant={getStatusBadgeVariant(project)} size="sm">
                    {getStatusLabel(project)}
                  </Badge>
                  <span className={styles.lastUpdated}>
                    {formatRelativeTime(project.updatedAt)}
                  </span>
                </div>
              </a>
            ))}
          </div>
        )}

        {filteredProjects.length === 0 && (
          <div className={styles.empty}>
            <p>No projects found</p>
            {(searchQuery || filterWorkspace) && (
              <Button
                variant="secondary"
                onClick={() => {
                  setSearchQuery("");
                  setFilterWorkspace(null);
                }}
              >
                Clear filters
              </Button>
            )}
            {projects.length === 0 && workspaces.length > 0 && (
              <Button
                variant="primary"
                onClick={() => window.location.href = "/projects/new"}
              >
                Create your first project
              </Button>
            )}
            {workspaces.length === 0 && (
              <Button
                variant="primary"
                onClick={() => window.location.href = "/workspaces/new"}
              >
                Create a workspace first
              </Button>
            )}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
