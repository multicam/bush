/**
 * Bush Platform - Chunked Upload Client
 *
 * Browser library for chunked/resumable file uploads.
 * Reference: specs/16-storage-and-data.md Section 2
 * Reference: IMPLEMENTATION_PLAN.md 2.1
 *
 * Features:
 * - 10MB chunks (configurable)
 * - 3-5 parallel uploads (configurable)
 * - IndexedDB for resumable state
 * - Progress events, pause/resume/cancel
 */

// ============================================================================
// Types
// ============================================================================

/**
 * Upload status
 */
export type UploadStatus =
  | "pending"     // Upload not started
  | "uploading"   // Upload in progress
  | "paused"      // Upload paused
  | "completed"   // Upload finished successfully
  | "failed"      // Upload failed
  | "cancelled";  // Upload cancelled by user

/**
 * Chunk upload status
 */
export type ChunkStatus =
  | "pending"
  | "uploading"
  | "completed"
  | "failed";

/**
 * Chunk metadata
 */
export interface ChunkMetadata {
  partNumber: number;
  start: number;
  end: number;
  size: number;
  status: ChunkStatus;
  etag: string | null;
  retryCount: number;
}

/**
 * Upload file metadata stored in IndexedDB
 */
export interface UploadState {
  id: string;
  fileId: string;
  projectId: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  chunkSize: number;
  totalChunks: number;
  chunks: ChunkMetadata[];
  status: UploadStatus;
  uploadId: string | null;
  storageKey: string | null;
  uploadedBytes: number;
  createdAt: Date;
  updatedAt: Date;
  error: string | null;
}

/**
 * Options for creating an upload
 */
export interface UploadOptions {
  projectId: string;
  folderId?: string;
  chunkSize?: number;      // Default: 10MB
  maxParallel?: number;    // Default: 3
  maxRetries?: number;     // Default: 3
  onProgress?: (progress: UploadProgress) => void;
  onComplete?: (result: UploadResult) => void;
  onError?: (error: Error) => void;
}

/**
 * Progress information
 */
export interface UploadProgress {
  uploadId: string;
  fileId: string;
  fileName: string;
  fileSize: number;
  uploadedBytes: number;
  progress: number;        // 0-100
  status: UploadStatus;
  chunksTotal: number;
  chunksCompleted: number;
  chunksPending: number;
  chunksFailed: number;
  uploadSpeed: number;     // bytes per second
  estimatedTimeRemaining: number; // seconds
}

/**
 * Upload result
 */
export interface UploadResult {
  uploadId: string;
  fileId: string;
  fileName: string;
  fileSize: number;
  status: "completed";
  fileAttributes: {
    id: string;
    name: string;
    status: string;
    [key: string]: unknown;
  };
}

/**
 * API response for file creation
 */
interface FileCreateResponse {
  data: {
    id: string;
    type: "file";
    attributes: {
      id: string;
      name: string;
      status: string;
      [key: string]: unknown;
    };
  };
  meta: {
    upload_url?: string;
    upload_method: string;
    upload_expires_at: string;
    storage_key: string;
    chunk_size: number;
  };
}

/**
 * API response for multipart init
 */
interface MultipartInitResponse {
  data: {
    id: string;
    attributes: Record<string, unknown>;
  };
  meta: {
    upload_id: string;
    storage_key: string;
  };
}

/**
 * API response for multipart parts
 */
interface MultipartPartsResponse {
  data: {
    id: string;
    attributes: Record<string, unknown>;
  };
  meta: {
    parts: Array<{
      part_number: number;
      upload_url: string;
    }>;
  };
}

// ============================================================================
// IndexedDB Storage
// ============================================================================

const DB_NAME = "bush-uploads";
const DB_VERSION = 1;
const STORE_NAME = "uploads";

/**
 * Open IndexedDB connection
 */
function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };
  });
}

/**
 * IndexedDB operations for upload state persistence
 */
const uploadStorage = {
  async get(id: string): Promise<UploadState | null> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      const request = store.get(id);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result || null);
    });
  },

  async getAll(): Promise<UploadState[]> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      const request = store.getAll();

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result || []);
    });
  },

  async save(state: UploadState): Promise<void> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      const request = store.put(state);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  },

  async delete(id: string): Promise<void> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      const request = store.delete(id);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  },

  async clear(): Promise<void> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      const request = store.clear();

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  },
};

