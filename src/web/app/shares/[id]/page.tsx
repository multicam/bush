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
import { Loader2, Copy, ExternalLink } from "lucide-react";

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
        <div className="min-h-screen p-8">
          <div className="flex flex-col items-center justify-center py-16 text-muted">
            <Loader2 className="w-8 h-8 animate-spin mb-4" />
            <p>Loading share...</p>
          </div>
        </div>
      </AppLayout>
    );
  }

  if (loadingState === "error") {
    return (
      <AppLayout>
        <div className="min-h-screen p-8">
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <h2 className="text-xl font-semibold text-primary mb-2">Failed to load share</h2>
            <p className="text-secondary mb-4">{errorMessage}</p>
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
        <div className="min-h-screen p-8">
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <h2 className="text-xl font-semibold text-primary mb-2">Share not found</h2>
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
      <div className="min-h-screen p-8">
        <div className="flex items-start justify-between mb-8">
          <div>
            <h1 className="text-2xl font-semibold text-primary m-0 mb-1">{share.name}</h1>
            <p className="text-secondary text-sm m-0">
              Share link: {window.location.origin}/s/{share.slug}
            </p>
          </div>
          <div className="flex gap-3">
            <Button variant="secondary" onClick={copyShareLink}>
              <Copy className="w-4 h-4 mr-2" />
              Copy Link
            </Button>
            <Button
              variant="secondary"
              onClick={() => window.open(`/s/${share.slug}`, "_blank")}
            >
              <ExternalLink className="w-4 h-4 mr-2" />
              Preview
            </Button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 border-b border-border-default">
          <button
            className={`px-5 py-3 bg-none border-none cursor-pointer font-medium transition-colors ${
              activeTab === "settings"
                ? "text-primary border-b-2 border-accent"
                : "text-secondary border-b-2 border-transparent hover:text-primary"
            }`}
            onClick={() => setActiveTab("settings")}
          >
            Settings
          </button>
          <button
            className={`px-5 py-3 bg-none border-none cursor-pointer font-medium transition-colors ${
              activeTab === "assets"
                ? "text-primary border-b-2 border-accent"
                : "text-secondary border-b-2 border-transparent hover:text-primary"
            }`}
            onClick={() => setActiveTab("assets")}
          >
            Assets ({assets.length})
          </button>
          <button
            className={`px-5 py-3 bg-none border-none cursor-pointer font-medium transition-colors ${
              activeTab === "activity"
                ? "text-primary border-b-2 border-accent"
                : "text-secondary border-b-2 border-transparent hover:text-primary"
            }`}
            onClick={() => setActiveTab("activity")}
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {assets.map((asset) => (
              <div
                key={asset.fileId}
                className="p-3 bg-surface-2 border border-border-default rounded-md"
              >
                <div className="aspect-video bg-surface-1 rounded-md flex items-center justify-center mb-3">
                  <span className="text-3xl">📄</span>
                </div>
                <p className="text-sm text-primary m-0 overflow-hidden text-ellipsis whitespace-nowrap">
                  {asset.file?.name || `File ${asset.fileId}`}
                </p>
                <p className="text-xs text-muted m-1 mt-0">
                  Order: {asset.sortOrder}
                </p>
              </div>
            ))}
            {assets.length === 0 && (
              <div className="col-span-full flex flex-col items-center justify-center py-8 text-center">
                <p className="text-secondary">No assets in this share. Add files from a project to get started.</p>
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
