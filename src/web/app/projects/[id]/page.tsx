/**
 * Bush Platform - Project Detail Page
 *
 * Shows project details with file browser and upload functionality.
 * Reference: IMPLEMENTATION_PLAN.md 2.1 [P1] Drag-and-Drop UI, Upload Queue UI
 * Reference: IMPLEMENTATION_PLAN.md 2.3 [P1] Asset Browser Grid View
 */
"use client";

import { useState, useEffect, useCallback } from "react";
import { AppLayout } from "@/web/components/layout";
import { Button, Badge } from "@/web/components/ui";
import { Dropzone, UploadQueue, type DroppedFile, type QueuedFile } from "@/web/components/upload";
import { AssetBrowser, type AssetFile } from "@/web/components/asset-browser";
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
import { getUploadClient, type UploadProgress } from "@/web/lib/upload-client";
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
  const [selectedFileIds, setSelectedFileIds] = useState<string[]>([]);
  const uploadClient = getUploadClient();

  // Convert FileItem to AssetFile format for AssetBrowser
  const assetFiles: AssetFile[] = files.map((f) => ({
    id: f.id,
    name: f.name,
    mimeType: f.mimeType,
    fileSizeBytes: f.fileSizeBytes,
    status: f.status,
    thumbnailUrl: f.thumbnailUrl,
    createdAt: f.createdAt,
    updatedAt: f.updatedAt,
  }));

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

  // Handle file click in asset browser
  const handleFileClick = useCallback((file: AssetFile) => {
    // TODO: Open file viewer/preview
    console.log("File clicked:", file);
  }, []);

  // Handle selection change
  const handleSelectionChange = useCallback((ids: string[]) => {
    setSelectedFileIds(ids);
  }, []);

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

        {/* Asset Browser */}
        <section className={styles.browserSection}>
          <AssetBrowser
            projectId={projectId}
            files={assetFiles}
            selectedIds={selectedFileIds}
            onSelectionChange={handleSelectionChange}
            onFileClick={handleFileClick}
            defaultViewMode="grid"
            defaultCardSize="medium"
          />
        </section>
      </div>
    </AppLayout>
  );
}
