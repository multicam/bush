/**
 * Bush Platform - Public Share Page
 *
 * View a share without authentication. This is the page that external
 * stakeholders see when they click on a share link.
 *
 * Security: Passphrase verification is done server-side. The passphrase
 * is sent as a query parameter and verified by the API using constant-time
 * comparison to prevent timing attacks.
 */
"use client";

import { useState, useEffect } from "react";
import {
  sharesApi,
  getErrorMessage,
  type ShareAttributes,
  type FileAttributes,
  type ShareBranding,
} from "@/web/lib/api";
import styles from "./share.module.css";

interface PublicSharePageProps {
  params: Promise<{ slug: string }>;
}

interface Share extends ShareAttributes {
  id: string;
  passphrase_required?: boolean;
  assets?: FileAttributes[];
}

export default function PublicSharePage({ params }: PublicSharePageProps) {
  const [slug, setSlug] = useState<string | null>(null);
  const [share, setShare] = useState<Share | null>(null);
  const [loadingState, setLoadingState] = useState<"loading" | "error" | "passphrase" | "loaded">("loading");
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [passphrase, setPassphrase] = useState("");
  const [passphraseError, setPassphraseError] = useState<string>("");
  const [isVerifying, setIsVerifying] = useState(false);

  // Unwrap params Promise
  useEffect(() => {
    params.then((p) => setSlug(p.slug));
  }, [params]);

  // Load share by slug
  useEffect(() => {
    async function loadShare() {
      if (!slug) return;

      try {
        setLoadingState("loading");
        setErrorMessage("");

        const response = await sharesApi.getBySlug(slug);
        const shareData = response.data.attributes as Share;

        // Check if passphrase is required (server tells us via passphrase_required flag)
        if (shareData.passphrase_required) {
          setShare({ id: response.data.id, ...shareData });
          setLoadingState("passphrase");
          return;
        }

        setShare({ id: response.data.id, ...shareData });
        setLoadingState("loaded");
      } catch (error) {
        console.error("Failed to load share:", error);
        setErrorMessage(getErrorMessage(error));
        setLoadingState("error");
      }
    }

    loadShare();
  }, [slug]);

  const handlePassphraseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPassphraseError("");

    if (!passphrase.trim()) {
      setPassphraseError("Please enter the passphrase");
      return;
    }

    if (!slug) return;

    // Verify passphrase server-side by retrying the API call with the passphrase
    setIsVerifying(true);
    try {
      const response = await sharesApi.getBySlug(slug, passphrase);
      const shareData = response.data.attributes as Share;

      // If we get here, the passphrase was correct (API returns full share data)
      setShare({ id: response.data.id, ...shareData });
      setLoadingState("loaded");
    } catch (error) {
      // Incorrect passphrase or other error
      const msg = getErrorMessage(error);
      if (msg.includes("passphrase") || msg.includes("Incorrect")) {
        setPassphraseError("Incorrect passphrase");
      } else {
        setPassphraseError(msg);
      }
    } finally {
      setIsVerifying(false);
    }
  };

  /**
   * Get file icon based on MIME type
   */
  const getFileIcon = (mimeType: string): string => {
    if (mimeType.startsWith("video/")) return "🎬";
    if (mimeType.startsWith("audio/")) return "🎵";
    if (mimeType.startsWith("image/")) return "🖼️";
    if (mimeType === "application/pdf") return "📄";
    return "📁";
  };

  /**
   * Format file size
   */
  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  };

  // Loading state
  if (loadingState === "loading") {
    return (
      <div className={styles.publicShare} style={{ background: "#111" }}>
        <div className={styles.loading}>
          <div className={styles.spinner}></div>
          <p>Loading share...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (loadingState === "error") {
    return (
      <div className={styles.publicShare} style={{ background: "#111" }}>
        <div className={styles.error}>
          <h2>Share not found</h2>
          <p>{errorMessage || "This share may have been deleted or expired."}</p>
        </div>
      </div>
    );
  }

  // Passphrase required
  if (loadingState === "passphrase") {
    const branding = share?.branding || {};

    return (
      <div
        className={styles.publicShare}
        style={{
          background: branding.background_color || "#111",
          color: branding.dark_mode !== false ? "#fff" : "#111",
        }}
      >
        <form className={styles.passphraseForm} onSubmit={handlePassphraseSubmit}>
          <div
            className={styles.passphraseCard}
            style={{
              background: branding.dark_mode !== false ? "#1a1a1a" : "#fff",
              borderColor: branding.dark_mode !== false ? "#333" : "#ddd",
            }}
          >
            {branding.logo_url && (
              <img
                src={branding.logo_url}
                alt="Logo"
                style={{ maxWidth: "150px", marginBottom: "24px" }}
              />
            )}
            <h2 className={styles.passphraseTitle}>Protected Share</h2>
            <p className={styles.passphraseHint}>
              Enter the passphrase to access this share
            </p>
            <input
              type="password"
              className={styles.passphraseInput}
              value={passphrase}
              onChange={(e) => setPassphrase(e.target.value)}
              placeholder="Enter passphrase"
              autoFocus
              style={{
                background: branding.dark_mode !== false ? "#111" : "#f5f5f5",
                color: branding.dark_mode !== false ? "#fff" : "#111",
                borderColor: passphraseError ? "#ef4444" : (branding.dark_mode !== false ? "#333" : "#ddd"),
              }}
            />
            {passphraseError && (
              <p className={styles.passphraseError}>{passphraseError}</p>
            )}
            <button
              type="submit"
              className={styles.passphraseSubmit}
              disabled={isVerifying}
              style={{
                background: branding.accent_color || "#4f46e5",
                opacity: isVerifying ? 0.7 : 1,
              }}
            >
              {isVerifying ? "Verifying..." : "Access Share"}
            </button>
          </div>
        </form>
      </div>
    );
  }

  // Loaded state - display the share
  if (!share) {
    return null;
  }

  const branding: ShareBranding = share.branding || {};
  const assets = share.assets || [];

  return (
    <div
      className={styles.publicShare}
      style={{
        background: branding.background_color || "#111",
        color: branding.dark_mode !== false ? "#fff" : "#111",
      }}
    >
      {/* Header */}
      <header
        className={styles.publicShareHeader}
        style={{
          borderBottom: branding.dark_mode !== false ? "1px solid #333" : "1px solid #ddd",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          {branding.logo_url && (
            <img
              src={branding.logo_url}
              alt="Logo"
              style={{ maxWidth: "120px", maxHeight: "40px" }}
            />
          )}
          {!branding.logo_url && (
            <span
              className={styles.publicShareLogo}
              style={{ color: branding.accent_color || "#4f46e5" }}
            >
              Bush
            </span>
          )}
        </div>
        <div style={{ display: "flex", gap: "12px" }}>
          {share.allowDownloads && (
            <button className={styles.headerBtn}>
              Download All
            </button>
          )}
        </div>
      </header>

      {/* Content */}
      <main className={styles.publicShareContent}>
        <div className={styles.publicShareInfo}>
          <h1 className={styles.publicShareName}>{share.name}</h1>
          {branding.description && (
            <p className={styles.publicShareDescription}>{branding.description}</p>
          )}
          <p className={styles.publicShareMeta}>
            {assets.length} asset{assets.length !== 1 ? "s" : ""}
          </p>
        </div>

        {/* Assets Grid */}
        <div className={styles.publicShareGrid}>
          {assets.map((asset, index) => (
            <div
              key={index}
              className={styles.publicAssetCard}
              style={{
                background: branding.dark_mode !== false ? "#1a1a1a" : "#fff",
                borderColor: branding.dark_mode !== false ? "#333" : "#ddd",
              }}
            >
              <div className={styles.publicAssetThumbnail}>
                {getFileIcon(asset.mimeType)}
              </div>
              <div className={styles.publicAssetInfo}>
                <p className={styles.publicAssetName}>{asset.name || asset.originalName}</p>
                <p className={styles.publicAssetMeta}>
                  {formatFileSize(asset.fileSizeBytes)}
                </p>
              </div>
            </div>
          ))}
        </div>

        {assets.length === 0 && (
          <div className={styles.publicShareEmpty}>
            <p>No assets in this share</p>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer
        className={styles.publicShareFooter}
        style={{
          borderTop: branding.dark_mode !== false ? "1px solid #333" : "1px solid #ddd",
        }}
      >
        <p style={{ fontSize: "12px", color: branding.dark_mode !== false ? "#666" : "#999" }}>
          Powered by <a href="/" style={{ color: branding.accent_color || "#4f46e5" }}>Bush</a>
        </p>
      </footer>
    </div>
  );
}
