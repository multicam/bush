/**
 * Bush Platform - Projects Page
 *
 * Lists all projects across workspaces or within a specific workspace.
 * Reference: IMPLEMENTATION_PLAN.md 1.7a
 */
"use client";

import { useState } from "react";
import { AppLayout } from "@/web/components/layout";
import { Button, Badge } from "@/web/components/ui";
import styles from "./projects.module.css";

interface Project {
  id: string;
  name: string;
  workspaceId: string;
  workspaceName: string;
  description: string;
  filesCount: number;
  lastUpdated: string;
  status: "active" | "archived" | "restricted";
}

export default function ProjectsPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [filterWorkspace, setFilterWorkspace] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  // Mock data for static shell
  const projects: Project[] = [
    {
      id: "1",
      name: "Marketing Campaign Q1",
      workspaceId: "1",
      workspaceName: "Marketing Team",
      description: "Q1 marketing campaign assets and videos",
      filesCount: 45,
      lastUpdated: "2 hours ago",
      status: "active",
    },
    {
      id: "2",
      name: "Product Launch Video",
      workspaceId: "2",
      workspaceName: "Product Development",
      description: "Main product launch video and related assets",
      filesCount: 23,
      lastUpdated: "4 hours ago",
      status: "active",
    },
    {
      id: "3",
      name: "Brand Guidelines 2024",
      workspaceId: "1",
      workspaceName: "Marketing Team",
      description: "Updated brand guidelines and assets",
      filesCount: 12,
      lastUpdated: "1 day ago",
      status: "archived",
    },
    {
      id: "4",
      name: "Client ABC Presentation",
      workspaceId: "3",
      workspaceName: "Client Projects",
      description: "Presentation materials for Client ABC",
      filesCount: 34,
      lastUpdated: "3 days ago",
      status: "restricted",
    },
    {
      id: "5",
      name: "Tutorial Series",
      workspaceId: "2",
      workspaceName: "Product Development",
      description: "Product tutorial video series",
      filesCount: 18,
      lastUpdated: "1 week ago",
      status: "active",
    },
  ];

  const workspaces = [
    { id: "1", name: "Marketing Team" },
    { id: "2", name: "Product Development" },
    { id: "3", name: "Client Projects" },
  ];

  const filteredProjects = projects.filter((project) => {
    const matchesSearch =
      project.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      project.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesWorkspace = !filterWorkspace || project.workspaceId === filterWorkspace;
    return matchesSearch && matchesWorkspace;
  });

  const getStatusBadgeVariant = (status: Project["status"]) => {
    switch (status) {
      case "active":
        return "success";
      case "archived":
        return "default";
      case "restricted":
        return "warning";
      default:
        return "default";
    }
  };

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
                ⊞
              </button>
              <button
                className={`${styles.viewBtn} ${viewMode === "list" ? styles.active : ""}`}
                onClick={() => setViewMode("list")}
                aria-label="List view"
              >
                ☰
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
                  <Badge variant={getStatusBadgeVariant(project.status)} size="sm">
                    {project.status}
                  </Badge>
                </div>
                <h3 className={styles.cardTitle}>{project.name}</h3>
                <p className={styles.cardDescription}>{project.description}</p>
                <div className={styles.cardMeta}>
                  <span className={styles.workspaceName}>{project.workspaceName}</span>
                  <span className={styles.separator}>•</span>
                  <span>{project.filesCount} files</span>
                </div>
                <div className={styles.cardFooter}>
                  <span className={styles.lastUpdated}>Updated {project.lastUpdated}</span>
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
                  <p className={styles.listDescription}>{project.description}</p>
                </div>
                <div className={styles.listMeta}>
                  <span className={styles.workspaceName}>{project.workspaceName}</span>
                  <Badge variant={getStatusBadgeVariant(project.status)} size="sm">
                    {project.status}
                  </Badge>
                  <span className={styles.fileCount}>{project.filesCount} files</span>
                  <span className={styles.lastUpdated}>{project.lastUpdated}</span>
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
          </div>
        )}
      </div>
    </AppLayout>
  );
}
