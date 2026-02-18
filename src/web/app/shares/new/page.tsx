/**
 * Bush Platform - New Share Page
 *
 * Create a new share.
 */
"use client";

import { useEffect } from "react";
import { AppLayout } from "@/web/components/layout";
import { ShareBuilder } from "@/web/components/shares";
import { useAuth } from "@/web/context";
import styles from "@/web/components/shares/shares.module.css";

export default function NewSharePage() {
  const { isAuthenticated, isLoading: authLoading, login, currentAccount } = useAuth();

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      login(window.location.pathname);
    }
  }, [authLoading, isAuthenticated, login]);

  if (authLoading || !isAuthenticated || !currentAccount) {
    return (
      <AppLayout>
        <div className={styles.sharesPage}>
          <div className={styles.loading}>
            <div className={styles.spinner}></div>
            <p>Loading...</p>
          </div>
        </div>
      </AppLayout>
    );
  }

  const handleSave = () => {
    window.location.href = "/shares";
  };

  const handleCancel = () => {
    window.location.href = "/shares";
  };

  return (
    <AppLayout>
      <div className={styles.sharesPage}>
        <div className={styles.sharesHeader}>
          <div>
            <h1 className={styles.sharesTitle}>Create Share</h1>
            <p className={styles.sharesSubtitle}>
              Create a new share link to present assets to stakeholders
            </p>
          </div>
        </div>

        <ShareBuilder
          accountId={currentAccount.id}
          onSave={handleSave}
          onCancel={handleCancel}
        />
      </div>
    </AppLayout>
  );
}
