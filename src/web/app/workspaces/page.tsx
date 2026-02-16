/**
 * Bush Platform - Workspaces Page
 *
 * Lists all workspaces the user has access to.
 * Reference: IMPLEMENTATION_PLAN.md 1.7a
 */
"use client";

import { useState } from "react";
import { AppLayout } from "@/web/components/layout";
import { Button, Badge } from "@/web/components/ui";
import styles from "./workspaces.module.css";

interface Workspace {
  id: string;
  name: string;
  description: string;
  projectsCount: number;
  membersCount: number;
  storageUsed: string;
  role: "owner" | "admin" | "member";
}

export default function WorkspacesPage() {
  const [searchQuery, setSearchQuery] = useState("");

  // Mock data for static shell - will be replaced with real API calls
  const workspaces: Workspace[] = [
    {
      id: "1",
      name: "Marketing Team",
      description: "Marketing campaigns and brand assets",
      projectsCount: 8,
      membersCount: 12,
      storageUsed: "156 GB",
      role: "admin",
    },
    {
      id: "2",
      name: "Product Development",
      description: "Product demos, tutorials, and documentation",
      projectsCount: 5,
      membersCount: 8,
      storageUsed: "89 GB",
      role: "member",
    },
    {
      id: "3",
      name: "Client Projects",
      description: "External client work and deliverables",
      projectsCount: 15,
      membersCount: 6,
      storageUsed: "234 GB",
      role: "owner",
    },
  ];

  const filteredWorkspaces = workspaces.filter((workspace) =>
    workspace.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    workspace.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getRoleBadgeVariant = (role: Workspace["role"]) => {
    switch (role) {
      case "owner":
        return "primary";
      case "admin":
        return "success";
      default:
        return "default";
    }
  };

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
                <Badge variant={getRoleBadgeVariant(workspace.role)} size="sm">
                  {workspace.role}
                </Badge>
              </div>
              <p className={styles.cardDescription}>{workspace.description}</p>
              <div className={styles.cardStats}>
                <div className={styles.stat}>
                  <span className={styles.statValue}>{workspace.projectsCount}</span>
                  <span className={styles.statLabel}>Projects</span>
                </div>
                <div className={styles.stat}>
                  <span className={styles.statValue}>{workspace.membersCount}</span>
                  <span className={styles.statLabel}>Members</span>
                </div>
                <div className={styles.stat}>
                  <span className={styles.statValue}>{workspace.storageUsed}</span>
                  <span className={styles.statLabel}>Used</span>
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
          </div>
        )}
      </div>
    </AppLayout>
  );
}
