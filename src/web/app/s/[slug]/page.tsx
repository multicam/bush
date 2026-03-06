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
  FilmIcon,
  MusicalNoteIcon,
  ImagePlusIcon,
  DocumentTextIcon,
  FolderIcon,
  SpinnerIcon,
} from "@/web/lib/icons";
import {
  sharesApi,
  getErrorMessage,
  type ShareAttributes,
  type FileAttributes,
  type ShareBranding,
} from "@/web/lib/api";

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
  const [loadingState, setLoadingState] = useState<"loading" | "error" | "passphrase" | "loaded">(
    "loading"
  );
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
   * Get file icon based on MIME type using Lucide icons
   */
  const getFileIcon = (mimeType: string) => {
    const iconClass = "size-12";
    if (mimeType.startsWith("video/")) return <FilmIcon className={iconClass} />;
    if (mimeType.startsWith("audio/")) return <MusicalNoteIcon className={iconClass} />;
    if (mimeType.startsWith("image/")) return <ImagePlusIcon className={iconClass} />;
    if (mimeType === "application/pdf") return <DocumentTextIcon className={iconClass} />;
    return <FolderIcon className={iconClass} />;
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
      <div className="min-h-screen flex flex-col bg-surface-1">
        <div className="flex flex-col items-center justify-center min-h-[calc(100vh-120px)]">
          <SpinnerIcon className="size-10 text-accent" />
          <p className="mt-4 text-secondary">Loading share...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (loadingState === "error") {
    return (
      <div className="min-h-screen flex flex-col bg-surface-1">
        <div className="flex flex-col items-center justify-center min-h-[calc(100vh-120px)] text-center px-6">
          <h2 className="text-2xl font-semibold text-primary mb-3">Share not found</h2>
          <p className="text-secondary max-w-md">
            {errorMessage || "This share may have been deleted or expired."}
          </p>
        </div>
      </div>
    );
  }

  // Passphrase required
  if (loadingState === "passphrase") {
    const branding = share?.branding || {};
    const isDark = branding.dark_mode !== false;

    return (
      <div
        className="min-h-screen flex flex-col"
        style={{
          background: branding.background_color || (isDark ? "#111" : "#f5f5f5"),
          color: isDark ? "#fff" : "#111",
        }}
      >
        <form
          className="flex flex-col items-center justify-center min-h-screen px-6 py-6"
          onSubmit={handlePassphraseSubmit}
        >
          <div
            className="w-full max-w-md p-10 rounded-2xl text-center border border-border-default"
            style={{
              background: isDark ? "#1a1a1a" : "#fff",
            }}
          >
            {branding.logo_url && (
              <img src={branding.logo_url} alt="Logo" className="max-w-[150px] mb-6 mx-auto" />
            )}
            <h2 className="text-2xl font-semibold text-primary mb-2">Protected Share</h2>
            <p className="text-sm text-secondary mb-6">Enter the passphrase to access this share</p>
            <input
              type="password"
              className="w-full px-4 py-3.5 text-base border-2 rounded-lg mb-4 transition-colors focus:outline-none focus:border-accent"
              style={{
                background: isDark ? "#111" : "#f5f5f5",
                color: isDark ? "#fff" : "#111",
                borderColor: passphraseError ? "#ef4444" : isDark ? "#333" : "#ddd",
              }}
              value={passphrase}
              onChange={(e) => setPassphrase(e.target.value)}
              placeholder="Enter passphrase"
              autoFocus
            />
            {passphraseError && <p className="text-sm text-red-500 mb-4">{passphraseError}</p>}
            <button
              type="submit"
              className="w-full py-3.5 text-base font-semibold text-white rounded-lg transition-opacity hover:opacity-90 disabled:opacity-70"
              disabled={isVerifying}
              style={{
                background: branding.accent_color || "#4f46e5",
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
  const isDark = branding.dark_mode !== false;

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{
        background: branding.background_color || (isDark ? "#111" : "#f5f5f5"),
        color: isDark ? "#fff" : "#111",
      }}
    >
      {/* Header */}
      <header className="sticky top-0 z-50 px-6 py-4 flex justify-between items-center backdrop-blur-sm border-b border-border-default">
        <div className="flex items-center gap-4">
          {branding.logo_url && (
            <img src={branding.logo_url} alt="Logo" className="max-w-[120px] max-h-10" />
          )}
          {!branding.logo_url && (
            <span
              className="text-lg font-bold tracking-tight"
              style={{ color: branding.accent_color || "#4f46e5" }}
            >
              Bush
            </span>
          )}
        </div>
        <div className="flex gap-3">
          {share.allowDownloads && (
            <button className="px-4 py-2 text-sm font-medium bg-surface-2 border border-border-default rounded-md cursor-pointer transition-colors hover:bg-surface-3">
              Download All
            </button>
          )}
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 px-6 py-8 max-w-[1400px] mx-auto w-full">
        <div className="mb-8">
          <h1 className="text-3xl md:text-2xl font-bold tracking-tight text-primary m-0 mb-2">
            {share.name}
          </h1>
          {branding.description && (
            <p className="text-base text-secondary m-0 mb-3 max-w-[600px]">
              {branding.description}
            </p>
          )}
          <p className="text-sm text-secondary m-0">
            {assets.length} asset{assets.length !== 1 ? "s" : ""}
          </p>
        </div>

        {/* Assets Grid */}
        <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] md:grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-5 md:gap-3">
          {assets.map((asset, index) => (
            <div
              key={index}
              className="rounded-xl overflow-hidden cursor-pointer transition-all duration-200 hover:-translate-y-1 hover:shadow-lg border border-border-default"
              style={{
                background: isDark ? "#1a1a1a" : "#fff",
              }}
            >
              <div
                className="aspect-[16/10] flex items-center justify-center text-accent/70"
                style={{
                  background: isDark ? "rgba(0,0,0,0.2)" : "rgba(0,0,0,0.05)",
                }}
              >
                {getFileIcon(asset.mimeType)}
              </div>
              <div className="p-4 md:p-3">
                <p className="text-sm font-medium text-primary m-0 mb-1 truncate overflow-hidden whitespace-nowrap">
                  {asset.name || asset.originalName}
                </p>
                <p className="text-xs text-secondary m-0">{formatFileSize(asset.fileSizeBytes)}</p>
              </div>
            </div>
          ))}
        </div>

        {assets.length === 0 && (
          <div className="flex items-center justify-center py-16 text-center text-secondary">
            <p>No assets in this share</p>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="px-6 py-4 text-center mt-auto border-t border-border-default">
        <p className="text-xs text-secondary">
          Powered by{" "}
          <a
            href="/"
            className="no-underline font-medium hover:underline"
            style={{ color: branding.accent_color || "#4f46e5" }}
          >
            Bush
          </a>
        </p>
      </footer>
    </div>
  );
}
