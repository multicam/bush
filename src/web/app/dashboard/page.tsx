/**
 * Bush Platform - Dashboard Page
 *
 * Main dashboard showing overview of workspaces, recent activity, and quick actions.
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
import {
  SpinnerIcon,
  ArrowUpTrayIcon,
  ShareIcon,
  UserGroupIcon,
  FolderPlusIcon,
} from "@/web/lib/icons";

interface Workspace extends WorkspaceAttributes {
  id: string;
}

interface Project extends ProjectAttributes {
  id: string;
  workspaceName?: string;
}

interface DashboardStats {
  workspacesCount: number;
  projectsCount: number;
}

type LoadingState = "loading" | "error" | "loaded";

export default function DashboardPage() {
  const { user, isAuthenticated, isLoading: authLoading, login } = useAuth();
  const [recentProjects, setRecentProjects] = useState<Project[]>([]);
  const [stats, setStats] = useState<DashboardStats>({
    workspacesCount: 0,
    projectsCount: 0,
  });
  const [loadingState, setLoadingState] = useState<LoadingState>("loading");
  const [errorMessage, setErrorMessage] = useState<string>("");

  useEffect(() => {
    async function fetchDashboardData() {
      // Wait for auth to load
      if (authLoading) return;

      // Redirect to login if not authenticated
      if (!isAuthenticated) {
        login(window.location.pathname);
        return;
      }

      try {
        setLoadingState("loading");

        // Fetch workspaces
        const workspacesResponse = await workspacesApi.list();
        const workspaceItems = extractCollectionAttributes(workspacesResponse) as Workspace[];

        // Fetch projects for each workspace
        const allProjects: Project[] = [];
        for (const workspace of workspaceItems) {
          try {
            const projectsResponse = await projectsApi.list(workspace.id, { limit: 10 });
            const projectItems = extractCollectionAttributes(projectsResponse) as Project[];
            const projectsWithWorkspace = projectItems.map((p) => ({
              ...p,
              workspaceName: workspace.name,
            }));
            allProjects.push(...projectsWithWorkspace);
          } catch (error) {
            console.error(`Failed to fetch projects for workspace ${workspace.id}:`, error);
          }
        }

        // Sort by updated date and take the most recent 5
        const sortedProjects = allProjects
          .filter((p) => !p.archivedAt) // Only active projects
          .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
          .slice(0, 5);
        setRecentProjects(sortedProjects);

        // Set stats
        setStats({
          workspacesCount: workspaceItems.length,
          projectsCount: allProjects.filter((p) => !p.archivedAt).length,
        });

        setLoadingState("loaded");
      } catch (error) {
        console.error("Failed to fetch dashboard data:", error);
        setErrorMessage(getErrorMessage(error));
        setLoadingState("error");
      }
    }

    fetchDashboardData();
  }, [isAuthenticated, authLoading, login]);

  // Loading state
  if (authLoading || loadingState === "loading") {
    return (
      <AppLayout>
        <div className="p-8 max-w-[80rem] mx-auto">
          <div className="flex flex-col items-center justify-center py-16 px-8 text-center text-secondary">
            <SpinnerIcon className="w-8 h-8 mb-4 text-accent" />
            <p className="m-0">Loading dashboard...</p>
          </div>
        </div>
      </AppLayout>
    );
  }

  // Error state
  if (loadingState === "error") {
    return (
      <AppLayout>
        <div className="p-8 max-w-[80rem] mx-auto">
          <div className="flex flex-col items-center justify-center py-16 px-8 text-center">
            <h2 className="text-primary m-0 mb-2">Failed to load dashboard</h2>
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
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="p-8 max-w-[80rem] mx-auto">
        <div className="flex items-start justify-between mb-8 flex-col gap-4 sm:flex-row sm:gap-0">
          <div>
            <h1 className="text-3xl font-bold text-primary m-0">Dashboard</h1>
            <p className="mt-1 text-sm text-secondary">
              Welcome back{user?.firstName ? `, ${user.firstName}` : ""}!
            </p>
          </div>
          <div className="flex gap-3 w-full sm:w-auto">
            <Button
              outline
              className="flex-1 sm:flex-initial"
              onClick={() => (window.location.href = "/workspaces")}
            >
              View Workspaces
            </Button>
            <Button
              color="bush"
              className="flex-1 sm:flex-initial"
              onClick={() => (window.location.href = "/projects/new")}
            >
              New Project
            </Button>
          </div>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <div className="bg-surface-2 border border-border-default rounded-md p-5 text-center">
            <span className="block text-3xl font-bold text-primary">{stats.workspacesCount}</span>
            <span className="block text-xs text-secondary mt-1 uppercase tracking-wide">
              Workspaces
            </span>
          </div>
          <div className="bg-surface-2 border border-border-default rounded-md p-5 text-center">
            <span className="block text-3xl font-bold text-primary">{stats.projectsCount}</span>
            <span className="block text-xs text-secondary mt-1 uppercase tracking-wide">
              Projects
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          {/* Recent Projects */}
          <section className="bg-surface-2 border border-border-default rounded-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold text-primary m-0">Recent Projects</h2>
              <a href="/projects" className="text-xs text-accent no-underline hover:underline">
                View all
              </a>
            </div>
            {recentProjects.length > 0 ? (
              <div className="flex flex-col gap-2">
                {recentProjects.map((project) => (
                  <a
                    key={project.id}
                    href={`/projects/${project.id}`}
                    className="flex items-center justify-between p-3 bg-surface-1 border border-border-default rounded-sm no-underline transition-colors hover:border-accent hover:bg-surface-2"
                  >
                    <div className="flex flex-col gap-0.5">
                      <span className="text-sm font-medium text-primary">{project.name}</span>
                      <span className="text-xs text-secondary">{project.workspaceName}</span>
                    </div>
                    <Badge color={project.isRestricted ? "amber" : "green"}>
                      {project.isRestricted ? "restricted" : "active"}
                    </Badge>
                  </a>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center p-8 text-center text-secondary">
                <p className="mb-4">No projects yet</p>
                <Button color="bush" onClick={() => (window.location.href = "/projects/new")}>
                  Create your first project
                </Button>
              </div>
            )}
          </section>

          {/* Quick Actions */}
          <section className="bg-surface-2 border border-border-default rounded-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold text-primary m-0">Quick Actions</h2>
            </div>
            <div className="flex flex-col gap-2">
              <a
                href="/files/upload"
                className="flex items-center gap-3 p-3 bg-surface-1 border border-border-default rounded-sm no-underline transition-colors hover:border-accent hover:bg-surface-2"
              >
                <ArrowUpTrayIcon className="w-4 h-4 text-secondary" />
                <span className="text-sm text-primary">Upload Files</span>
              </a>
              <a
                href="/shares/new"
                className="flex items-center gap-3 p-3 bg-surface-1 border border-border-default rounded-sm no-underline transition-colors hover:border-accent hover:bg-surface-2"
              >
                <ShareIcon className="w-4 h-4 text-secondary" />
                <span className="text-sm text-primary">Create Share</span>
              </a>
              <a
                href="/settings/team"
                className="flex items-center gap-3 p-3 bg-surface-1 border border-border-default rounded-sm no-underline transition-colors hover:border-accent hover:bg-surface-2"
              >
                <UserGroupIcon className="w-4 h-4 text-secondary" />
                <span className="text-sm text-primary">Invite Team</span>
              </a>
              <a
                href="/workspaces/new"
                className="flex items-center gap-3 p-3 bg-surface-1 border border-border-default rounded-sm no-underline transition-colors hover:border-accent hover:bg-surface-2"
              >
                <FolderPlusIcon className="w-4 h-4 text-secondary" />
                <span className="text-sm text-primary">New Workspace</span>
              </a>
            </div>
          </section>
        </div>

        {/* Getting Started */}
        {stats.workspacesCount === 0 && (
          <section className="bg-surface-2 border border-border-default rounded-md p-8 text-center">
            <h2 className="text-base font-semibold text-primary m-0">Getting Started</h2>
            <p className="text-secondary mb-6">
              Welcome to Bush! To get started, create your first workspace to organize your projects
              and files.
            </p>
            <Button color="bush" onClick={() => (window.location.href = "/workspaces/new")}>
              Create your first workspace
            </Button>
          </section>
        )}
      </div>
    </AppLayout>
  );
}
