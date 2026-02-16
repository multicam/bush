/**
 * Bush Platform - Home Page
 *
 * Landing page that redirects authenticated users to dashboard,
 * shows marketing content to unauthenticated users.
 */
"use client";

import { useEffect } from "react";
import { Button } from "@/web/components/ui";
import { useAuth } from "@/web/context";
import styles from "./home.module.css";

export default function HomePage() {
  const { isAuthenticated, isLoading } = useAuth();

  useEffect(() => {
    if (isAuthenticated && !isLoading) {
      window.location.href = "/dashboard";
    }
  }, [isAuthenticated, isLoading]);

  if (isLoading) {
    return (
      <div className={styles.loading}>
        <div className={styles.spinner}>Loading...</div>
      </div>
    );
  }

  if (isAuthenticated) {
    return (
      <div className={styles.loading}>
        <div className={styles.spinner}>Redirecting...</div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.container}>
          <div className={styles.logo}>Bush</div>
          <nav className={styles.nav}>
            <a href="#features">Features</a>
            <a href="#pricing">Pricing</a>
            <a href="/login" className={styles.navLink}>Sign In</a>
            <Button variant="primary" size="sm" onClick={() => window.location.href = "/signup"}>
              Get Started
            </Button>
          </nav>
        </div>
      </header>

      <main className={styles.main}>
        <section className={styles.hero}>
          <div className={styles.container}>
            <h1 className={styles.heroTitle}>
              Creative Collaboration,<br />Simplified
            </h1>
            <p className={styles.heroSubtitle}>
              Bush is the cloud-based platform for video, design, and marketing teams
              to collaborate on media assets in real-time.
            </p>
            <div className={styles.heroActions}>
              <Button
                variant="primary"
                size="lg"
                onClick={() => window.location.href = "/signup"}
              >
                Start Free Trial
              </Button>
              <Button
                variant="secondary"
                size="lg"
                onClick={() => window.location.href = "/login"}
              >
                Sign In
              </Button>
            </div>
          </div>
        </section>

        <section id="features" className={styles.features}>
          <div className={styles.container}>
            <h2 className={styles.sectionTitle}>Everything you need to collaborate</h2>
            <div className={styles.featureGrid}>
              <div className={styles.featureCard}>
                <span className={styles.featureIcon}>🎥</span>
                <h3>Video Review</h3>
                <p>Frame-accurate commenting and annotation tools for video review workflows.</p>
              </div>
              <div className={styles.featureCard}>
                <span className={styles.featureIcon}>📁</span>
                <h3>Asset Management</h3>
                <p>Organize files with workspaces, projects, folders, and custom metadata.</p>
              </div>
              <div className={styles.featureCard}>
                <span className={styles.featureIcon}>🔗</span>
                <h3>Easy Sharing</h3>
                <p>Create beautiful share links with custom branding and permissions.</p>
              </div>
              <div className={styles.featureCard}>
                <span className={styles.featureIcon}>⚡</span>
                <h3>Fast Uploads</h3>
                <p>Chunked uploads with resume support for files up to 5TB.</p>
              </div>
              <div className={styles.featureCard}>
                <span className={styles.featureIcon}>🔒</span>
                <h3>Secure & Private</h3>
                <p>Enterprise-grade security with SSO, 2FA, and audit logging.</p>
              </div>
              <div className={styles.featureCard}>
                <span className={styles.featureIcon}>💬</span>
                <h3>Real-time Comments</h3>
                <p>Collaborate in real-time with threaded comments and @mentions.</p>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className={styles.footer}>
        <div className={styles.container}>
          <p>© 2024 Bush. All rights reserved.</p>
          <div className={styles.footerLinks}>
            <a href="/privacy">Privacy</a>
            <a href="/terms">Terms</a>
            <a href="/contact">Contact</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
