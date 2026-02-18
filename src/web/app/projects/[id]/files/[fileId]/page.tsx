/**
 * Bush Platform - File Detail/Viewer Page
 *
 * Shows file details with appropriate viewer based on file type.
 * Reference: IMPLEMENTATION_PLAN.md 2.6-2.8b Viewers
 */
"use client";

import { useState, useEffect, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { AppLayout } from "@/web/components/layout";
import { Button } from "@/web/components/ui";
import {
  VideoViewer,
  AudioViewer,
  ImageViewer,
  PdfViewer,
} from "@/web/components/viewers";
import { CommentPanel } from "@/web/components/comments";
import { useAuth } from "@/web/context";
import {
  filesApi,
  extractAttributes,
  getErrorMessage,
  type FileAttributes,
} from "@/web/lib/api";
import styles from "./file.module.css";

interface FileItem extends FileAttributes {
  id: string;
}

type LoadingState = "loading" | "error" | "loaded";
type ViewerType = "video" | "audio" | "image" | "pdf" | "other";

/**
 * Determine the appropriate viewer type based on MIME type
 */
function getViewerType(mimeType: string): ViewerType {
  if (mimeType.startsWith("video/")) return "video";
  if (mimeType.startsWith("audio/")) return "audio";
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType === "application/pdf") return "pdf";
  return "other";
}

/**
 * Format file size for display
 */
function formatFileSize(bytes: number): string {
  const units = ["B", "KB", "MB", "GB", "TB"];
  let size = bytes;
  let unitIndex = 0;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }
  return `${size.toFixed(1)} ${units[unitIndex]}`;
}

export default function FileDetailPage() {
  const params = useParams<{ id: string; fileId: string }>();
  const router = useRouter();
  const projectId = params.id;
  const fileId = params.fileId;

  const { isAuthenticated, isLoading: authLoading, login } = useAuth();
  const [file, setFile] = useState<FileItem | null>(null);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [loadingState, setLoadingState] = useState<LoadingState>("loading");
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [showComments, setShowComments] = useState(true);

  // Fetch file data
  useEffect(() => {
    if (!projectId || !fileId) return;

    const fetchFile = async () => {
      try {
        setLoadingState("loading");
        const response = await filesApi.get(projectId, fileId);
        const fileData = extractAttributes(response) as FileItem;
        setFile(fileData);

        // Get download URL for viewers
        try {
          const downloadResponse = await filesApi.download(projectId, fileId);
          setDownloadUrl(downloadResponse.meta.download_url);
        } catch {
          // Download URL fetch failed - viewers will handle missing URL
        }

        setLoadingState("loaded");
      } catch (error) {
        console.error("Failed to fetch file:", error);
        setErrorMessage(getErrorMessage(error));
        setLoadingState("error");
      }
    };

    fetchFile();
  }, [projectId, fileId]);

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      login();
    }
  }, [authLoading, isAuthenticated, login]);

  // Determine viewer type
  const viewerType = useMemo(() => {
    if (!file) return "other";
    return getViewerType(file.mimeType);
  }, [file]);

  // Loading state
  if (authLoading || loadingState === "loading") {
    return (
      <AppLayout>
        <div className={styles.loading}>
          <div className={styles.spinner}></div>
          <p>Loading file...</p>
        </div>
      </AppLayout>
    );
  }

  // Error state
  if (loadingState === "error" || !file) {
    return (
      <AppLayout>
        <div className={styles.error}>
          <h1>File Not Found</h1>
          <p>{errorMessage || "The requested file could not be loaded."}</p>
          <Button onClick={() => router.push(`/projects/${projectId}`)}>
            Back to Project
          </Button>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className={styles.container}>
        {/* Header */}
        <header className={styles.header}>
          <div className={styles.headerLeft}>
            <Button
              variant="secondary"
              onClick={() => router.push(`/projects/${projectId}`)}
            >
              ← Back
            </Button>
            <div className={styles.fileInfo}>
              <h1 className={styles.fileName}>{file.name}</h1>
              <div className={styles.fileMeta}>
                <span>{formatFileSize(file.fileSizeBytes)}</span>
                <span>•</span>
                <span>{file.mimeType}</span>
                <span>•</span>
                <span className={styles.status}>
                  {file.status === "ready"
                    ? "Ready"
                    : file.status === "processing"
                    ? "Processing..."
                    : file.status === "uploading"
                    ? "Uploading..."
                    : "Error"}
                </span>
              </div>
            </div>
          </div>
          <div className={styles.headerRight}>
            <Button
              variant="secondary"
              onClick={() => setShowComments(!showComments)}
            >
              {showComments ? "Hide Comments" : "Show Comments"}
            </Button>
            {file.status === "ready" && (
              <Button
                onClick={async () => {
                  try {
                    const result = await filesApi.download(projectId, fileId);
                    window.open(result.meta.download_url, "_blank");
                  } catch (error) {
                    console.error("Download failed:", error);
                  }
                }}
              >
                Download
              </Button>
            )}
          </div>
        </header>

        {/* Main content */}
        <div className={styles.content}>
          {/* Viewer */}
          <div className={styles.viewer}>
            {file.status !== "ready" && (
              <div className={styles.processingOverlay}>
                <div className={styles.spinner}></div>
                <p>
                  {file.status === "uploading"
                    ? "Uploading file..."
                    : file.status === "processing"
                    ? "Processing file..."
                    : "Processing failed"}
                </p>
              </div>
            )}

            {file.status === "ready" && viewerType === "video" && downloadUrl && (
              <VideoViewer
                src={downloadUrl}
                name={file.name}
                poster={file.thumbnailUrl || undefined}
              />
            )}

            {file.status === "ready" && viewerType === "audio" && downloadUrl && (
              <AudioViewer
                src={downloadUrl}
                name={file.name}
              />
            )}

            {file.status === "ready" && viewerType === "image" && downloadUrl && (
              <ImageViewer
                src={downloadUrl}
                alt={file.name}
              />
            )}

            {file.status === "ready" && viewerType === "pdf" && downloadUrl && (
              <PdfViewer
                src={downloadUrl}
                name={file.name}
              />
            )}

            {file.status === "ready" && viewerType === "other" && (
              <div className={styles.unsupported}>
                <h2>Preview not available</h2>
                <p>This file type ({file.mimeType}) cannot be previewed.</p>
                <Button
                  onClick={async () => {
                    try {
                      const result = await filesApi.download(projectId, fileId);
                      window.open(result.meta.download_url, "_blank");
                    } catch (error) {
                      console.error("Download failed:", error);
                    }
                  }}
                >
                  Download File
                </Button>
              </div>
            )}
          </div>

          {/* Comments panel */}
          {showComments && (
            <div className={styles.commentsPanel}>
              <CommentPanel
                fileId={fileId}
              />
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
