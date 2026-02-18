/**
 * Bush Platform - Project Detail Page
 *
 * Shows project details with file browser and upload functionality.
 * Reference: IMPLEMENTATION_PLAN.md 2.1 [P1] Drag-and-Drop UI, Upload Queue UI
 * Reference: IMPLEMENTATION_PLAN.md 2.3 [P1] Asset Browser Grid View
 * Reference: IMPLEMENTATION_PLAN.md 2.3 [P1] Folder Navigation
 */
"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { AppLayout } from "@/web/components/layout";
import { Button } from "@/web/components/ui";
import { Dropzone, UploadQueue, type DroppedFile, type QueuedFile } from "@/web/components/upload";
import { AssetBrowser, type AssetFile, type AssetFolder } from "@/web/components/asset-browser";
import { FolderTree, Breadcrumbs, type BreadcrumbItem } from "@/web/components/folder-navigation";
import { useAuth } from "@/web/context";
import {
  projectsApi,
  filesApi,
  foldersApi,
  extractAttributes,
  extractCollectionAttributes,
  getErrorMessage,
  type ProjectAttributes,
  type FileAttributes,
  type FolderAttributes,
} from "@/web/lib/api";
import { getUploadClient, type UploadProgress } from "@/web/lib/upload-client";
import { FolderUploadManager, hasFolderStructure, getFolderStructureSummary } from "@/web/lib/folder-upload";
import styles from "./project.module.css";

interface Project extends ProjectAttributes {
  id: string;
}

interface FileItem extends FileAttributes {
  id: string;
}

interface FolderItem extends FolderAttributes {
  id: string;
}

type LoadingState = "loading" | "error" | "loaded";

