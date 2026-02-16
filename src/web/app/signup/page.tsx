/**
 * Bush Platform - Signup Page
 *
 * Signup page that redirects to WorkOS AuthKit for registration.
 * Reference: IMPLEMENTATION_PLAN.md 1.7a
 */
"use client";

import { Button } from "@/web/components/ui";
import styles from "./signup.module.css";

export default function SignupPage() {
  const handleSignup = () => {
    // WorkOS AuthKit handles signup through the same login flow
    // This page exists for marketing/SEO purposes and to provide a dedicated signup URL
    window.location.href = "/api/auth/login";
  };

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <div className={styles.header}>
          <h1 className={styles.logo}>Bush</h1>
          <p className={styles.tagline}>Creative Collaboration Platform</p>
        </div>

        <div className={styles.content}>
          <h2 className={styles.title}>Get Started</h2>
          <p className={styles.description}>
            Create your account and start collaborating with your team.
          </p>

          <div className={styles.features}>
            <div className={styles.feature}>
              <span className={styles.featureIcon}>📁</span>
              <div>
                <span className={styles.featureTitle}>Unlimited Projects</span>
                <span className={styles.featureDesc}>Organize all your work</span>
              </div>
            </div>
            <div className={styles.feature}>
              <span className={styles.featureIcon}>👥</span>
              <div>
                <span className={styles.featureTitle}>Team Collaboration</span>
                <span className={styles.featureDesc}>Work together seamlessly</span>
              </div>
            </div>
            <div className={styles.feature}>
              <span className={styles.featureIcon}>🔗</span>
              <div>
                <span className={styles.featureTitle}>Easy Sharing</span>
                <span className={styles.featureDesc}>Share with anyone instantly</span>
              </div>
            </div>
          </div>

          <Button
            variant="primary"
            size="lg"
            onClick={handleSignup}
            className={styles.signupButton}
          >
            Create Account
          </Button>

          <p className={styles.terms}>
            By creating an account, you agree to our{" "}
            <a href="/terms" className={styles.link}>Terms of Service</a>
            {" "}and{" "}
            <a href="/privacy" className={styles.link}>Privacy Policy</a>.
          </p>
        </div>

        <div className={styles.footer}>
          <p>Already have an account?{" "}
            <a href="/login" className={styles.link}>Sign in</a>
          </p>
        </div>
      </div>
    </div>
  );
}
