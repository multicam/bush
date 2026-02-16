/**
 * Bush Platform - Project Detail Page
 *
 * Shows project details with file browser and upload functionality.
 * Reference: IMPLEMENTATION_PLAN.md 2.1 [P1] Drag-and-Drop UI, Upload Queue UI
 */
"use client";

import { useState, useEffect, useCallback } from "react";
import { AppLayout } from "@/web/components/layout";
import { Button, Badge } from "@/web/components/ui";
import { Dropzone, UploadQueue, type DroppedFile, type QueuedFile } from "@/web/components/upload";
import { useAuth } from "@/web/context";
import {
  projectsApi,
  filesApi,
  extractAttributes,
  extractCollectionAttributes,
  getErrorMessage,
  type ProjectAttributes,
  type FileAttributes,
} from "@/web/lib/api";
import { UploadClient, getUploadClient, type UploadProgress } from "@/web/lib/upload-client";
import { formatFileSize, getFileIcon, getFileCategory } from "@/shared/file-types";
import styles from "./project.module.css";

interface Project extends ProjectAttributes {
  id: string;
}

interface FileItem extends FileAttributes {
  id: string;
}

type LoadingState = "loading" | "error" | "loaded";

export default function ProjectDetailPage({ params }: { params: { id: string } }) {
  const projectId = params.id;
  const { isAuthenticated, isLoading: authLoading, login } = useAuth();
  const [project, setProject] = useState<Project | null>(null);
  const [files, setFiles] = useState<FileItem[]>([]);
  const [loadingState, setLoadingState] = useState<LoadingState>("loading");
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [showDropzone, setShowDropzone] = useState(false);
  const [uploadQueue, setUploadQueue] = useState<QueuedFile[]>([]);
  const uploadClient = getUploadClient();

  // Fetch project and files
  useEffect(() => {
    async function fetchData() {
      if (authLoading) return;

      if (!isAuthenticated) {
        login(window.location.pathname);
        return;
      }

      try {
        setLoadingState("loading");

        // Fetch project
        const projectResponse = await projectsApi.get(projectId);
        const projectData = extractAttributes(projectResponse);
        setProject(projectData as Project);

        // Fetch files (root folder)
        const filesResponse = await filesApi.list(projectId, { limit: 100 });
        const fileItems = extractCollectionAttributes(filesResponse) as FileItem[];
        setFiles(fileItems);

        setLoadingState("loaded");
      } catch (error) {
        console.error("Failed to fetch project data:", error);
        setErrorMessage(getErrorMessage(error));
        setLoadingState("error");
      }
    }

    fetchData();
  }, [projectId, isAuthenticated, authLoading, login]);

  // Handle files dropped/selected
  const handleFilesDropped = useCallback(
    async (droppedFiles: DroppedFile[]) => {
      // Filter valid files
      const validFiles = droppedFiles.filter((f) => f.isValid);

      if (validFiles.length === 0) {
        return;
      }

      // Add files to queue
      const newQueuedFiles: QueuedFile[] = validFiles.map((f) => ({
        id: f.id,
        file: f.file,
        progress: undefined,
        error: undefined,
      }));

      setUploadQueue((prev) => [...prev, ...newQueuedFiles]);

      // Start uploads
      for (const queuedFile of newQueuedFiles) {
        startUpload(queuedFile);
      }

      setShowDropzone(false);
    },
    [projectId]
  );

  // Start upload for a single file
  const startUpload = useCallback(
    async (queuedFile: QueuedFile) => {
      try {
        await uploadClient.upload(queuedFile.file, {
          projectId,
          onProgress: (progress) => {
            setUploadQueue((prev) =>
              prev.map((f) =>
                f.id === queuedFile.id ? { ...f, progress } : f
              )
            );
          },
          onComplete: (result) => {
            setUploadQueue((prev) => prev.filter((f) => f.id !== queuedFile.id));
            // Refresh file list
            refreshFiles();
          },
          onError: (error) => {
            setUploadQueue((prev) =>
              prev.map((f) =>
                f.id === queuedFile.id
                  ? { ...f, error: error.message, progress: { ...f.progress!, status: "failed" } as UploadProgress }
                  : f
              )
            );
          },
        });
      } catch (error) {
        // Error is handled in onError callback
      }
    },
    [projectId, uploadClient]
  );

  // Refresh files list
  const refreshFiles = useCallback(async () => {
    try {
      const filesResponse = await filesApi.list(projectId, { limit: 100 });
      const fileItems = extractCollectionAttributes(filesResponse) as FileItem[];
      setFiles(fileItems);
    } catch (error) {
      console.error("Failed to refresh files:", error);
    }
  }, [projectId]);

  // Handle remove from queue
  const handleRemoveFromQueue = useCallback((fileId: string) => {
    setUploadQueue((prev) => prev.filter((f) => f.id !== fileId));
  }, []);

  // Handle retry
  const handleRetry = useCallback(
    (fileId: string) => {
      const queuedFile = uploadQueue.find((f) => f.id === fileId);
      if (queuedFile) {
        setUploadQueue((prev) =>
          prev.map((f) =>
            f.id === fileId ? { ...f, error: undefined, progress: { ...f.progress!, status: "pending" } as UploadProgress } : f
          )
        );
        startUpload(queuedFile);
      }
    },
    [uploadQueue, startUpload]
  );

  // Handle pause
  const handlePause = useCallback(async (fileId: string) => {
    await uploadClient.pause(fileId);
    setUploadQueue((prev) =>
      prev.map((f) =>
        f.id === fileId ? { ...f, progress: { ...f.progress!, status: "paused" } as UploadProgress } : f
      )
    );
  }, [uploadClient]);

  // Handle resume
  const handleResume = useCallback(
    async (fileId: string) => {
      const queuedFile = uploadQueue.find((f) => f.id === fileId);
      if (!queuedFile) return;

      setUploadQueue((prev) =>
        prev.map((f) =>
          f.id === fileId ? { ...f, progress: { ...f.progress!, status: "uploading" } as UploadProgress } : f
        )
      );

      // Resume would need the file reference and options - for now just update status
      // In a real implementation, you'd store the upload state and call client.resume()
    },
    [uploadQueue]
  );

  // Handle cancel
  const handleCancel = useCallback(async (fileId: string) => {
    await uploadClient.cancel(fileId);
    setUploadQueue((prev) => prev.filter((f) => f.id !== fileId));
  }, [uploadClient]);

  // Get status badge variant
  const getStatusBadgeVariant = (status: FileAttributes["status"]): "default" | "success" | "warning" | "danger" => {
    switch (status) {
      case "ready":
        return "success";
      case "processing":
        return "warning";
      case "uploading":
        return "default";
      case "processing_failed":
        return "danger";
      default:
        return "default";
    }
  };

  // Format relative time
  const formatRelativeTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 60) {
      return `${diffMins}m ago`;
    }
    if (diffHours < 24) {
      return `${diffHours}h ago`;
    }
    if (diffDays < 7) {
      return `${diffDays}d ago`;
    }
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  // Loading state
  if (authLoading || loadingState === "loading") {
    return (
      <AppLayout>
        <div className={styles.page}>
          <div className={styles.loading}>
            <div className={styles.spinner}></div>
            <p>Loading project...</p>
          </div>
        </div>
      </AppLayout>
    );
  }

  // Error state
  if (loadingState === "error") {
    return (
      <AppLayout>
        <div className={styles.page}>
          <div className={styles.error}>
            <h2>Failed to load project</h2>
            <p>{errorMessage}</p>
            <Button
              variant="primary"
              onClick={() => {
                setLoadingState("loading");
                setErrorMessage("");
              }}
            >
              Try Again
            </Button>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className={styles.page}>
        {/* Header */}
        <div className={styles.header}>
          <div>
            <h1 className={styles.title}>{project?.name || "Project"}</h1>
            <p className={styles.subtitle}>
              {project?.description || "No description"}
            </p>
          </div>
          <div className={styles.actions}>
            <Button variant="secondary" onClick={() => window.location.href = "/projects"}>
              Back to Projects
            </Button>
            <Button variant="primary" onClick={() => setShowDropzone(true)}>
              Upload Files
            </Button>
          </div>
        </div>

        {/* Upload Dropzone (shown when uploading) */}
        {showDropzone && (
          <div className={styles.dropzoneContainer}>
            <Dropzone
              onFiles={handleFilesDropped}
              projectId={projectId}
              multiple={true}
              maxFiles={200}
            />
            <Button
              variant="ghost"
              onClick={() => setShowDropzone(false)}
              className={styles.cancelBtn}
            >
              Cancel
            </Button>
          </div>
        )}

        {/* Upload Queue */}
        {uploadQueue.length > 0 && (
          <div className={styles.queueContainer}>
            <UploadQueue
              files={uploadQueue}
              projectId={projectId}
              onRemove={handleRemoveFromQueue}
              onRetry={handleRetry}
              onPause={handlePause}
              onResume={handleResume}
              onCancel={handleCancel}
              onClearCompleted={() => setUploadQueue([])}
            />
          </div>
        )}

        {/* Files List */}
        <section className={styles.filesSection}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>Files ({files.length})</h2>
          </div>

          {files.length > 0 ? (
            <div className={styles.fileList}>
              {files.map((file) => (
                <div key={file.id} className={styles.fileItem}>
                  <div className={styles.fileIcon} data-category={getFileCategory(file.mimeType)}>
                    {getFileIcon(file.mimeType)}
                  </div>
                  <div className={styles.fileInfo}>
                    <span className={styles.fileName}>{file.name}</span>
                    <div className={styles.fileMeta}>
                      <span>{formatFileSize(file.fileSizeBytes)}</span>
                      <span className={styles.separator}>•</span>
                      <span>{formatRelativeTime(file.createdAt)}</span>
                    </div>
                  </div>
                  <Badge variant={getStatusBadgeVariant(file.status)} size="sm">
                    {file.status}
                  </Badge>
                </div>
              ))}
            </div>
          ) : (
            <div className={styles.empty}>
              <p>No files yet</p>
              <Button variant="primary" onClick={() => setShowDropzone(true)}>
                Upload your first file
              </Button>
            </div>
          )}
        </section>
      </div>
    </AppLayout>
  );
}
