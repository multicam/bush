/**
 * Bush Platform - Login Page
 *
 * Login page that redirects to WorkOS AuthKit for authentication.
 * Reference: IMPLEMENTATION_PLAN.md 1.7a
 */
"use client";

import { Suspense, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/web/components/ui";
import { useAuth } from "@/web/context";
import styles from "./login.module.css";

function LoginContent() {
  const { isAuthenticated, isLoading, login } = useAuth();
  const searchParams = useSearchParams();
  const redirect = searchParams.get("redirect") || "/dashboard";

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated && !isLoading) {
      window.location.href = redirect;
    }
  }, [isAuthenticated, isLoading, redirect]);

  const handleLogin = () => {
    login(redirect);
  };

  if (isLoading) {
    return (
      <div className={styles.container}>
        <div className={styles.card}>
          <div className={styles.loading}>Loading...</div>
        </div>
      </div>
    );
  }

  if (isAuthenticated) {
    return (
      <div className={styles.container}>
        <div className={styles.card}>
          <div className={styles.loading}>Redirecting...</div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <div className={styles.header}>
          <h1 className={styles.logo}>Bush</h1>
          <p className={styles.tagline}>Creative Collaboration Platform</p>
        </div>

        <div className={styles.content}>
          <p className={styles.description}>
            Sign in to access your workspaces, projects, and collaborate with your team.
          </p>

          <Button
            variant="primary"
            size="lg"
            onClick={handleLogin}
            className={styles.loginButton}
          >
            Sign in with WorkOS
          </Button>

          <p className={styles.terms}>
            By signing in, you agree to our{" "}
            <a href="/terms" className={styles.link}>Terms of Service</a>
            {" "}and{" "}
            <a href="/privacy" className={styles.link}>Privacy Policy</a>.
          </p>
        </div>

        <div className={styles.footer}>
          <p>Don&apos;t have an account?{" "}
            <a href="/signup" className={styles.link}>Sign up</a>
          </p>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className={styles.container}>
        <div className={styles.card}>
          <div className={styles.loading}>Loading...</div>
        </div>
      </div>
    }>
      <LoginContent />
    </Suspense>
  );
}
