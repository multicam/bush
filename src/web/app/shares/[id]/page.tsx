/**
 * Bush Platform - Share Detail Page
 *
 * View and edit a share's settings.
 */
"use client";

import { useState, useEffect } from "react";
import { AppLayout } from "@/web/components/layout";
import { Button } from "@/web/components/ui";
import { useAuth } from "@/web/context";
import {
  sharesApi,
  getErrorMessage,
  extractCollectionAttributes,
  type ShareAssetAttributes,
} from "@/web/lib/api";
import { ShareBuilder, ShareActivityFeed } from "@/web/components/shares";
import type { Share } from "@/web/components/shares/types";
import styles from "@/web/components/shares/shares.module.css";

interface ShareDetailProps {
  params: Promise<{ id: string }>;
}

type TabType = "settings" | "assets" | "activity";

export default function ShareDetailPage({ params }: ShareDetailProps) {
  const { isAuthenticated, isLoading: authLoading, login, currentAccount } = useAuth();
  const [shareId, setShareId] = useState<string | null>(null);
  const [share, setShare] = useState<Share | null>(null);
  const [assets, setAssets] = useState<ShareAssetAttributes[]>([]);
  const [loadingState, setLoadingState] = useState<"loading" | "error" | "loaded">("loading");
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [activeTab, setActiveTab] = useState<TabType>("settings");

  // Unwrap params Promise
  useEffect(() => {
    params.then((p) => setShareId(p.id));
  }, [params]);

  // Load share data
  useEffect(() => {
    async function loadShare() {
      if (authLoading || !isAuthenticated || !shareId) return;

      try {
        setLoadingState("loading");
        setErrorMessage(null);

        const response = await sharesApi.get(shareId);
        const shareData = response.data.attributes;
        setShare({ id: shareId, ...shareData });

        // Load assets
        const assetsResponse = await sharesApi.listAssets(shareId);
        setAssets(extractCollectionAttributes(assetsResponse));

        setLoadingState("loaded");
      } catch (error) {
        console.error("Failed to load share:", error);
        setErrorMessage(getErrorMessage(error));
        setLoadingState("error");
      }
    }

    loadShare();
  }, [authLoading, isAuthenticated, shareId]);

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      login(window.location.pathname);
    }
  }, [authLoading, isAuthenticated, login]);

  const copyShareLink = () => {
    if (share) {
      navigator.clipboard.writeText(`${window.location.origin}/s/${share.slug}`);
    }
  };

  const handleSave = (updatedShare: Share) => {
    setShare(updatedShare);
    setActiveTab("settings");
  };

  if (authLoading || loadingState === "loading" || !shareId) {
    return (
      <AppLayout>
        <div className={styles.sharesPage}>
          <div className={styles.loading}>
            <div className={styles.spinner}></div>
            <p>Loading share...</p>
          </div>
        </div>
      </AppLayout>
    );
  }

  if (loadingState === "error") {
    return (
      <AppLayout>
        <div className={styles.sharesPage}>
          <div className={styles.error}>
            <h2>Failed to load share</h2>
            <p>{errorMessage}</p>
            <Button
              variant="primary"
              onClick={() => window.location.href = "/shares"}
            >
              Back to Shares
            </Button>
          </div>
        </div>
      </AppLayout>
    );
  }

  if (!share) {
    return (
      <AppLayout>
        <div className={styles.sharesPage}>
          <div className={styles.error}>
            <h2>Share not found</h2>
            <Button
              variant="primary"
              onClick={() => window.location.href = "/shares"}
            >
              Back to Shares
            </Button>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className={styles.sharesPage}>
        <div className={styles.sharesHeader}>
          <div>
            <h1 className={styles.sharesTitle}>{share.name}</h1>
            <p className={styles.sharesSubtitle}>
              Share link: {window.location.origin}/s/{share.slug}
            </p>
          </div>
          <div style={{ display: "flex", gap: "12px" }}>
            <Button variant="secondary" onClick={copyShareLink}>
              Copy Link
            </Button>
            <Button
              variant="secondary"
              onClick={() => window.open(`/s/${share.slug}`, "_blank")}
            >
              Preview
            </Button>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", gap: "4px", marginBottom: "24px", borderBottom: "1px solid var(--color-border, #333)" }}>
          <button
            className={`${styles.tab} ${activeTab === "settings" ? styles.tabActive : ""}`}
            onClick={() => setActiveTab("settings")}
            style={{
              padding: "12px 20px",
              background: "none",
              border: "none",
              borderBottom: activeTab === "settings" ? "2px solid var(--color-primary, #4f46e5)" : "2px solid transparent",
              color: activeTab === "settings" ? "var(--color-text, #fff)" : "var(--color-text-muted, #888)",
              cursor: "pointer",
              fontWeight: 500,
            }}
          >
            Settings
          </button>
          <button
            className={`${styles.tab} ${activeTab === "assets" ? styles.tabActive : ""}`}
            onClick={() => setActiveTab("assets")}
            style={{
              padding: "12px 20px",
              background: "none",
              border: "none",
              borderBottom: activeTab === "assets" ? "2px solid var(--color-primary, #4f46e5)" : "2px solid transparent",
              color: activeTab === "assets" ? "var(--color-text, #fff)" : "var(--color-text-muted, #888)",
              cursor: "pointer",
              fontWeight: 500,
            }}
          >
            Assets ({assets.length})
          </button>
          <button
            className={`${styles.tab} ${activeTab === "activity" ? styles.tabActive : ""}`}
            onClick={() => setActiveTab("activity")}
            style={{
              padding: "12px 20px",
              background: "none",
              border: "none",
              borderBottom: activeTab === "activity" ? "2px solid var(--color-primary, #4f46e5)" : "2px solid transparent",
              color: activeTab === "activity" ? "var(--color-text, #fff)" : "var(--color-text-muted, #888)",
              cursor: "pointer",
              fontWeight: 500,
            }}
          >
            Activity
          </button>
        </div>

        {/* Tab Content */}
        {activeTab === "settings" && (
          <ShareBuilder
            shareId={shareId}
            accountId={currentAccount?.id || ""}
            onSave={handleSave}
          />
        )}

        {activeTab === "assets" && (
          <div className={styles.sharesGrid}>
            {assets.map((asset) => (
              <div
                key={asset.fileId}
                className={styles.shareCard}
                style={{ padding: "12px" }}
              >
                <div
                  style={{
                    aspectRatio: "16/9",
                    background: "var(--color-background, #111)",
                    borderRadius: "6px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    marginBottom: "12px",
                  }}
                >
                  <span style={{ fontSize: "32px" }}>📄</span>
                </div>
                <p style={{ fontSize: "14px", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {asset.file?.name || `File ${asset.fileId}`}
                </p>
                <p style={{ fontSize: "12px", color: "var(--color-text-muted, #888)", margin: "4px 0 0" }}>
                  Order: {asset.sortOrder}
                </p>
              </div>
            ))}
            {assets.length === 0 && (
              <div className={styles.sharesEmpty} style={{ gridColumn: "1 / -1" }}>
                <p>No assets in this share. Add files from a project to get started.</p>
              </div>
            )}
          </div>
        )}

        {activeTab === "activity" && (
          <ShareActivityFeed shareId={shareId} />
        )}
      </div>
    </AppLayout>
  );
}