// ============================================================================
// Utilities
// ============================================================================

/**
 * Generate unique upload ID
 */
function generateUploadId(): string {
  return `upload_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
}

/**
 * Format bytes per second to human readable
 */
function formatSpeed(bytesPerSecond: number): string {
  if (bytesPerSecond < 1024) return `${bytesPerSecond} B/s`;
  if (bytesPerSecond < 1024 * 1024) return `${(bytesPerSecond / 1024).toFixed(1)} KB/s`;
  return `${(bytesPerSecond / (1024 * 1024)).toFixed(1)} MB/s`;
}

// ============================================================================
// Upload Client
// ============================================================================

/**
 * Chunked Upload Client
 *
 * Manages chunked file uploads with resumable support.
 */
export class UploadClient {
  private chunkSize: number;
  private maxParallel: number;
  private maxRetries: number;
  private activeUploads: Map<string, AbortController> = new Map();

  constructor(options?: { chunkSize?: number; maxParallel?: number; maxRetries?: number }) {
    this.chunkSize = options?.chunkSize ?? 10 * 1024 * 1024; // 10MB default
    this.maxParallel = options?.maxParallel ?? 3;
    this.maxRetries = options?.maxRetries ?? 3;
  }

  /**
   * Upload a file with chunked upload support
   */
  async upload(file: File, options: UploadOptions): Promise<UploadResult> {
    const uploadId = generateUploadId();
    const chunkSize = options.chunkSize ?? this.chunkSize;
    const maxParallel = options.maxParallel ?? this.maxParallel;
    const maxRetries = options.maxRetries ?? this.maxRetries;

    // Calculate chunks
    const totalChunks = Math.ceil(file.size / chunkSize);
    const chunks: ChunkMetadata[] = [];

    for (let i = 0; i < totalChunks; i++) {
      const start = i * chunkSize;
      const end = Math.min(start + chunkSize, file.size);
      chunks.push({
        partNumber: i + 1,
        start,
        end,
        size: end - start,
        status: "pending",
        etag: null,
        retryCount: 0,
      });
    }

    // Create initial state
    const state: UploadState = {
      id: uploadId,
      fileId: "",
      projectId: options.projectId,
      fileName: file.name,
      fileSize: file.size,
      mimeType: file.type || "application/octet-stream",
      chunkSize,
      totalChunks,
      chunks,
      status: "pending",
      uploadId: null,
      storageKey: null,
      uploadedBytes: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
      error: null,
    };

    // Save initial state
    await uploadStorage.save(state);

    // Create abort controller for this upload
    const abortController = new AbortController();
    this.activeUploads.set(uploadId, abortController);

    // Track progress
    const startTime = Date.now();
    let lastProgressUpdate = startTime;
    let lastUploadedBytes = 0;

    const emitProgress = (currentState: UploadState) => {
      const now = Date.now();
      const bytesSinceLastUpdate = currentState.uploadedBytes - lastUploadedBytes;
      const timeSinceLastUpdate = now - lastProgressUpdate;

      const uploadSpeed = timeSinceLastUpdate > 0
        ? (bytesSinceLastUpdate / timeSinceLastUpdate) * 1000
        : 0;

      const remainingBytes = file.size - currentState.uploadedBytes;
      const estimatedTimeRemaining = uploadSpeed > 0
        ? remainingBytes / uploadSpeed
        : 0;

      const completedChunks = currentState.chunks.filter(c => c.status === "completed").length;
      const pendingChunks = currentState.chunks.filter(c => c.status === "pending").length;
      const failedChunks = currentState.chunks.filter(c => c.status === "failed").length;

      options.onProgress?.({
        uploadId,
        fileId: currentState.fileId,
        fileName: file.name,
        fileSize: file.size,
        uploadedBytes: currentState.uploadedBytes,
        progress: (currentState.uploadedBytes / file.size) * 100,
        status: currentState.status,
        chunksTotal: totalChunks,
        chunksCompleted: completedChunks,
        chunksPending: pendingChunks,
        chunksFailed: failedChunks,
        uploadSpeed,
        estimatedTimeRemaining,
      });

      lastProgressUpdate = now;
      lastUploadedBytes = currentState.uploadedBytes;
    };

    try {
      // Step 1: Create file record on server
      state.status = "uploading";
      await uploadStorage.save(state);

      const createResponse = await this.createFileRecord(file, options);
      state.fileId = createResponse.data.id;
      state.storageKey = createResponse.meta.storage_key;
      await uploadStorage.save(state);

      emitProgress(state);

      // Step 2: For large files, use multipart upload
      if (file.size > this.chunkSize) {
        // Initialize multipart upload
        const multipartInit = await this.initMultipart(state.fileId, options.projectId, totalChunks);
        state.uploadId = multipartInit.meta.upload_id;
        await uploadStorage.save(state);

        // Get part URLs
        const partsResponse = await this.getPartUrls(
          state.fileId,
          options.projectId,
          state.uploadId,
          totalChunks
        );
        const partUrls = partsResponse.meta.parts;

        // Upload chunks in parallel with controlled concurrency
        await this.uploadChunksParallel(
          file,
          state,
          partUrls,
          maxParallel,
          maxRetries,
          abortController.signal,
          (updatedState) => {
            emitProgress(updatedState);
          }
        );

        // Complete multipart upload
        const completedParts = state.chunks
          .filter(c => c.status === "completed" && c.etag)
          .map(c => ({
            part_number: c.partNumber,
            etag: c.etag!,
          }))
          .sort((a, b) => a.part_number - b.part_number);

        await this.completeMultipart(state.fileId, options.projectId, state.uploadId, completedParts);
      } else {
        // Simple upload for small files
        const uploadUrl = createResponse.meta.upload_url;
        if (!uploadUrl) {
          throw new Error("No upload URL returned from server");
        }

        await this.uploadDirect(file, uploadUrl, abortController.signal);

        // Confirm upload
        await this.confirmUpload(state.fileId, options.projectId);

        state.uploadedBytes = file.size;
        await uploadStorage.save(state);
        emitProgress(state);
      }

      // Mark as completed
      state.status = "completed";
      state.updatedAt = new Date();
      await uploadStorage.save(state);

      const result: UploadResult = {
        uploadId,
        fileId: state.fileId,
        fileName: file.name,
        fileSize: file.size,
        status: "completed",
        fileAttributes: createResponse.data.attributes,
      };

      options.onComplete?.(result);

      // Clean up state after successful upload
      await uploadStorage.delete(uploadId);

      return result;
    } catch (error) {
      // Handle abort
      if ((error as Error).name === "AbortError") {
        state.status = "cancelled";
        state.error = "Upload cancelled";
        await uploadStorage.save(state);
        options.onError?.(new Error("Upload cancelled"));
        throw error;
      }

      // Handle failure
      state.status = "failed";
      state.error = (error as Error).message;
      await uploadStorage.save(state);
      options.onError?.(error as Error);
      throw error;
    } finally {
      this.activeUploads.delete(uploadId);
    }
  }

  /**
   * Pause an upload
   */
  async pause(uploadId: string): Promise<void> {
    const state = await uploadStorage.get(uploadId);
    if (!state) throw new Error(`Upload ${uploadId} not found`);

    if (state.status !== "uploading") {
      throw new Error(`Cannot pause upload in ${state.status} status`);
    }

    // Abort active uploads
    const controller = this.activeUploads.get(uploadId);
    if (controller) {
      controller.abort();
    }

    state.status = "paused";
    state.updatedAt = new Date();
    await uploadStorage.save(state);
  }

  /**
   * Resume a paused upload
   */
  async resume(uploadId: string, file: File, options: UploadOptions): Promise<UploadResult> {
    const state = await uploadStorage.get(uploadId);
    if (!state) throw new Error(`Upload ${uploadId} not found`);

    if (state.status !== "paused") {
      throw new Error(`Cannot resume upload in ${state.status} status`);
    }

    // Verify file matches
    if (file.name !== state.fileName || file.size !== state.fileSize) {
      throw new Error("File does not match the original upload");
    }

    // Reset failed chunks to pending
    for (const chunk of state.chunks) {
      if (chunk.status === "failed") {
        chunk.status = "pending";
        chunk.retryCount = 0;
      }
    }

    state.status = "uploading";
    state.updatedAt = new Date();
    await uploadStorage.save(state);

    const maxParallel = options.maxParallel ?? this.maxParallel;
    const maxRetries = options.maxRetries ?? this.maxRetries;

    // Create abort controller for this upload
    const abortController = new AbortController();
    this.activeUploads.set(uploadId, abortController);

    // Track progress
    const startTime = Date.now();
    let lastProgressUpdate = startTime;
    let lastUploadedBytes = state.uploadedBytes;

    const emitProgress = (currentState: UploadState) => {
      const now = Date.now();
      const bytesSinceLastUpdate = currentState.uploadedBytes - lastUploadedBytes;
      const timeSinceLastUpdate = now - lastProgressUpdate;

      const uploadSpeed = timeSinceLastUpdate > 0
        ? (bytesSinceLastUpdate / timeSinceLastUpdate) * 1000
        : 0;

      const remainingBytes = file.size - currentState.uploadedBytes;
      const estimatedTimeRemaining = uploadSpeed > 0
        ? remainingBytes / uploadSpeed
        : 0;

      const completedChunks = currentState.chunks.filter(c => c.status === "completed").length;
      const pendingChunks = currentState.chunks.filter(c => c.status === "pending").length;
      const failedChunks = currentState.chunks.filter(c => c.status === "failed").length;

      options.onProgress?.({
        uploadId,
        fileId: currentState.fileId,
        fileName: file.name,
        fileSize: file.size,
        uploadedBytes: currentState.uploadedBytes,
        progress: (currentState.uploadedBytes / file.size) * 100,
        status: currentState.status,
        chunksTotal: state.totalChunks,
        chunksCompleted: completedChunks,
        chunksPending: pendingChunks,
        chunksFailed: failedChunks,
        uploadSpeed,
        estimatedTimeRemaining,
      });

      lastProgressUpdate = now;
      lastUploadedBytes = currentState.uploadedBytes;
    };

    try {
      // Ensure we have an upload ID for multipart
      if (!state.uploadId && state.fileId) {
        const multipartInit = await this.initMultipart(state.fileId, state.projectId, state.totalChunks);
        state.uploadId = multipartInit.meta.upload_id;
        await uploadStorage.save(state);
      }

      // Get fresh part URLs for remaining chunks
      if (state.uploadId && state.fileId) {
        const partsResponse = await this.getPartUrls(
          state.fileId,
          state.projectId,
          state.uploadId,
          state.totalChunks
        );
        const partUrls = partsResponse.meta.parts;

        // Upload remaining chunks
        await this.uploadChunksParallel(
          file,
          state,
          partUrls,
          maxParallel,
          maxRetries,
          abortController.signal,
          (updatedState) => {
            emitProgress(updatedState);
          }
        );

        // Complete multipart upload
        const completedParts = state.chunks
          .filter(c => c.status === "completed" && c.etag)
          .map(c => ({
            part_number: c.partNumber,
            etag: c.etag!,
          }))
          .sort((a, b) => a.part_number - b.part_number);

        await this.completeMultipart(state.fileId, state.projectId, state.uploadId, completedParts);
      }

      // Mark as completed
      state.status = "completed";
      state.uploadedBytes = file.size;
      state.updatedAt = new Date();
      await uploadStorage.save(state);

      const result: UploadResult = {
        uploadId,
        fileId: state.fileId,
        fileName: file.name,
        fileSize: file.size,
        status: "completed",
        fileAttributes: {
          id: state.fileId,
          name: file.name,
          status: "ready",
        },
      };

      options.onComplete?.(result);

      // Clean up state after successful upload
      await uploadStorage.delete(uploadId);

      return result;
    } catch (error) {
      // Handle abort
      if ((error as Error).name === "AbortError") {
        state.status = "cancelled";
        state.error = "Upload cancelled";
        await uploadStorage.save(state);
        options.onError?.(new Error("Upload cancelled"));
        throw error;
      }

      // Handle failure
      state.status = "failed";
      state.error = (error as Error).message;
      await uploadStorage.save(state);
      options.onError?.(error as Error);
      throw error;
    } finally {
      this.activeUploads.delete(uploadId);
    }
  }

  /**
   * Cancel an upload
   */
  async cancel(uploadId: string): Promise<void> {
    const state = await uploadStorage.get(uploadId);
    if (!state) return;

    // Abort active uploads
    const controller = this.activeUploads.get(uploadId);
    if (controller) {
      controller.abort();
    }

    // Abort multipart upload on server
    if (state.uploadId && state.fileId) {
      try {
        await this.abortMultipart(state.fileId, state.projectId, state.uploadId);
      } catch {
        // Ignore errors during abort
      }
    }

    state.status = "cancelled";
    state.updatedAt = new Date();
    await uploadStorage.save(state);

    // Clean up
    await uploadStorage.delete(uploadId);
  }

  /**
   * Get upload state
   */
  async getState(uploadId: string): Promise<UploadState | null> {
    return uploadStorage.get(uploadId);
  }

  /**
   * Get all uploads
   */
  async getAllUploads(): Promise<UploadState[]> {
    return uploadStorage.getAll();
  }

  /**
   * Clear completed/failed uploads
   */
  async clearCompleted(): Promise<void> {
    const uploads = await uploadStorage.getAll();
    for (const upload of uploads) {
      if (upload.status === "completed" || upload.status === "failed" || upload.status === "cancelled") {
        await uploadStorage.delete(upload.id);
      }
    }
  }

  // ============================================================================
  // Private API Methods
  // ============================================================================

  private async createFileRecord(
    file: File,
    options: UploadOptions
  ): Promise<FileCreateResponse> {
    const response = await fetch(`/v4/projects/${options.projectId}/files`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: file.name,
        original_name: file.name,
        mime_type: file.type || "application/octet-stream",
        file_size_bytes: file.size,
        folder_id: options.folderId || null,
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ errors: [{ detail: response.statusText }] }));
      throw new Error(error.errors?.[0]?.detail || `Failed to create file: ${response.status}`);
    }

    return response.json();
  }

  private async initMultipart(
    fileId: string,
    projectId: string,
    chunkCount: number
  ): Promise<MultipartInitResponse> {
    const response = await fetch(
      `/v4/projects/${projectId}/files/${fileId}/multipart`,
      {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chunk_count: chunkCount }),
      }
    );

    if (!response.ok) {
      const error = await response.json().catch(() => ({ errors: [{ detail: response.statusText }] }));
      throw new Error(error.errors?.[0]?.detail || `Failed to init multipart: ${response.status}`);
    }

    return response.json();
  }

  private async getPartUrls(
    fileId: string,
    projectId: string,
    uploadId: string,
    chunkCount: number
  ): Promise<MultipartPartsResponse> {
    const params = new URLSearchParams({
      upload_id: uploadId,
      chunk_count: String(chunkCount),
    });

    const response = await fetch(
      `/v4/projects/${projectId}/files/${fileId}/multipart/parts?${params}`,
      {
        credentials: "include",
      }
    );

    if (!response.ok) {
      const error = await response.json().catch(() => ({ errors: [{ detail: response.statusText }] }));
      throw new Error(error.errors?.[0]?.detail || `Failed to get part URLs: ${response.status}`);
    }

    return response.json();
  }

  private async uploadChunksParallel(
    file: File,
    state: UploadState,
    partUrls: Array<{ part_number: number; upload_url: string }>,
    maxParallel: number,
    maxRetries: number,
    signal: AbortSignal,
    onProgress: (state: UploadState) => void
  ): Promise<void> {
    const urlMap = new Map(partUrls.map(p => [p.part_number, p.upload_url]));

    // Create a queue of pending chunks
    const queue = [...state.chunks.filter(c => c.status !== "completed")];
    const inProgress = new Set<Promise<void>>();

    const uploadChunk = async (chunk: ChunkMetadata): Promise<void> => {
      if (signal.aborted) return;

      const url = urlMap.get(chunk.partNumber);
      if (!url) throw new Error(`No URL for part ${chunk.partNumber}`);

      chunk.status = "uploading";
      state.updatedAt = new Date();
      await uploadStorage.save(state);
      onProgress(state);

      const blob = file.slice(chunk.start, chunk.end);

      try {
        const response = await fetch(url, {
          method: "PUT",
          body: blob,
          signal,
        });

        if (!response.ok) {
          throw new Error(`Upload failed with status ${response.status}`);
        }

        // Extract ETag from response
        const etag = response.headers.get("ETag")?.replace(/"/g, "") || "";
        chunk.etag = etag;
        chunk.status = "completed";
        state.uploadedBytes += chunk.size;
      } catch (error) {
        chunk.retryCount++;

        if (chunk.retryCount >= maxRetries || (error as Error).name === "AbortError") {
          chunk.status = "failed";
          throw error;
        }

        // Reset for retry
        chunk.status = "pending";
        throw error;
      }

      state.updatedAt = new Date();
      await uploadStorage.save(state);
      onProgress(state);
    };

    // Process queue with concurrency limit
    while (queue.length > 0 || inProgress.size > 0) {
      if (signal.aborted) break;

      // Fill up to maxParallel
      while (queue.length > 0 && inProgress.size < maxParallel) {
        const chunk = queue.shift()!;
        const promise = uploadChunk(chunk)
          .catch(async (error) => {
            // Re-queue for retry if not exhausted
            if (chunk.retryCount < maxRetries) {
              queue.push(chunk);
            }
            throw error;
          })
          .finally(() => inProgress.delete(promise));
        inProgress.add(promise);
      }

      // Wait for at least one to complete
      if (inProgress.size > 0) {
        await Promise.race(inProgress);
      }
    }

    // Wait for all remaining
    await Promise.allSettled(inProgress);

    // Check for failures
    const failed = state.chunks.filter(c => c.status === "failed");
    if (failed.length > 0) {
      throw new Error(`${failed.length} chunks failed to upload`);
    }
  }

  private async completeMultipart(
    fileId: string,
    projectId: string,
    uploadId: string,
    parts: Array<{ part_number: number; etag: string }>
  ): Promise<void> {
    const response = await fetch(
      `/v4/projects/${projectId}/files/${fileId}/multipart/complete`,
      {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ upload_id: uploadId, parts }),
      }
    );

    if (!response.ok) {
      const error = await response.json().catch(() => ({ errors: [{ detail: response.statusText }] }));
      throw new Error(error.errors?.[0]?.detail || `Failed to complete multipart: ${response.status}`);
    }
  }

  private async abortMultipart(
    fileId: string,
    projectId: string,
    uploadId: string
  ): Promise<void> {
    const response = await fetch(
      `/v4/projects/${projectId}/files/${fileId}/multipart?upload_id=${uploadId}`,
      {
        method: "DELETE",
        credentials: "include",
      }
    );

    if (!response.ok) {
      console.error(`Failed to abort multipart upload: ${response.status}`);
    }
  }

  private async uploadDirect(
    file: File,
    uploadUrl: string,
    signal: AbortSignal
  ): Promise<void> {
    const response = await fetch(uploadUrl, {
      method: "PUT",
      body: file,
      signal,
    });

    if (!response.ok) {
      throw new Error(`Direct upload failed with status ${response.status}`);
    }
  }

  private async confirmUpload(fileId: string, projectId: string): Promise<void> {
    const response = await fetch(
      `/v4/projects/${projectId}/files/${fileId}/confirm`,
      {
        method: "POST",
        credentials: "include",
      }
    );

    if (!response.ok) {
      const error = await response.json().catch(() => ({ errors: [{ detail: response.statusText }] }));
      throw new Error(error.errors?.[0]?.detail || `Failed to confirm upload: ${response.status}`);
    }
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let _uploadClient: UploadClient | null = null;

/**
 * Get the default upload client instance
 */
export function getUploadClient(): UploadClient {
  if (!_uploadClient) {
    _uploadClient = new UploadClient();
  }
  return _uploadClient;
}

/**
 * Create a new upload client with custom options
 */
export function createUploadClient(options?: {
  chunkSize?: number;
  maxParallel?: number;
  maxRetries?: number;
}): UploadClient {
  return new UploadClient(options);
}

// Re-export utilities
export { formatSpeed, uploadStorage };
