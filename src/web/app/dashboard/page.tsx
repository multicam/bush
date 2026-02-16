/**
 * Bush Platform - Dashboard Page
 *
 * Main dashboard showing overview of workspaces, recent activity, and quick actions.
 * Reference: IMPLEMENTATION_PLAN.md 1.7a
 */
"use client";

import { AppLayout } from "@/web/components/layout";
import { Button, Badge } from "@/web/components/ui";
import { useAuth } from "@/web/context";
import styles from "./dashboard.module.css";

export default function DashboardPage() {
  const { user } = useAuth();

  // Mock data for static shell - will be replaced with real API calls
  const recentProjects = [
    { id: "1", name: "Marketing Campaign Q1", files: 45, status: "active" },
    { id: "2", name: "Product Launch Video", files: 23, status: "active" },
    { id: "3", name: "Brand Guidelines 2024", files: 12, status: "archived" },
  ];

  const recentActivity = [
    { id: "1", type: "upload", message: "John uploaded final_cut_v3.mp4", time: "2 hours ago" },
    { id: "2", type: "comment", message: "Sarah commented on brand_logo.png", time: "4 hours ago" },
    { id: "3", type: "share", message: "You shared Project Overview with client", time: "1 day ago" },
  ];

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
            <span className={styles.statValue}>3</span>
            <span className={styles.statLabel}>Workspaces</span>
          </div>
          <div className={styles.statCard}>
            <span className={styles.statValue}>12</span>
            <span className={styles.statLabel}>Projects</span>
          </div>
          <div className={styles.statCard}>
            <span className={styles.statValue}>248</span>
            <span className={styles.statLabel}>Files</span>
          </div>
          <div className={styles.statCard}>
            <span className={styles.statValue}>15</span>
            <span className={styles.statLabel}>Team Members</span>
          </div>
        </div>

        <div className={styles.grid}>
          {/* Recent Projects */}
          <section className={styles.section}>
            <div className={styles.sectionHeader}>
              <h2 className={styles.sectionTitle}>Recent Projects</h2>
              <a href="/projects" className={styles.sectionLink}>View all</a>
            </div>
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
                      {project.files} files
                    </span>
                  </div>
                  <Badge
                    variant={project.status === "active" ? "success" : "default"}
                    size="sm"
                  >
                    {project.status}
                  </Badge>
                </a>
              ))}
            </div>
          </section>

          {/* Recent Activity */}
          <section className={styles.section}>
            <div className={styles.sectionHeader}>
              <h2 className={styles.sectionTitle}>Recent Activity</h2>
            </div>
            <div className={styles.activityList}>
              {recentActivity.map((activity) => (
                <div key={activity.id} className={styles.activityItem}>
                  <div className={styles.activityIcon}>
                    {activity.type === "upload" && "📤"}
                    {activity.type === "comment" && "💬"}
                    {activity.type === "share" && "🔗"}
                  </div>
                  <div className={styles.activityContent}>
                    <span className={styles.activityMessage}>{activity.message}</span>
                    <span className={styles.activityTime}>{activity.time}</span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* Quick Actions */}
        <section className={styles.quickActions}>
          <h2 className={styles.sectionTitle}>Quick Actions</h2>
          <div className={styles.actionGrid}>
            <a href="/files/upload" className={styles.actionCard}>
              <span className={styles.actionIcon}>📤</span>
              <span className={styles.actionLabel}>Upload Files</span>
            </a>
            <a href="/shares/new" className={styles.actionCard}>
              <span className={styles.actionIcon}>🔗</span>
              <span className={styles.actionLabel}>Create Share</span>
            </a>
            <a href="/settings/team" className={styles.actionCard}>
              <span className={styles.actionIcon}>👥</span>
              <span className={styles.actionLabel}>Invite Team</span>
            </a>
            <a href="/collections/new" className={styles.actionCard}>
              <span className={styles.actionIcon}>📑</span>
              <span className={styles.actionLabel}>New Collection</span>
            </a>
          </div>
        </section>
      </div>
    </AppLayout>
  );
}