// Simple modal component for folder creation
function CreateFolderModal({
  isOpen,
  onClose,
  onCreate,
  parentFolderName,
}: {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (name: string) => Promise<void>;
  parentFolderName: string;
}) {
  const [name, setName] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setIsCreating(true);
    setError(null);
    try {
      await onCreate(name.trim());
      setName("");
      onClose();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setIsCreating(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <h3 className={styles.modalTitle}>Create New Folder</h3>
        <p className={styles.modalSubtitle}>
          in {parentFolderName}
        </p>
        <form onSubmit={handleSubmit}>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Folder name"
            className={styles.modalInput}
            autoFocus
            disabled={isCreating}
          />
          {error && <p className={styles.modalError}>{error}</p>}
          <div className={styles.modalActions}>
            <Button
              type="button"
              variant="secondary"
              onClick={onClose}
              disabled={isCreating}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={!name.trim() || isCreating}
            >
              {isCreating ? "Creating..." : "Create"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const [projectId, setProjectId] = useState<string>("");
  const { isAuthenticated, isLoading: authLoading, login } = useAuth();

  // Unwrap the params Promise
  useEffect(() => {
    params.then((p) => setProjectId(p.id));
  }, [params]);

  const [project, setProject] = useState<Project | null>(null);
  const [files, setFiles] = useState<FileItem[]>([]);
  const [folders, setFolders] = useState<FolderItem[]>([]);
  const [loadingState, setLoadingState] = useState<LoadingState>("loading");
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [showDropzone, setShowDropzone] = useState(false);
  const [uploadQueue, setUploadQueue] = useState<QueuedFile[]>([]);
  const [selectedFileIds, setSelectedFileIds] = useState<string[]>([]);

  // Folder navigation state
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [breadcrumbItems, setBreadcrumbItems] = useState<BreadcrumbItem[]>([
    { id: null, name: "All Files" },
  ]);
  const [showCreateFolderModal, setShowCreateFolderModal] = useState(false);
  const [showSidebar, setShowSidebar] = useState(true);

  const uploadClient = getUploadClient();

  // Use refs to hold functions to avoid circular dependencies
  const refreshFilesRef = useRef<(() => Promise<void>) | undefined>(undefined);
  const startUploadRef = useRef<((queuedFile: QueuedFile) => Promise<void>) | undefined>(undefined);

  // Convert FileItem to AssetFile format for AssetBrowser
  const assetFiles: AssetFile[] = files.map((f) => ({
    id: f.id,
    name: f.name,
    mimeType: f.mimeType,
    fileSizeBytes: f.fileSizeBytes,
    status: f.status,
    thumbnailUrl: f.thumbnailUrl ?? null,
    createdAt: f.createdAt,
    updatedAt: f.updatedAt,
  }));

  // Convert FolderItem to AssetFolder format for AssetBrowser
  const assetFolders: AssetFolder[] = folders.map((f) => ({
    id: f.id,
    name: f.name,
    parentId: f.parentId,
    projectId: f.projectId,
    createdAt: f.createdAt,
    updatedAt: f.updatedAt,
  }));

  // Build breadcrumb path when folder changes
  const buildBreadcrumbPath = useCallback(async (folderId: string | null) => {
    if (!folderId) {
      setBreadcrumbItems([{ id: null, name: "All Files" }]);
      return;
    }

    try {
      // Fetch folder and its ancestors
      const items: BreadcrumbItem[] = [];
      let currentId: string | null = folderId;

      while (currentId) {
        const response = await foldersApi.get(currentId);
        const folder = extractAttributes(response) as FolderItem;
        items.unshift({ id: folder.id, name: folder.name });
        currentId = folder.parentId;
      }

      // Add root
      items.unshift({ id: null, name: "All Files" });
      setBreadcrumbItems(items);
    } catch (error) {
      console.error("Failed to build breadcrumb path:", error);
      setBreadcrumbItems([{ id: null, name: "All Files" }]);
    }
  }, []);

  // Refresh files and folders list
  const refreshFiles = useCallback(async () => {
    if (!projectId) return;

    try {
      if (currentFolderId) {
        // Load contents of current folder
        const response = await foldersApi.getChildren(currentFolderId, { limit: 500 });

        const folderItems = response.data
          .filter((item) => item.type === "folder")
          .map((item) => ({ id: item.id, ...item.attributes })) as FolderItem[];

        const fileItems = response.data
          .filter((item) => item.type === "file")
          .map((item) => ({ id: item.id, ...item.attributes })) as FileItem[];

        setFolders(folderItems);
        setFiles(fileItems);
      } else {
        // Load root-level content
        const [foldersResponse, filesResponse] = await Promise.all([
          foldersApi.listRoot(projectId, { limit: 500 }),
          filesApi.list(projectId, { limit: 500 }),
        ]);

        const folderItems = extractCollectionAttributes(foldersResponse) as FolderItem[];
        const fileItems = extractCollectionAttributes(filesResponse) as FileItem[];

        setFolders(folderItems);
        setFiles(fileItems);
      }
    } catch (error) {
      console.error("Failed to refresh files:", error);
    }
  }, [projectId, currentFolderId]);

  // Start upload for a single file
  const startUpload = useCallback(
    async (queuedFile: QueuedFile) => {
      try {
        // Use targetFolderId if set (from folder structure preservation), otherwise currentFolderId
        const folderId = queuedFile.targetFolderId ?? currentFolderId ?? undefined;

        await uploadClient.upload(queuedFile.file, {
          projectId,
          folderId,
          onProgress: (progress) => {
            setUploadQueue((prev) =>
              prev.map((f) =>
                f.id === queuedFile.id ? { ...f, progress } : f
              )
            );
          },
          onComplete: (_result) => {
            setUploadQueue((prev) => prev.filter((f) => f.id !== queuedFile.id));
            // Refresh file list
            refreshFilesRef.current?.();
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
      } catch {
        // Error is handled in onError callback
      }
    },
    [projectId, currentFolderId, uploadClient]
  );

  // Update refs when functions change
  useEffect(() => {
    refreshFilesRef.current = refreshFiles;
    startUploadRef.current = startUpload;
  }, [refreshFiles, startUpload]);

  // Fetch project and initial files
  useEffect(() => {
    async function fetchData() {
      if (authLoading || !projectId) return;

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

        // Fetch root-level content
        const [foldersResponse, filesResponse] = await Promise.all([
          foldersApi.listRoot(projectId, { limit: 500 }),
          filesApi.list(projectId, { limit: 500 }),
        ]);

        const folderItems = extractCollectionAttributes(foldersResponse) as FolderItem[];
        const fileItems = extractCollectionAttributes(filesResponse) as FileItem[];

        setFolders(folderItems);
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

  // Refresh when folder changes (only after initial load is complete)
  useEffect(() => {
    if (loadingState !== "loaded") return;

    // Use void to explicitly ignore the returned promise
    // These async functions internally call setState, which is intentional here
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refreshFiles();
    void buildBreadcrumbPath(currentFolderId);
  }, [currentFolderId, loadingState, refreshFiles, buildBreadcrumbPath]);

  // Handle files dropped/selected
  const handleFilesDropped = useCallback(
    async (droppedFiles: DroppedFile[]) => {
      // Filter valid files
      const validFiles = droppedFiles.filter((f) => f.isValid);

      if (validFiles.length === 0) {
        return;
      }

      // Check if any files have folder structure
      const hasFolders = hasFolderStructure(
        validFiles.map((f) => ({ file: f.file, relativePath: f.relativePath }))
      );

      let folderManager: FolderUploadManager | null = null;
      if (hasFolders) {
        // Create folder manager for preserving folder structure
        folderManager = new FolderUploadManager(projectId, currentFolderId ?? undefined);

        // Log folder structure for user awareness
        const summary = getFolderStructureSummary(
          validFiles.map((f) => ({ file: f.file, relativePath: f.relativePath }))
        );
        console.log(
          `Uploading ${summary.totalFiles} files in ${summary.folderCount} folders (${summary.topLevelFolders.join(", ")})`
        );
      }

      // Add files to queue
      const newQueuedFiles: QueuedFile[] = await Promise.all(
        validFiles.map(async (f) => {
          // Resolve target folder for files with relative paths
          let targetFolderId: string | undefined;
          if (f.relativePath && folderManager) {
            try {
              targetFolderId = (await folderManager.getFolderForPath(f.relativePath)) ?? undefined;
            } catch (error) {
              console.error(`Failed to resolve folder for ${f.relativePath}:`, error);
              // Fall back to current folder on error
              targetFolderId = currentFolderId ?? undefined;
            }
          } else {
            targetFolderId = currentFolderId ?? undefined;
          }

          return {
            id: f.id,
            file: f.file,
            progress: undefined,
            error: undefined,
            relativePath: f.relativePath,
            targetFolderId,
          };
        })
      );

      setUploadQueue((prev) => [...prev, ...newQueuedFiles]);

      // Start uploads using ref to avoid dependency issues
      for (const queuedFile of newQueuedFiles) {
        startUploadRef.current?.(queuedFile);
      }

      setShowDropzone(false);
    },
    [projectId, currentFolderId]
  );

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
            f.id === fileId ? { ...f, error: undefined, progress: { status: "pending" } as UploadProgress } : f
          )
        );
        startUploadRef.current?.(queuedFile);
      }
    },
    [uploadQueue]
  );

  // Handle pause
  const handlePause = useCallback(async (fileId: string) => {
    await uploadClient.pause(fileId);
    setUploadQueue((prev) =>
      prev.map((f) =>
        f.id === fileId ? { ...f, progress: { ...f.progress, status: "paused" } as UploadProgress } : f
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
          f.id === fileId ? { ...f, progress: { ...f.progress, status: "uploading" } as UploadProgress } : f
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
    // Navigate to file viewer page
    window.location.href = `/projects/${projectId}/files/${file.id}`;
  }, [projectId]);

  // Handle folder click in asset browser
  const handleFolderClick = useCallback((folder: AssetFolder) => {
    setCurrentFolderId(folder.id);
  }, []);

  // Handle breadcrumb navigation
  const handleBreadcrumbNavigate = useCallback((folderId: string | null) => {
    setCurrentFolderId(folderId);
  }, []);

  // Handle folder tree selection
  const handleFolderTreeSelect = useCallback((folderId: string | null) => {
    setCurrentFolderId(folderId);
  }, []);

  // Handle create folder
  const handleCreateFolder = useCallback(async (name: string) => {
    if (currentFolderId) {
      await foldersApi.createSubfolder(currentFolderId, { name });
    } else {
      await foldersApi.create(projectId, { name });
    }
    refreshFiles();
  }, [projectId, currentFolderId, refreshFiles]);

  // Loading state
  if (!projectId || authLoading || loadingState === "loading") {
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
          <div className={styles.headerLeft}>
            <div>
              <h1 className={styles.title}>{project?.name || "Project"}</h1>
              <p className={styles.subtitle}>
                {project?.description || "No description"}
              </p>
            </div>
          </div>
          <div className={styles.actions}>
            <Button
              variant="secondary"
              onClick={() => setShowSidebar(!showSidebar)}
              className={styles.toggleSidebarBtn}
            >
              {showSidebar ? "Hide Folders" : "Show Folders"}
            </Button>
            <Button variant="secondary" onClick={() => window.location.href = "/projects"}>
              Back to Projects
            </Button>
            <Button variant="primary" onClick={() => setShowDropzone(true)}>
              Upload Files
            </Button>
          </div>
        </div>

        {/* Breadcrumbs */}
        <div className={styles.breadcrumbsContainer}>
          <Breadcrumbs
            items={breadcrumbItems}
            onNavigate={handleBreadcrumbNavigate}
          />
        </div>

        {/* Upload Dropzone (shown when uploading) */}
        {showDropzone && (
          <div className={styles.dropzoneContainer}>
            <Dropzone
              onFiles={handleFilesDropped}
              multiple={true}
              maxFiles={200}
              allowFolders={true}
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

        {/* Main Content */}
        <div className={styles.mainContent}>
          {/* Sidebar with folder tree */}
          {showSidebar && (
            <aside className={styles.sidebar}>
              <div className={styles.sidebarHeader}>
                <h3 className={styles.sidebarTitle}>Folders</h3>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowCreateFolderModal(true)}
                  title="Create folder"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                    <line x1="12" y1="11" x2="12" y2="17" />
                    <line x1="9" y1="14" x2="15" y2="14" />
                  </svg>
                </Button>
              </div>
              <FolderTree
                projectId={projectId}
                selectedFolderId={currentFolderId}
                onSelect={handleFolderTreeSelect}
                showRoot={true}
              />
            </aside>
          )}

          {/* Asset Browser */}
          <section className={styles.browserSection}>
            <div className={styles.browserHeader}>
              <div className={styles.browserInfo}>
                {folders.length + files.length} items
                {folders.length > 0 && (
                  <span className={styles.itemBreakdown}>
                    {" "}({folders.length} folders, {files.length} files)
                  </span>
                )}
              </div>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setShowCreateFolderModal(true)}
              >
                New Folder
              </Button>
            </div>
            <AssetBrowser
              projectId={projectId}
              folderId={currentFolderId}
              files={assetFiles}
              folders={assetFolders}
              selectedIds={selectedFileIds}
              onSelectionChange={setSelectedFileIds}
              onFileClick={handleFileClick}
              onFolderClick={handleFolderClick}
              defaultViewMode="grid"
              defaultCardSize="medium"
            />
          </section>
        </div>
      </div>

      {/* Create Folder Modal */}
      <CreateFolderModal
        isOpen={showCreateFolderModal}
        onClose={() => setShowCreateFolderModal(false)}
        onCreate={handleCreateFolder}
        parentFolderName={
          currentFolderId
            ? breadcrumbItems[breadcrumbItems.length - 1]?.name || "Current Folder"
            : "All Files"
        }
      />
    </AppLayout>
  );
}
