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
import { SpinnerIcon, Squares2X2Icon, ListBulletIcon, ChevronDownIcon } from "@/web/lib/icons";

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

  const getStatusBadgeColor = (project: Project) => {
    if (project.archivedAt) {
      return "zinc" as const;
    }
    if (project.isRestricted) {
      return "amber" as const;
    }
    return "green" as const;
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

  const formatRelativeTime = (dateString: string) => {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return "Unknown";
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    if (diffMs < 0) {
      return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    }
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  };

  // Loading state
  if (authLoading || loadingState === "loading") {
    return (
      <AppLayout>
        <div className="flex flex-col items-center justify-center py-16 px-8 text-center text-secondary">
          <SpinnerIcon className="w-8 h-8 text-accent mb-4" />
          <p>Loading projects...</p>
        </div>
      </AppLayout>
    );
  }

  // Error state
  if (loadingState === "error") {
    return (
      <AppLayout>
        <div className="flex flex-col items-center justify-center py-16 px-8 text-center">
          <h2 className="text-primary m-0 mb-2">Failed to load projects</h2>
          <p className="text-secondary m-0 mb-6">{errorMessage}</p>
          <Button
            color="bush"
            onClick={() => {
              setLoadingState("loading");
              setErrorMessage("");
              window.location.reload();
            }}
          >
            Try Again
          </Button>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div>
        <div className="flex items-start justify-between mb-12 gap-4 flex-wrap">
          <div>
            <h1 className="text-3xl font-bold text-primary m-0 mb-2">Projects</h1>
            <p className="text-sm text-secondary m-0">Browse and manage your projects</p>
          </div>
          <Button color="bush" onClick={() => (window.location.href = "/projects/new")}>
            New Project
          </Button>
        </div>

        <div className="flex items-center justify-between mb-10 gap-4 flex-wrap">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <input
              type="text"
              placeholder="Search projects..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex-1 min-w-0 px-4 py-2.5 text-sm bg-surface-3 border border-border-hover rounded-lg text-primary transition-colors focus:outline-none focus:border-accent focus:ring-[3px] focus:ring-accent/15 placeholder:text-muted"
            />
            <div className="relative shrink-0">
              <select
                value={filterWorkspace || "all"}
                onChange={(e) =>
                  setFilterWorkspace(e.target.value === "all" ? null : e.target.value)
                }
                className="px-4 py-2.5 pr-9 text-sm bg-surface-3 border border-border-hover rounded-lg text-primary cursor-pointer appearance-none focus:outline-none focus:border-accent focus:ring-[3px] focus:ring-accent/15"
              >
                <option value="all">All Workspaces</option>
                {workspaces.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                  </option>
                ))}
              </select>
              <ChevronDownIcon className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-secondary pointer-events-none" />
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <div className="flex border border-border-hover rounded-lg overflow-hidden">
              <button
                className={`px-3 py-2.5 border-none cursor-pointer transition-colors ${viewMode === "grid" ? "bg-surface-3 text-primary" : "bg-surface-2 text-muted hover:text-secondary hover:bg-surface-3"}`}
                onClick={() => setViewMode("grid")}
                aria-label="Grid view"
              >
                <Squares2X2Icon className="w-4 h-4" />
              </button>
              <button
                className={`px-3 py-2.5 border-none cursor-pointer transition-colors border-l border-border-default ${viewMode === "list" ? "bg-surface-3 text-primary" : "bg-surface-2 text-muted hover:text-secondary hover:bg-surface-3"}`}
                onClick={() => setViewMode("list")}
                aria-label="List view"
              >
                <ListBulletIcon className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {viewMode === "grid" ? (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-6">
            {filteredProjects.map((project) => (
              <a
                key={project.id}
                href={`/projects/${project.id}`}
                className="flex flex-col p-8 bg-surface-3 border border-border-hover rounded-xl no-underline transition-all hover:border-accent/50 hover:shadow-lg hover:-translate-y-0.5 group"
              >
                <div className="flex items-start justify-between gap-3 mb-4">
                  <h3 className="text-base font-semibold text-primary m-0 leading-snug group-hover:text-accent transition-colors">
                    {project.name}
                  </h3>
                  <Badge color={getStatusBadgeColor(project)} className="shrink-0">
                    {getStatusLabel(project)}
                  </Badge>
                </div>
                <p className="text-sm text-secondary leading-relaxed mb-6 flex-1 line-clamp-2">
                  {project.description || "No description"}
                </p>
                <div className="flex items-center justify-between pt-5 border-t border-border-hover">
                  <span className="text-xs text-muted">{project.workspaceName}</span>
                  <span className="text-xs text-muted">
                    {formatRelativeTime(project.updatedAt)}
                  </span>
                </div>
              </a>
            ))}
          </div>
        ) : (
          <div className="flex flex-col bg-surface-3 border border-border-hover rounded-xl overflow-hidden">
            {filteredProjects.map((project) => (
              <a
                key={project.id}
                href={`/projects/${project.id}`}
                className="flex items-center justify-between px-7 py-5 no-underline border-b border-border-hover last:border-b-0 transition-colors hover:bg-surface-4 group"
              >
                <div className="flex-1 min-w-0 mr-8">
                  <h3 className="text-sm font-semibold text-primary m-0 mb-0.5 group-hover:text-accent transition-colors">
                    {project.name}
                  </h3>
                  <p className="text-xs text-muted m-0 truncate">
                    {project.description || "No description"}
                  </p>
                </div>
                <div className="flex items-center gap-5 shrink-0">
                  <span className="text-xs text-muted whitespace-nowrap hidden md:block">
                    {project.workspaceName}
                  </span>
                  <Badge color={getStatusBadgeColor(project)}>{getStatusLabel(project)}</Badge>
                  <span className="text-xs text-muted whitespace-nowrap">
                    {formatRelativeTime(project.updatedAt)}
                  </span>
                </div>
              </a>
            ))}
          </div>
        )}

        {filteredProjects.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 px-8 text-center">
            <p className="text-sm text-secondary mb-5">No projects found</p>
            {(searchQuery || filterWorkspace) && (
              <Button
                outline
                onClick={() => {
                  setSearchQuery("");
                  setFilterWorkspace(null);
                }}
              >
                Clear filters
              </Button>
            )}
            {projects.length === 0 && workspaces.length > 0 && (
              <Button color="bush" onClick={() => (window.location.href = "/projects/new")}>
                Create your first project
              </Button>
            )}
            {workspaces.length === 0 && (
              <Button color="bush" onClick={() => (window.location.href = "/workspaces/new")}>
                Create a workspace first
              </Button>
            )}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
