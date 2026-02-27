/**
 * Bush Platform - File Detail/Viewer Page
 *
 * Shows file details with appropriate viewer based on file type.
 * Reference: IMPLEMENTATION_PLAN.md 2.6-2.8b Viewers
 */
"use client";

import { useState, useEffect, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, MessageSquare, MessageSquareOff, Download, Loader2 } from "lucide-react";
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

/**
 * Spinner component using Lucide icon
 */
function Spinner() {
  return (
    <Loader2 className="w-10 h-10 text-accent animate-spin" />
  );
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

    const abortController = new AbortController();

    const fetchFile = async () => {
      try {
        setLoadingState("loading");
        const response = await filesApi.get(projectId, fileId, { signal: abortController.signal });
        const fileData = extractAttributes(response) as FileItem;
        setFile(fileData);

        // Get download URL for viewers
        try {
          const downloadResponse = await filesApi.download(projectId, fileId, { signal: abortController.signal });
          setDownloadUrl(downloadResponse.meta.download_url);
        } catch (error) {
          // Don't update state if aborted
          if (error instanceof DOMException && error.name === "AbortError") {
            return;
          }
          // Download URL fetch failed - viewers will handle missing URL
        }

        setLoadingState("loaded");
      } catch (error) {
        // Don't update state if request was aborted (component unmounted)
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }
        console.error("Failed to fetch file:", error);
        setErrorMessage(getErrorMessage(error));
        setLoadingState("error");
      }
    };

    fetchFile();

    return () => {
      abortController.abort();
    };
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
        <div className="flex flex-col items-center justify-center h-screen gap-4">
          <Spinner />
          <p className="text-secondary">Loading file...</p>
        </div>
      </AppLayout>
    );
  }

  // Error state
  if (loadingState === "error" || !file) {
    return (
      <AppLayout>
        <div className="flex flex-col items-center justify-center h-screen gap-4">
          <h1 className="text-2xl font-semibold text-primary mb-2">File Not Found</h1>
          <p className="text-secondary mb-4">{errorMessage || "The requested file could not be loaded."}</p>
          <Button onClick={() => router.push(`/projects/${projectId}`)}>
            Back to Project
          </Button>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="flex flex-col h-screen bg-surface-2">
        {/* Header */}
        <header className="flex items-center justify-between px-4 py-3 bg-surface-1 border-b border-border-default shrink-0">
          <div className="flex items-center gap-4 max-md:flex-col max-md:items-start max-md:gap-2">
            <Button
              variant="secondary"
              onClick={() => router.push(`/projects/${projectId}`)}
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
            <div className="flex flex-col gap-1">
              <h1 className="m-0 text-base font-semibold text-primary">{file.name}</h1>
              <div className="flex items-center gap-2 text-xs text-secondary max-md:flex-wrap">
                <span>{formatFileSize(file.fileSizeBytes)}</span>
                <span>-</span>
                <span>{file.mimeType}</span>
                <span>-</span>
                <span className="px-2 py-0.5 bg-surface-2 rounded capitalize">
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
          <div className="flex items-center gap-3">
            <Button
              variant="secondary"
              onClick={() => setShowComments(!showComments)}
            >
              {showComments ? (
                <>
                  <MessageSquareOff className="w-4 h-4 mr-2" />
                  Hide Comments
                </>
              ) : (
                <>
                  <MessageSquare className="w-4 h-4 mr-2" />
                  Show Comments
                </>
              )}
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
                <Download className="w-4 h-4 mr-2" />
                Download
              </Button>
            )}
          </div>
        </header>

        {/* Main content */}
        <div className="flex flex-1 min-h-0 overflow-hidden">
          {/* Viewer */}
          <div className="relative flex-1 overflow-hidden bg-surface-3 flex items-center justify-center">
            {file.status !== "ready" && (
              <div className="flex flex-col items-center justify-center gap-4 text-secondary">
                <Spinner />
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
              <div className="flex flex-col items-center justify-center gap-4 p-8 text-center">
                <h2 className="m-0 text-xl font-semibold text-primary">Preview not available</h2>
                <p className="m-0 text-secondary">This file type ({file.mimeType}) cannot be previewed.</p>
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
                  <Download className="w-4 h-4 mr-2" />
                  Download File
                </Button>
              </div>
            )}
          </div>

          {/* Comments panel */}
          {showComments && (
            <div className="w-[360px] border-l border-border-default bg-surface-1 overflow-hidden shrink-0 max-md:absolute max-md:right-0 max-md:top-[60px] max-md:bottom-0 max-md:z-[100] max-md:shadow-[-2px_0_8px_rgba(0,0,0,0.1)]">
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
