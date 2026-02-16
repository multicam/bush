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
import styles from "./dashboard.module.css";

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
        <div className={styles.page}>
          <div className={styles.loading}>
            <div className={styles.spinner}></div>
            <p>Loading dashboard...</p>
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
            <h2>Failed to load dashboard</h2>
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
            <h1 className={styles.title}>Dashboard</h1>
            <p className={styles.subtitle}>
              Welcome back{user?.firstName ? `, ${user.firstName}` : ""}!
            </p>
          </div>
          <div className={styles.actions}>
            <Button variant="secondary" onClick={() => window.location.href = "/workspaces"}>
              View Workspaces
            </Button>
            <Button variant="primary" onClick={() => window.location.href = "/projects/new"}>
              New Project
            </Button>
          </div>
        </div>

        {/* Stats Overview */}
        <div className={styles.stats}>
          <div className={styles.statCard}>
            <span className={styles.statValue}>{stats.workspacesCount}</span>
            <span className={styles.statLabel}>Workspaces</span>
          </div>
          <div className={styles.statCard}>
            <span className={styles.statValue}>{stats.projectsCount}</span>
            <span className={styles.statLabel}>Projects</span>
          </div>
        </div>

        <div className={styles.grid}>
          {/* Recent Projects */}
          <section className={styles.section}>
            <div className={styles.sectionHeader}>
              <h2 className={styles.sectionTitle}>Recent Projects</h2>
              <a href="/projects" className={styles.sectionLink}>View all</a>
            </div>
            {recentProjects.length > 0 ? (
              <div className={styles.projectList}>
                {recentProjects.map((project) => (
                  <a
                    key={project.id}
                    href={`/projects/${project.id}`}
                    className={styles.projectCard}
                  >
                    <div className={styles.projectInfo}>
                      <span className={styles.projectName}>{project.name}</span>
                      <span className={styles.projectMeta}>
                        {project.workspaceName}
                      </span>
                    </div>
                    <Badge
                      variant={project.isRestricted ? "warning" : "success"}
                      size="sm"
                    >
                      {project.isRestricted ? "restricted" : "active"}
                    </Badge>
                  </a>
                ))}
              </div>
            ) : (
              <div className={styles.emptySection}>
                <p>No projects yet</p>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => window.location.href = "/projects/new"}
                >
                  Create your first project
                </Button>
              </div>
            )}
          </section>

          {/* Quick Actions */}
          <section className={styles.section}>
            <div className={styles.sectionHeader}>
              <h2 className={styles.sectionTitle}>Quick Actions</h2>
            </div>
            <div className={styles.actionList}>
              <a href="/files/upload" className={styles.actionItem}>
                <span className={styles.actionIcon}>+</span>
                <span className={styles.actionLabel}>Upload Files</span>
              </a>
              <a href="/shares/new" className={styles.actionItem}>
                <span className={styles.actionIcon}>#</span>
                <span className={styles.actionLabel}>Create Share</span>
              </a>
              <a href="/settings/team" className={styles.actionItem}>
                <span className={styles.actionIcon}>*</span>
                <span className={styles.actionLabel}>Invite Team</span>
              </a>
              <a href="/workspaces/new" className={styles.actionItem}>
                <span className={styles.actionIcon}>+</span>
                <span className={styles.actionLabel}>New Workspace</span>
              </a>
            </div>
          </section>
        </div>

        {/* Getting Started */}
        {stats.workspacesCount === 0 && (
          <section className={styles.gettingStarted}>
            <h2 className={styles.sectionTitle}>Getting Started</h2>
            <p className={styles.gettingStartedText}>
              Welcome to Bush! To get started, create your first workspace to organize your projects and files.
            </p>
            <Button
              variant="primary"
              onClick={() => window.location.href = "/workspaces/new"}
            >
              Create your first workspace
            </Button>
          </section>
        )}
      </div>
    </AppLayout>
  );
}
