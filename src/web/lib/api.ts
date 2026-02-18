/**
 * Bush Platform - API Client Library
 *
 * Typed fetch wrapper for the Bush API with proper error handling.
 * Includes credentials: "include" for session cookies.
 * Reference: IMPLEMENTATION_PLAN.md 1.7b
 */

// ============================================================================
// Types
// ============================================================================

/**
 * JSON:API Resource Object
 */
export interface JsonApiResource<T = Record<string, unknown>> {
  id: string;
  type: string;
  attributes: T;
  relationships?: Record<string, {
    data: { id: string; type: string } | Array<{ id: string; type: string }>;
  }>;
  links?: { self: string };
}

/**
 * JSON:API Response (Single Resource)
 */
export interface JsonApiSingleResponse<T = Record<string, unknown>> {
  data: JsonApiResource<T>;
  links?: JsonApiLinks;
}

/**
 * JSON:API Response (Collection)
 */
export interface JsonApiCollectionResponse<T = Record<string, unknown>> {
  data: JsonApiResource<T>[];
  links?: JsonApiLinks;
  meta?: {
    total_count: number;
    page_size: number;
    has_more: boolean;
  };
}

/**
 * JSON:API Links Object
 */
export interface JsonApiLinks {
  self?: string;
  next?: string;
  prev?: string;
  first?: string;
  last?: string;
}

/**
 * JSON:API Error Response
 */
export interface JsonApiError {
  status: string;
  code: string;
  title: string;
  detail?: string;
  source?: {
    pointer?: string;
    parameter?: string;
  };
}

export interface JsonApiErrorResponse {
  errors: JsonApiError[];
}

/**
 * Workspace attributes from API
 */
export interface WorkspaceAttributes {
  name: string;
  description: string | null;
  accountId: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Project attributes from API
 */
export interface ProjectAttributes {
  name: string;
  description: string | null;
  workspaceId: string;
  isRestricted: boolean;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Account attributes from API
 */
export interface AccountAttributes {
  name: string;
  slug: string;
  plan: string;
  storageQuotaBytes: number;
  storageUsedBytes: number;
  createdAt: string;
  updatedAt: string;
  role?: string;
}

// ============================================================================
// API Error Class
// ============================================================================

export class ApiError extends Error {
  public status: number;
  public errors: JsonApiError[];

  constructor(status: number, errorResponse?: JsonApiErrorResponse) {
    const message = errorResponse?.errors?.[0]?.detail
      || errorResponse?.errors?.[0]?.title
      || `API Error: ${status}`;
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.errors = errorResponse?.errors || [];
  }
}

// ============================================================================
// Configuration
// ============================================================================

/**
 * Get the API base URL
 * Uses NEXT_PUBLIC_API_URL for client-side, falls back to relative path
 */
function getApiBaseUrl(): string {
  // In browser, use same-origin /v4 path (proxied to Hono via Next.js rewrites)
  // This ensures cookies are sent with every request
  if (typeof window !== "undefined") {
    return "/v4";
  }
  // Server-side: call Hono directly
  return process.env.API_URL || "http://localhost:3001/v4";
}

/**
 * Default request timeout in milliseconds
 */
const DEFAULT_TIMEOUT_MS = 30000;

/**
 * Default max retries for transient failures
 */
const DEFAULT_MAX_RETRIES = 3;

/**
 * Base delay between retries (exponential backoff)
 */
const RETRY_BASE_DELAY_MS = 1000;

// ============================================================================
// Fetch Wrapper
// ============================================================================

/**
 * Extended request options with timeout, retry, and abort support
 */
export interface ApiFetchOptions extends RequestInit {
  /** Request timeout in milliseconds (default: 30000) */
  timeout?: number;
  /** Maximum retry attempts for transient failures (default: 3) */
  maxRetries?: number;
  /** AbortSignal for request cancellation */
  signal?: AbortSignal;
  /** Skip retry logic (useful for non-idempotent requests) */
  skipRetry?: boolean;
}

/**
 * Check if an error is retryable (5xx, network errors)
 */
function isRetryableError(error: unknown, response?: Response): boolean {
  // Network errors are retryable
  if (error instanceof TypeError && error.message.includes("fetch")) {
    return true;
  }
  // 5xx errors are retryable
  if (response && response.status >= 500 && response.status < 600) {
    return true;
  }
  // 429 Too Many Requests is retryable
  if (response && response.status === 429) {
    return true;
  }
  return false;
}

/**
 * Sleep for a given number of milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Typed fetch wrapper with credentials, timeout, retry, and abort support
 */
async function apiFetch<T>(
  path: string,
  options: ApiFetchOptions = {}
): Promise<T> {
  const {
    timeout = DEFAULT_TIMEOUT_MS,
    maxRetries = DEFAULT_MAX_RETRIES,
    signal: externalSignal,
    skipRetry = false,
    ...fetchOptions
  } = options;

  const baseUrl = getApiBaseUrl();
  const url = `${baseUrl}${path}`;

  // Only retry idempotent methods (GET, HEAD, OPTIONS)
  const method = fetchOptions.method?.toUpperCase() || "GET";
  const shouldRetry = !skipRetry && ["GET", "HEAD", "OPTIONS"].includes(method);

  let lastError: unknown;

  for (let attempt = 0; attempt <= (shouldRetry ? maxRetries : 0); attempt++) {
    // Create abort controller for timeout
    const timeoutController = new AbortController();
    const timeoutId = setTimeout(() => timeoutController.abort(), timeout);

    // Combine with external signal if provided
    let combinedSignal = timeoutController.signal;
    if (externalSignal) {
      // If external signal is already aborted, throw immediately
      if (externalSignal.aborted) {
        clearTimeout(timeoutId);
        throw new DOMException("The operation was aborted.", "AbortError");
      }

      // Create a combined abort controller
      const combinedController = new AbortController();
      const abortHandler = () => combinedController.abort();
      externalSignal.addEventListener("abort", abortHandler);
      timeoutController.signal.addEventListener("abort", abortHandler);
      combinedSignal = combinedController.signal;
    }

    try {
      const response = await fetch(url, {
        ...fetchOptions,
        signal: combinedSignal,
        credentials: "include", // Include session cookies
        headers: {
          "Content-Type": "application/json",
          ...fetchOptions.headers,
        },
      });

      clearTimeout(timeoutId);

      // Handle non-2xx responses
      if (!response.ok) {
        // Check if we should retry
        if (shouldRetry && attempt < maxRetries && isRetryableError(null, response)) {
          const delay = RETRY_BASE_DELAY_MS * Math.pow(2, attempt);
          await sleep(delay);
          continue;
        }

        // Try to parse JSON:API error response
        let errorResponse: JsonApiErrorResponse | undefined;
        try {
          errorResponse = await response.json();
        } catch {
          // Ignore JSON parse errors
        }
        throw new ApiError(response.status, errorResponse);
      }

      // Handle 204 No Content
      if (response.status === 204) {
        return undefined as T;
      }

      return response.json();
    } catch (error) {
      clearTimeout(timeoutId);

      // Don't retry abort errors
      if (error instanceof DOMException && error.name === "AbortError") {
        throw error;
      }

      lastError = error;
      lastResponse = undefined;

      // Check if we should retry
      if (shouldRetry && attempt < maxRetries && isRetryableError(error)) {
        const delay = RETRY_BASE_DELAY_MS * Math.pow(2, attempt);
        await sleep(delay);
        continue;
      }
    }
  }

  // All retries exhausted, throw last error
  if (lastError instanceof ApiError) {
    throw lastError;
  }
  if (lastError instanceof Error) {
    throw lastError;
  }
  throw new Error("Request failed after retries");
}

// ============================================================================
// API Methods
// ============================================================================

/**
 * Workspaces API
 */
export const workspacesApi = {
  /**
   * List all workspaces for the current account
   */
  list: async (options?: { limit?: number; cursor?: string }) => {
    const params = new URLSearchParams();
    if (options?.limit) {
      params.set("limit", String(options.limit));
    }
    if (options?.cursor) {
      params.set("cursor", options.cursor);
    }
    const queryString = params.toString();
    const path = `/workspaces${queryString ? `?${queryString}` : ""}`;
    return apiFetch<JsonApiCollectionResponse<WorkspaceAttributes>>(path);
  },

  /**
   * Get a single workspace by ID
   */
  get: async (id: string) => {
    return apiFetch<JsonApiSingleResponse<WorkspaceAttributes>>(`/workspaces/${id}`);
  },

  /**
   * Create a new workspace
   */
  create: async (data: { name: string; description?: string }) => {
    return apiFetch<JsonApiSingleResponse<WorkspaceAttributes>>("/workspaces", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  /**
   * Update a workspace
   */
  update: async (id: string, data: { name?: string; description?: string }) => {
    return apiFetch<JsonApiSingleResponse<WorkspaceAttributes>>(`/workspaces/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
  },

  /**
   * Delete a workspace
   */
  delete: async (id: string) => {
    return apiFetch<void>(`/workspaces/${id}`, {
      method: "DELETE",
    });
  },
};

/**
 * Projects API
 */
export const projectsApi = {
  /**
   * List all projects for a workspace
   */
  list: async (workspaceId: string, options?: { limit?: number; cursor?: string }) => {
    const params = new URLSearchParams();
    params.set("workspace_id", workspaceId);
    if (options?.limit) {
      params.set("limit", String(options.limit));
    }
    if (options?.cursor) {
      params.set("cursor", options.cursor);
    }
    return apiFetch<JsonApiCollectionResponse<ProjectAttributes>>(`/projects?${params.toString()}`);
  },

  /**
   * Get a single project by ID
   */
  get: async (id: string) => {
    return apiFetch<JsonApiSingleResponse<ProjectAttributes>>(`/projects/${id}`);
  },

  /**
   * Create a new project
   */
  create: async (data: { name: string; workspace_id: string; description?: string }) => {
    return apiFetch<JsonApiSingleResponse<ProjectAttributes>>("/projects", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  /**
   * Update a project
   */
  update: async (id: string, data: {
    name?: string;
    description?: string;
    is_restricted?: boolean;
    archived?: boolean;
  }) => {
    return apiFetch<JsonApiSingleResponse<ProjectAttributes>>(`/projects/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
  },

  /**
   * Delete (archive) a project
   */
  delete: async (id: string) => {
    return apiFetch<void>(`/projects/${id}`, {
      method: "DELETE",
    });
  },
};

/**
 * File attributes from API
 */
export interface FileAttributes {
  name: string;
  originalName: string;
  mimeType: string;
  fileSizeBytes: number;
  status: "uploading" | "processing" | "ready" | "processing_failed" | "deleted";
  folderId: string | null;
  versionStackId: string | null;
  checksum: string | null;
  thumbnailUrl: string | null;
  expiresAt: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  // Metadata fields for badge display
  technicalMetadata?: TechnicalMetadata | null;
  rating?: number | null;
  assetStatus?: string | null;
  keywords?: string[];
  notes?: string | null;
  assigneeId?: string | null;
}

/**
 * Files API
 */
export const filesApi = {
  /**
   * List files in a project
   */
  list: async (projectId: string, options?: {
    folder_id?: string;
    status?: string;
    limit?: number;
    cursor?: string;
  }) => {
    const params = new URLSearchParams();
    if (options?.folder_id) {
      params.set("folder_id", options.folder_id);
    }
    if (options?.status) {
      params.set("status", options.status);
    }
    if (options?.limit) {
      params.set("limit", String(options.limit));
    }
    if (options?.cursor) {
      params.set("cursor", options.cursor);
    }
    const queryString = params.toString();
    const path = `/projects/${projectId}/files${queryString ? `?${queryString}` : ""}`;
    return apiFetch<JsonApiCollectionResponse<FileAttributes>>(path);
  },

  /**
   * Get a single file by ID
   */
  get: async (projectId: string, fileId: string) => {
    return apiFetch<JsonApiSingleResponse<FileAttributes>>(`/projects/${projectId}/files/${fileId}`);
  },

  /**
   * Create file record (for upload)
   */
  create: async (projectId: string, data: {
    name: string;
    original_name?: string;
    mime_type: string;
    file_size_bytes: number;
    folder_id?: string;
    checksum?: string;
  }) => {
    return apiFetch<JsonApiSingleResponse<FileAttributes>>(`/projects/${projectId}/files`, {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  /**
   * Update file metadata
   */
  update: async (projectId: string, fileId: string, data: {
    name?: string;
    folder_id?: string | null;
    status?: string;
  }) => {
    return apiFetch<JsonApiSingleResponse<FileAttributes>>(`/projects/${projectId}/files/${fileId}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
  },

  /**
   * Delete a file (soft delete)
   */
  delete: async (projectId: string, fileId: string) => {
    return apiFetch<void>(`/projects/${projectId}/files/${fileId}`, {
      method: "DELETE",
    });
  },

  /**
   * Get download URL for a file
   */
  getDownloadUrl: async (projectId: string, fileId: string) => {
    return apiFetch<{ data: JsonApiResource<FileAttributes>; meta: { download_url: string; download_expires_at: string } }>(
      `/projects/${projectId}/files/${fileId}/download`
    );
  },

  /**
   * Download a file (convenience method that returns the signed URL)
   */
  download: async (projectId: string, fileId: string) => {
    return apiFetch<{ data: JsonApiResource<FileAttributes>; meta: { download_url: string; download_expires_at: string } }>(
      `/projects/${projectId}/files/${fileId}/download`
    );
  },

  /**
   * Move a file to a different folder
   */
  move: async (projectId: string, fileId: string, data: { folder_id?: string | null }) => {
    return apiFetch<JsonApiSingleResponse<FileAttributes>>(`/projects/${projectId}/files/${fileId}/move`, {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  /**
   * Copy a file to a folder (optionally in a different project)
   */
  copy: async (projectId: string, fileId: string, data?: {
    name?: string;
    folder_id?: string | null;
    project_id?: string;
  }) => {
    return apiFetch<JsonApiSingleResponse<FileAttributes>>(`/projects/${projectId}/files/${fileId}/copy`, {
      method: "POST",
      body: JSON.stringify(data || {}),
    });
  },

  /**
   * Restore a soft-deleted file
   */
  restore: async (projectId: string, fileId: string) => {
    return apiFetch<JsonApiSingleResponse<FileAttributes>>(`/projects/${projectId}/files/${fileId}/restore`, {
      method: "POST",
    });
  },

  /**
   * Upload custom thumbnail (base64 data URL)
   */
  uploadThumbnail: async (projectId: string, fileId: string, imageData: string) => {
    return apiFetch<JsonApiSingleResponse<FileAttributes>>(`/projects/${projectId}/files/${fileId}/thumbnail`, {
      method: "POST",
      body: JSON.stringify({ image_data: imageData }),
    });
  },

  /**
   * Get presigned URL for thumbnail upload
   */
  getThumbnailUploadUrl: async (projectId: string, fileId: string) => {
    return apiFetch<{
      data: JsonApiResource<FileAttributes>;
      meta: {
        upload_url: string;
        upload_expires_at: string;
        storage_key: string;
      };
    }>(`/projects/${projectId}/files/${fileId}/thumbnail`, {
      method: "POST",
      body: JSON.stringify({ mode: "url" }),
    });
  },

  /**
   * Capture video frame as thumbnail
   */
  captureFrameAsThumbnail: async (projectId: string, fileId: string, timestamp: number) => {
    return apiFetch<{
      data: JsonApiResource<FileAttributes>;
      meta: {
        job_id: string;
        message: string;
        timestamp: number;
      };
    }>(`/projects/${projectId}/files/${fileId}/thumbnail/frame`, {
      method: "POST",
      body: JSON.stringify({ timestamp }),
    });
  },

  /**
   * Remove custom thumbnail
   */
  removeThumbnail: async (projectId: string, fileId: string) => {
    return apiFetch<void>(`/projects/${projectId}/files/${fileId}/thumbnail`, {
      method: "DELETE",
    });
  },
};

/**
 * Folder attributes from API
 */
export interface FolderAttributes {
  name: string;
  projectId: string;
  parentId: string | null;
  path: string;
  depth: number;
  isRestricted: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * Folders API
 */
export const foldersApi = {
  /**
   * List root-level folders in a project
   */
  listRoot: async (projectId: string, options?: { limit?: number }) => {
    const params = new URLSearchParams();
    if (options?.limit) {
      params.set("limit", String(options.limit));
    }
    const queryString = params.toString();
    const path = `/projects/${projectId}/folders${queryString ? `?${queryString}` : ""}`;
    return apiFetch<JsonApiCollectionResponse<FolderAttributes>>(path);
  },

  /**
   * Get a single folder by ID
   */
  get: async (folderId: string) => {
    return apiFetch<JsonApiSingleResponse<FolderAttributes>>(`/folders/${folderId}`);
  },

  /**
   * Get folder children (files and subfolders)
   */
  getChildren: async (folderId: string, options?: { limit?: number }) => {
    const params = new URLSearchParams();
    if (options?.limit) {
      params.set("limit", String(options.limit));
    }
    const queryString = params.toString();
    const path = `/folders/${folderId}/children${queryString ? `?${queryString}` : ""}`;
    return apiFetch<{
      data: Array<{
        id: string;
        type: string;
        attributes: FolderAttributes | FileAttributes;
      }>;
      meta: {
        folders_count: number;
        files_count: number;
        total_count: number;
        page_size: number;
      };
    }>(path);
  },

  /**
   * Create a folder at project root
   */
  create: async (projectId: string, data: { name: string }) => {
    return apiFetch<JsonApiSingleResponse<FolderAttributes>>(`/projects/${projectId}/folders`, {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  /**
   * Create a subfolder
   */
  createSubfolder: async (parentFolderId: string, data: { name: string }) => {
    return apiFetch<JsonApiSingleResponse<FolderAttributes>>(`/folders/${parentFolderId}/folders`, {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  /**
   * Update a folder
   */
  update: async (folderId: string, data: { name?: string }) => {
    return apiFetch<JsonApiSingleResponse<FolderAttributes>>(`/folders/${folderId}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
  },

  /**
   * Delete a folder
   */
  delete: async (folderId: string) => {
    return apiFetch<void>(`/folders/${folderId}`, {
      method: "DELETE",
    });
  },

  /**
   * Get files in a folder
   */
  getFiles: async (folderId: string, options?: { status?: string; limit?: number }) => {
    const params = new URLSearchParams();
    if (options?.status) {
      params.set("status", options.status);
    }
    if (options?.limit) {
      params.set("limit", String(options.limit));
    }
    const queryString = params.toString();
    const path = `/folders/${folderId}/files${queryString ? `?${queryString}` : ""}`;
    return apiFetch<JsonApiCollectionResponse<FileAttributes>>(path);
  },
};

/**
 * Accounts API
 */
export const accountsApi = {
  /**
   * List all accounts for the current user
   */
  list: async (options?: { limit?: number }) => {
    const params = new URLSearchParams();
    if (options?.limit) {
      params.set("limit", String(options.limit));
    }
    const queryString = params.toString();
    const path = `/accounts${queryString ? `?${queryString}` : ""}`;
    return apiFetch<JsonApiCollectionResponse<AccountAttributes>>(path);
  },

  /**
   * Get a single account by ID
   */
  get: async (id: string) => {
    return apiFetch<JsonApiSingleResponse<AccountAttributes>>(`/accounts/${id}`);
  },

  /**
   * Create a new account
   */
  create: async (data: { name: string; slug: string }) => {
    return apiFetch<JsonApiSingleResponse<AccountAttributes>>("/accounts", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  /**
   * Update an account
   */
  update: async (id: string, data: { name?: string; slug?: string }) => {
    return apiFetch<JsonApiSingleResponse<AccountAttributes>>(`/accounts/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
  },

  /**
   * Switch to a different account
   */
  switch: async (id: string) => {
    return apiFetch<JsonApiSingleResponse<{ current: boolean; role: string }>>(
      `/accounts/${id}/switch`,
      { method: "POST" }
    );
  },

  /**
   * Get storage usage for account
   */
  getStorage: async (id: string) => {
    return apiFetch<{ data: { id: string; type: "storage"; attributes: {
      used_bytes: number;
      quota_bytes: number;
      available_bytes: number;
      usage_percent: number;
    }}}>(`/accounts/${id}/storage`);
  },
};

/**
 * Bulk operation result type
 */
export interface BulkOperationResult {
  succeeded: string[];
  failed: { id: string; error: string }[];
}

/**
 * Bulk copy result type
 */
export interface BulkCopyResult extends BulkOperationResult {
  copies: { original: string; copy: string }[];
}

/**
 * Bulk download result type
 */
export interface BulkDownloadResult {
  succeeded: { id: string; download_url: string; expires_at: string }[];
  failed: { id: string; error: string }[];
}

/**
 * Bulk Operations API
 */
export const bulkApi = {
  /**
   * Move multiple files to a folder/project
   */
  moveFiles: async (fileIds: string[], destination: {
    type: "folder" | "project" | "root";
    id?: string;
    project_id?: string;
  }) => {
    return apiFetch<{ data: BulkOperationResult }>("/bulk/files/move", {
      method: "POST",
      body: JSON.stringify({ file_ids: fileIds, destination }),
    });
  },

  /**
   * Copy multiple files to a folder/project
   */
  copyFiles: async (fileIds: string[], destination: {
    type: "folder" | "project" | "root";
    id?: string;
    project_id?: string;
  }) => {
    return apiFetch<{ data: BulkCopyResult }>("/bulk/files/copy", {
      method: "POST",
      body: JSON.stringify({ file_ids: fileIds, destination }),
    });
  },

  /**
   * Delete multiple files (soft delete)
   */
  deleteFiles: async (fileIds: string[]) => {
    return apiFetch<{ data: BulkOperationResult }>("/bulk/files/delete", {
      method: "POST",
      body: JSON.stringify({ file_ids: fileIds }),
    });
  },

  /**
   * Get download URLs for multiple files
   */
  downloadFiles: async (fileIds: string[]) => {
    return apiFetch<{ data: BulkDownloadResult }>("/bulk/files/download", {
      method: "POST",
      body: JSON.stringify({ file_ids: fileIds }),
    });
  },

  /**
   * Move multiple folders
   */
  moveFolders: async (folderIds: string[], destination: {
    type: "folder" | "root";
    id?: string;
    project_id?: string;
  }) => {
    return apiFetch<{ data: BulkOperationResult }>("/bulk/folders/move", {
      method: "POST",
      body: JSON.stringify({ folder_ids: folderIds, destination }),
    });
  },

  /**
   * Delete multiple folders
   */
  deleteFolders: async (folderIds: string[]) => {
    return apiFetch<{ data: BulkOperationResult }>("/bulk/folders/delete", {
      method: "POST",
      body: JSON.stringify({ folder_ids: folderIds }),
    });
  },
};

// ============================================================================
// Search API
// ============================================================================

/**
 * Search result attributes from API
 */
export interface SearchResultAttributes {
  name: string;
  originalName: string;
  mimeType: string;
  fileSizeBytes: number;
  status: string;
  createdAt: string | null;
  updatedAt: string | null;
}

/**
 * Search suggestion attributes from API
 */
export interface SearchSuggestionAttributes {
  name: string;
  type: string;
}

/**
 * Search API response meta
 */
export interface SearchMeta {
  total: number;
  query: string;
  has_more: boolean;
}

/**
 * Search API
 */
export const searchApi = {
  /**
   * Search files across accessible projects
   */
  search: async (options: {
    query: string;
    projectId?: string;
    type?: "video" | "audio" | "image" | "document";
    limit?: number;
  }) => {
    const params = new URLSearchParams();
    params.set("q", options.query);
    if (options.projectId) {
      params.set("project_id", options.projectId);
    }
    if (options.type) {
      params.set("type", options.type);
    }
    if (options.limit) {
      params.set("limit", String(options.limit));
    }
    return apiFetch<{
      data: JsonApiResource<SearchResultAttributes>[];
      meta: SearchMeta;
    }>(`/search?${params.toString()}`);
  },

  /**
   * Get search suggestions (typeahead)
   */
  suggestions: async (query: string, limit = 10) => {
    const params = new URLSearchParams();
    params.set("q", query);
    params.set("limit", String(limit));
    return apiFetch<{ data: SearchSuggestionAttributes[] }>(`/search/suggestions?${params.toString()}`);
  },
};

// ============================================================================
// Version Stack Types
// ============================================================================

/**
 * Version Stack attributes from API
 */
export interface VersionStackAttributes {
  name: string;
  projectId: string;
  currentFileId: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Version Stack response with included files
 */
export interface VersionStackWithFilesResponse {
  data: JsonApiResource<VersionStackAttributes> & {
    relationships: {
      files: { data: Array<{ id: string; type: "file" }> };
      current_file: { data: { id: string; type: "file" } | null };
    };
  };
  included: JsonApiResource<FileAttributes>[];
}

// ============================================================================
// Version Stack API
// ============================================================================

/**
 * Version Stack API
 */
export const versionStacksApi = {
  /**
   * Get a version stack by ID with all files
   */
  get: async (stackId: string) => {
    return apiFetch<VersionStackWithFilesResponse>(`/version-stacks/${stackId}`);
  },

  /**
   * Create a new version stack
   */
  create: async (data: {
    project_id: string;
    name: string;
    file_ids?: string[];
  }) => {
    return apiFetch<VersionStackWithFilesResponse>("/version-stacks", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  /**
   * Update a version stack
   */
  update: async (stackId: string, data: {
    name?: string;
    current_file_id?: string | null;
  }) => {
    return apiFetch<JsonApiSingleResponse<VersionStackAttributes>>(`/version-stacks/${stackId}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
  },

  /**
   * Delete a version stack (files are unstacked but not deleted)
   */
  delete: async (stackId: string) => {
    return apiFetch<void>(`/version-stacks/${stackId}`, {
      method: "DELETE",
    });
  },

  /**
   * List files in a version stack
   */
  listFiles: async (stackId: string, options?: { limit?: number }) => {
    const params = new URLSearchParams();
    if (options?.limit) {
      params.set("limit", String(options.limit));
    }
    const queryString = params.toString();
    const path = `/version-stacks/${stackId}/files${queryString ? `?${queryString}` : ""}`;
    return apiFetch<JsonApiCollectionResponse<FileAttributes>>(path);
  },

  /**
   * Add a file to a version stack
   */
  addFile: async (stackId: string, fileId: string) => {
    return apiFetch<JsonApiSingleResponse<FileAttributes>>(`/version-stacks/${stackId}/files`, {
      method: "POST",
      body: JSON.stringify({ file_id: fileId }),
    });
  },

  /**
   * Remove a file from a version stack
   */
  removeFile: async (stackId: string, fileId: string) => {
    return apiFetch<void>(`/version-stacks/${stackId}/files/${fileId}`, {
      method: "DELETE",
    });
  },

  /**
   * Set the current version of a stack
   */
  setCurrent: async (stackId: string, fileId: string) => {
    return apiFetch<JsonApiSingleResponse<VersionStackAttributes>>(`/version-stacks/${stackId}/set-current`, {
      method: "POST",
      body: JSON.stringify({ file_id: fileId }),
    });
  },

  /**
   * Create a version stack from multiple files
   */
  stackFiles: async (data: {
    project_id: string;
    name: string;
    file_ids: string[];
  }) => {
    return apiFetch<VersionStackWithFilesResponse>("/version-stacks", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },
};

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Extract attributes from a JSON:API resource
 */
export function extractAttributes<T>(response: JsonApiSingleResponse<T>): T & { id: string } {
  const { id, attributes } = response.data;
  return { id, ...attributes };
}

/**
 * Extract attributes from a collection of JSON:API resources
 */
export function extractCollectionAttributes<T>(
  response: JsonApiCollectionResponse<T>
): Array<T & { id: string }> {
  return response.data.map((item) => ({
    id: item.id,
    ...item.attributes,
  }));
}

/**
 * Check if an error is an ApiError
 */
export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}

/**
 * Get user-friendly error message from an error
 */
export function getErrorMessage(error: unknown): string {
  if (isApiError(error)) {
    return error.message;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return "An unexpected error occurred";
}

// ============================================================================
// Comment Types
// ============================================================================

/**
 * User attributes embedded in comment responses
 */
export interface CommentUserAttributes {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  avatarUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Comment attributes from API
 */
export interface CommentAttributes {
  fileId: string | null;
  versionStackId: string | null;
  userId: string;
  parentId: string | null;
  text: string;
  timestamp: number | null;
  duration: number | null;
  page: number | null;
  annotation: CommentAnnotation | null;
  isInternal: boolean;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
  // Embedded user info
  user?: CommentUserAttributes;
}

/**
 * Annotation data structure
 */
export interface CommentAnnotation {
  type: "rectangle" | "ellipse" | "arrow" | "line" | "freehand" | "text";
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  points?: Array<{ x: number; y: number }>;
  text?: string;
  color?: string;
  strokeWidth?: number;
}

/**
 * Comment with user response type
 */
export interface CommentWithUserResponse extends JsonApiSingleResponse<CommentAttributes> {
  data: JsonApiResource<CommentAttributes> & {
    attributes: CommentAttributes & { user: CommentUserAttributes };
  };
}

/**
 * Comment collection with users response type
 */
export interface CommentCollectionWithUsersResponse extends JsonApiCollectionResponse<CommentAttributes> {
  data: Array<JsonApiResource<CommentAttributes> & {
    attributes: CommentAttributes & { user: CommentUserAttributes };
  }>;
}

// ============================================================================
// Comments API
// ============================================================================

/**
 * Comments API
 */
export const commentsApi = {
  /**
   * List comments on a file
   */
  listByFile: async (fileId: string, options?: {
    include_replies?: boolean;
    limit?: number;
    cursor?: string;
  }) => {
    const params = new URLSearchParams();
    if (options?.include_replies !== undefined) {
      params.set("include_replies", String(options.include_replies));
    }
    if (options?.limit) {
      params.set("limit", String(options.limit));
    }
    if (options?.cursor) {
      params.set("cursor", options.cursor);
    }
    const queryString = params.toString();
    const path = `/files/${fileId}/comments${queryString ? `?${queryString}` : ""}`;
    return apiFetch<CommentCollectionWithUsersResponse>(path);
  },

  /**
   * List comments on a version stack
   */
  listByVersionStack: async (stackId: string, options?: {
    limit?: number;
    cursor?: string;
  }) => {
    const params = new URLSearchParams();
    if (options?.limit) {
      params.set("limit", String(options.limit));
    }
    if (options?.cursor) {
      params.set("cursor", options.cursor);
    }
    const queryString = params.toString();
    const path = `/version-stacks/${stackId}/comments${queryString ? `?${queryString}` : ""}`;
    return apiFetch<CommentCollectionWithUsersResponse>(path);
  },

  /**
   * Get a single comment by ID
   */
  get: async (commentId: string) => {
    return apiFetch<CommentWithUserResponse>(`/comments/${commentId}`);
  },

  /**
   * Create a comment on a file
   */
  createOnFile: async (fileId: string, data: {
    text: string;
    timestamp?: number;
    duration?: number;
    page?: number;
    annotation?: CommentAnnotation;
    is_internal?: boolean;
    parent_id?: string;
  }) => {
    return apiFetch<CommentWithUserResponse>(`/files/${fileId}/comments`, {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  /**
   * Create a comment on a version stack
   */
  createOnVersionStack: async (stackId: string, data: {
    text: string;
    annotation?: CommentAnnotation;
    is_internal?: boolean;
  }) => {
    return apiFetch<CommentWithUserResponse>(`/version-stacks/${stackId}/comments`, {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  /**
   * Update a comment (own only)
   */
  update: async (commentId: string, data: {
    text?: string;
    timestamp?: number;
    duration?: number;
    page?: number;
    annotation?: CommentAnnotation;
    is_internal?: boolean;
  }) => {
    return apiFetch<CommentWithUserResponse>(`/comments/${commentId}`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  },

  /**
   * Delete a comment (own or admin)
   */
  delete: async (commentId: string) => {
    return apiFetch<void>(`/comments/${commentId}`, {
      method: "DELETE",
    });
  },

  /**
   * Reply to a comment
   */
  reply: async (commentId: string, data: {
    text: string;
    is_internal?: boolean;
  }) => {
    return apiFetch<CommentWithUserResponse>(`/comments/${commentId}/replies`, {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  /**
   * List replies to a comment
   */
  listReplies: async (commentId: string, options?: {
    limit?: number;
    cursor?: string;
  }) => {
    const params = new URLSearchParams();
    if (options?.limit) {
      params.set("limit", String(options.limit));
    }
    if (options?.cursor) {
      params.set("cursor", options.cursor);
    }
    const queryString = params.toString();
    const path = `/comments/${commentId}/replies${queryString ? `?${queryString}` : ""}`;
    return apiFetch<CommentCollectionWithUsersResponse>(path);
  },

  /**
   * Mark comment as complete (or uncomplete)
   */
  setComplete: async (commentId: string, complete: boolean = true) => {
    return apiFetch<CommentWithUserResponse>(`/comments/${commentId}/complete`, {
      method: "PUT",
      body: JSON.stringify({ complete }),
    });
  },
};

// ============================================================================
// Custom Fields Types
// ============================================================================

/**
 * Custom field types
 */
export type CustomFieldType =
  | "text"
  | "textarea"
  | "number"
  | "date"
  | "single_select"
  | "multi_select"
  | "checkbox"
  | "user"
  | "url"
  | "rating";

/**
 * Custom field attributes from API
 */
export interface CustomFieldAttributes {
  accountId: string;
  name: string;
  slug: string;
  type: CustomFieldType;
  description: string | null;
  options: string[] | null;
  isVisibleByDefault: boolean;
  editableBy: "admin" | "full_access";
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

/**
 * Technical metadata extracted from media files
 */
export interface TechnicalMetadata {
  duration: number | null;
  width: number | null;
  height: number | null;
  frameRate: number | null;
  videoCodec: string | null;
  audioCodec: string | null;
  bitRate: number | null;
  sampleRate: number | null;
  channels: number | null;
  isHDR: boolean;
  hdrType: string | null;
  colorSpace: string | null;
  audioBitDepth: number | null;
  format: string | null;
  hasAlpha: boolean;
}

/**
 * Custom field value (can be various types)
 */
export type CustomFieldValue = string | number | boolean | string[] | null;

/**
 * File metadata response
 */
export interface FileMetadataAttributes {
  technical: TechnicalMetadata | null;
  builtin: {
    rating: number | null;
    status: string | null;
    keywords: string[];
    notes: string | null;
    assignee: {
      id: string;
      first_name: string | null;
      last_name: string | null;
      email: string;
    } | null;
  };
  custom: Record<string, {
    field: CustomFieldAttributes;
    value: CustomFieldValue;
  }>;
  file: {
    id: string;
    name: string;
    original_name: string;
    mime_type: string;
    file_size_bytes: number;
    created_at: string;
    updated_at: string;
  };
}

// ============================================================================
// Custom Fields API
// ============================================================================

/**
 * Custom Fields API
 */
export const customFieldsApi = {
  /**
   * List custom field definitions for an account
   */
  list: async (accountId: string, options?: { limit?: number }) => {
    const params = new URLSearchParams();
    if (options?.limit) {
      params.set("limit", String(options.limit));
    }
    const queryString = params.toString();
    const path = `/accounts/${accountId}/custom_fields${queryString ? `?${queryString}` : ""}`;
    return apiFetch<JsonApiCollectionResponse<CustomFieldAttributes>>(path);
  },

  /**
   * Get a custom field definition
   */
  get: async (fieldId: string) => {
    return apiFetch<JsonApiSingleResponse<CustomFieldAttributes>>(`/custom_fields/${fieldId}`);
  },

  /**
   * Create a custom field definition
   */
  create: async (accountId: string, data: {
    name: string;
    type: CustomFieldType;
    slug?: string;
    description?: string;
    options?: string[];
    is_visible_by_default?: boolean;
    editable_by?: "admin" | "full_access";
  }) => {
    return apiFetch<JsonApiSingleResponse<CustomFieldAttributes>>(`/accounts/${accountId}/custom_fields`, {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  /**
   * Update a custom field definition
   */
  update: async (fieldId: string, data: {
    name?: string;
    description?: string;
    options?: string[];
    is_visible_by_default?: boolean;
    editable_by?: "admin" | "full_access";
    sort_order?: number;
  }) => {
    return apiFetch<JsonApiSingleResponse<CustomFieldAttributes>>(`/custom_fields/${fieldId}`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  },

  /**
   * Delete a custom field definition
   */
  delete: async (fieldId: string) => {
    return apiFetch<void>(`/custom_fields/${fieldId}`, {
      method: "DELETE",
    });
  },

  /**
   * Set field visibility for a project
   */
  setVisibility: async (fieldId: string, projectId: string, isVisible: boolean) => {
    return apiFetch<JsonApiSingleResponse<{ project_id: string; is_visible: boolean }>>(
      `/custom_fields/${fieldId}/visibility/${projectId}`,
      {
        method: "PUT",
        body: JSON.stringify({ is_visible: isVisible }),
      }
    );
  },
};

// ============================================================================
// Metadata API
// ============================================================================

/**
 * Metadata API
 */
export const metadataApi = {
  /**
   * Get all metadata for a file
   */
  get: async (fileId: string) => {
    return apiFetch<JsonApiSingleResponse<FileMetadataAttributes>>(`/files/${fileId}/metadata`);
  },

  /**
   * Update all metadata for a file
   */
  update: async (fileId: string, data: {
    rating?: number;
    status?: string;
    keywords?: string[];
    notes?: string;
    assignee_id?: string | null;
    custom?: Record<string, CustomFieldValue>;
  }) => {
    return apiFetch<JsonApiSingleResponse<FileAttributes>>(`/files/${fileId}/metadata`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  },

  /**
   * Update a single metadata field
   */
  updateField: async (fileId: string, fieldId: string, value: CustomFieldValue) => {
    return apiFetch<JsonApiSingleResponse<FileAttributes>>(`/files/${fileId}/metadata/${fieldId}`, {
      method: "PUT",
      body: JSON.stringify({ value }),
    });
  },
};

// ============================================================================
// Shares API
// ============================================================================

/**
 * Share layout types
 */
export type ShareLayout = "grid" | "reel" | "viewer";

/**
 * Share activity types
 */
export type ShareActivityType = "view" | "comment" | "download";

/**
 * Share branding configuration
 */
export interface ShareBranding {
  logo_url?: string;
  background_color?: string;
  accent_color?: string;
  header_size?: "small" | "medium" | "large";
  description?: string;
  dark_mode?: boolean;
}

/**
 * Share attributes from API
 */
export interface ShareAttributes {
  accountId: string;
  projectId: string | null;
  createdByUserId: string;
  name: string;
  slug: string;
  passphrase: string | null;
  expiresAt: string | null;
  layout: ShareLayout;
  allowComments: boolean;
  allowDownloads: boolean;
  showAllVersions: boolean;
  showTranscription: boolean;
  featuredField: string | null;
  branding: ShareBranding | null;
  createdAt: string;
  updatedAt: string;
  asset_count?: number;
  created_by?: {
    id: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
    avatarUrl: string | null;
  };
}

/**
 * Share asset attributes
 */
export interface ShareAssetAttributes {
  shareId: string;
  fileId: string;
  sortOrder: number;
  createdAt: string;
  file?: FileAttributes;
}

/**
 * Share activity attributes
 */
export interface ShareActivityAttributes {
  shareId: string;
  fileId: string | null;
  type: ShareActivityType;
  viewerEmail: string | null;
  viewerIp: string | null;
  userAgent: string | null;
  createdAt: string;
}

/**
 * Shares API
 */
export const sharesApi = {
  /**
   * List shares for an account
   */
  list: async (accountId: string, options?: {
    limit?: number;
    project_id?: string;
    cursor?: string;
  }) => {
    const params = new URLSearchParams();
    if (options?.limit) params.set("limit", String(options.limit));
    if (options?.project_id) params.set("project_id", options.project_id);
    if (options?.cursor) params.set("cursor", options.cursor);
    const queryString = params.toString();
    const path = `/accounts/${accountId}/shares${queryString ? `?${queryString}` : ""}`;
    return apiFetch<JsonApiCollectionResponse<ShareAttributes>>(path);
  },

  /**
   * Get a share by ID
   */
  get: async (shareId: string) => {
    return apiFetch<JsonApiSingleResponse<ShareAttributes>>(`/shares/${shareId}`);
  },

  /**
   * Get a share by slug (public access)
   * @param slug The share slug
   * @param passphrase Optional passphrase for protected shares
   */
  getBySlug: async (slug: string, passphrase?: string) => {
    const url = passphrase
      ? `/shares/slug/${slug}?passphrase=${encodeURIComponent(passphrase)}`
      : `/shares/slug/${slug}`;
    return apiFetch<JsonApiSingleResponse<ShareAttributes & { assets: FileAttributes[]; passphrase_required?: boolean }>>(
      url
    );
  },

  /**
   * Create a new share
   */
  create: async (accountId: string, data: {
    name: string;
    project_id?: string;
    file_ids?: string[];
    passphrase?: string;
    expires_at?: string;
    layout?: ShareLayout;
    allow_comments?: boolean;
    allow_downloads?: boolean;
    show_all_versions?: boolean;
    show_transcription?: boolean;
    featured_field?: string;
    branding?: ShareBranding;
  }) => {
    return apiFetch<JsonApiSingleResponse<ShareAttributes>>(`/accounts/${accountId}/shares`, {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  /**
   * Update a share
   */
  update: async (shareId: string, data: {
    name?: string;
    passphrase?: string | null;
    expires_at?: string | null;
    layout?: ShareLayout;
    allow_comments?: boolean;
    allow_downloads?: boolean;
    show_all_versions?: boolean;
    show_transcription?: boolean;
    featured_field?: string | null;
    branding?: ShareBranding;
  }) => {
    return apiFetch<JsonApiSingleResponse<ShareAttributes>>(`/shares/${shareId}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
  },

  /**
   * Delete a share
   */
  delete: async (shareId: string) => {
    return apiFetch<void>(`/shares/${shareId}`, { method: "DELETE" });
  },

  /**
   * Duplicate a share
   */
  duplicate: async (shareId: string) => {
    return apiFetch<JsonApiSingleResponse<ShareAttributes>>(`/shares/${shareId}/duplicate`, {
      method: "POST",
    });
  },

  /**
   * List assets in a share
   */
  listAssets: async (shareId: string, options?: {
    limit?: number;
    cursor?: string;
  }) => {
    const params = new URLSearchParams();
    if (options?.limit) params.set("limit", String(options.limit));
    if (options?.cursor) params.set("cursor", options.cursor);
    const queryString = params.toString();
    const path = `/shares/${shareId}/assets${queryString ? `?${queryString}` : ""}`;
    return apiFetch<JsonApiCollectionResponse<ShareAssetAttributes>>(path);
  },

  /**
   * Add assets to a share
   */
  addAssets: async (shareId: string, fileIds: string[]) => {
    return apiFetch<void>(`/shares/${shareId}/assets`, {
      method: "POST",
      body: JSON.stringify({ file_ids: fileIds }),
    });
  },

  /**
   * Remove an asset from a share
   */
  removeAsset: async (shareId: string, assetId: string) => {
    return apiFetch<void>(`/shares/${shareId}/assets/${assetId}`, { method: "DELETE" });
  },

  /**
   * Get share activity
   */
  getActivity: async (shareId: string, options?: {
    limit?: number;
    cursor?: string;
    type?: ShareActivityType;
  }) => {
    const params = new URLSearchParams();
    if (options?.limit) params.set("limit", String(options.limit));
    if (options?.cursor) params.set("cursor", options.cursor);
    if (options?.type) params.set("type", options.type);
    const queryString = params.toString();
    const path = `/shares/${shareId}/activity${queryString ? `?${queryString}` : ""}`;
    return apiFetch<JsonApiCollectionResponse<ShareActivityAttributes>>(path);
  },
};

// ============================================================================
// Notifications Types
// ============================================================================

/**
 * Notification types (must match server)
 */
export type NotificationType =
  | "mention"
  | "comment_reply"
  | "comment_created"
  | "upload"
  | "status_change"
  | "share_invite"
  | "share_viewed"
  | "share_downloaded"
  | "assignment"
  | "file_processed";

/**
 * Notification attributes from API
 */
export interface NotificationAttributes {
  notification_type: NotificationType;
  title: string;
  body: string | null;
  read: boolean;
  read_at: string | null;
  created_at: string;
  data: {
    file_id?: string;
    project_id?: string;
    comment_id?: string;
    share_id?: string;
    actor_id?: string;
    [key: string]: unknown;
  };
}

/**
 * Notifications list response with meta
 */
export interface NotificationsListResponse {
  data: Array<{
    id: string;
    type: "notification";
    attributes: NotificationAttributes;
  }>;
  links: JsonApiLinks;
  meta: {
    total_count: number;
    unread_count: number;
    page_size: number;
    has_more: boolean;
  };
}

/**
 * Unread count response
 */
export interface UnreadCountResponse {
  data: {
    id: "unread_count";
    type: "unread_count";
    attributes: {
      count: number;
    };
  };
}

// ============================================================================
// Notifications API
// ============================================================================

/**
 * Notifications API
 */
export const notificationsApi = {
  /**
   * List notifications for current user
   */
  list: async (options?: {
    limit?: number;
    filter_read?: boolean;
    filter_type?: NotificationType;
  }) => {
    const params = new URLSearchParams();
    if (options?.limit) params.set("limit", String(options.limit));
    if (options?.filter_read !== undefined) {
      params.set("filter[read]", String(options.filter_read));
    }
    if (options?.filter_type) {
      params.set("filter[type]", options.filter_type);
    }
    const queryString = params.toString();
    const path = `/users/me/notifications${queryString ? `?${queryString}` : ""}`;
    return apiFetch<NotificationsListResponse>(path);
  },

  /**
   * Get unread notification count
   */
  getUnreadCount: async () => {
    return apiFetch<UnreadCountResponse>("/users/me/notifications/unread-count");
  },

  /**
   * Mark all notifications as read
   */
  markAllRead: async () => {
    return apiFetch<void>("/users/me/notifications/read-all", {
      method: "PUT",
    });
  },

  /**
   * Mark a single notification as read
   */
  markRead: async (notificationId: string) => {
    return apiFetch<void>(`/notifications/${notificationId}/read`, {
      method: "PUT",
    });
  },

  /**
   * Delete a notification
   */
  delete: async (notificationId: string) => {
    return apiFetch<void>(`/notifications/${notificationId}`, {
      method: "DELETE",
    });
  },
};

/**
 * Convert API notification attributes to a typed notification object
 */
export function toNotification(
  id: string,
  attributes: NotificationAttributes
): { id: string } & NotificationAttributes {
  return {
    id,
    ...attributes,
    read_at: attributes.read_at,
    created_at: attributes.created_at,
  };
}

// ============================================================================
// Member Management Types
// ============================================================================

/**
 * Account roles
 */
export type AccountRole = "owner" | "content_admin" | "member" | "guest" | "reviewer";

/**
 * Member user info embedded in member responses
 */
export interface MemberUser {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
}

/**
 * Member attributes from API
 */
export interface MemberAttributes {
  role: AccountRole;
  created_at: string;
  user: MemberUser;
}

// ============================================================================
// Member Management API
// ============================================================================

/**
 * Members API (for account member management)
 */
export const membersApi = {
  /**
   * List members of an account
   */
  list: async (accountId: string, options?: { limit?: number }) => {
    const params = new URLSearchParams();
    if (options?.limit) {
      params.set("limit", String(options.limit));
    }
    const queryString = params.toString();
    const path = `/accounts/${accountId}/members${queryString ? `?${queryString}` : ""}`;
    return apiFetch<JsonApiCollectionResponse<MemberAttributes>>(path);
  },

  /**
   * Invite a new member to the account
   */
  invite: async (accountId: string, data: { email: string; role?: AccountRole }) => {
    return apiFetch<JsonApiSingleResponse<MemberAttributes>>(`/accounts/${accountId}/members`, {
      method: "POST",
      body: JSON.stringify({
        data: {
          type: "member",
          attributes: {
            email: data.email,
            role: data.role || "member",
          },
        },
      }),
    });
  },

  /**
   * Update a member's role
   */
  updateRole: async (accountId: string, memberId: string, role: AccountRole) => {
    return apiFetch<JsonApiSingleResponse<MemberAttributes>>(
      `/accounts/${accountId}/members/${memberId}`,
      {
        method: "PATCH",
        body: JSON.stringify({
          data: {
            type: "member",
            id: memberId,
            attributes: { role },
          },
        }),
      }
    );
  },

  /**
   * Remove a member from the account
   */
  remove: async (accountId: string, memberId: string) => {
    return apiFetch<void>(`/accounts/${accountId}/members/${memberId}`, {
      method: "DELETE",
    });
  },
};

/**
 * Extract member attributes with ID from API response
 */
export function extractMemberAttributes(
  response: JsonApiSingleResponse<MemberAttributes>
): MemberAttributes & { id: string } {
  const { id, attributes } = response.data;
  return { id, ...attributes };
}

/**
 * Extract member collection with IDs from API response
 */
export function extractMemberCollection(
  response: JsonApiCollectionResponse<MemberAttributes>
): Array<MemberAttributes & { id: string }> {
  return response.data.map((item) => ({
    id: item.id,
    ...item.attributes,
  }));
}

// ============================================================================
// Transcription Types
// ============================================================================

/**
 * Transcription status
 */
export type TranscriptionStatus = "pending" | "processing" | "completed" | "failed";

/**
 * Transcription provider
 */
export type TranscriptionProvider = "deepgram" | "assemblyai" | "faster-whisper";

/**
 * Transcription attributes from API
 */
export interface TranscriptionAttributes {
  file_id: string;
  status: TranscriptionStatus;
  provider: TranscriptionProvider;
  language: string | null;
  language_confidence: number | null;
  full_text: string | null;
  speaker_count: number | null;
  speaker_names: Record<string, string>;
  duration_seconds: number | null;
  is_edited: boolean;
  edited_at: string | null;
  edited_by_user_id: string | null;
  edited_by_user: CommentUserAttributes | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Transcript word attributes from API
 */
export interface TranscriptWordAttributes {
  word: string;
  start_ms: number;
  end_ms: number;
  speaker: string | null;
  confidence: number | null;
  position: number;
  original_word: string | null;
}

/**
 * Caption attributes from API
 */
export interface CaptionAttributes {
  file_id: string;
  language: string;
  format: "srt" | "vtt";
  label: string;
  is_default: boolean;
  created_at: string;
}

// ============================================================================
// Transcription API
// ============================================================================

/**
 * Transcription API
 */
export const transcriptionApi = {
  /**
   * Get transcription for a file
   */
  get: async (fileId: string) => {
    return apiFetch<JsonApiSingleResponse<TranscriptionAttributes>>(
      `/files/${fileId}/transcription`
    );
  },

  /**
   * Generate or re-generate transcription
   */
  create: async (fileId: string, options?: {
    language?: string;
    speaker_identification?: boolean;
  }) => {
    return apiFetch<JsonApiSingleResponse<TranscriptionAttributes>>(
      `/files/${fileId}/transcription`,
      {
        method: "POST",
        body: JSON.stringify(options || {}),
      }
    );
  },

  /**
   * Update transcription (edit words, rename speakers)
   */
  update: async (fileId: string, data: {
    speaker_names?: Record<string, string>;
    words?: Array<{ id: string; word: string }>;
    full_text?: string;
  }) => {
    return apiFetch<JsonApiSingleResponse<TranscriptionAttributes>>(
      `/files/${fileId}/transcription`,
      {
        method: "PUT",
        body: JSON.stringify(data),
      }
    );
  },

  /**
   * Delete transcription
   */
  delete: async (fileId: string) => {
    return apiFetch<void>(`/files/${fileId}/transcription`, {
      method: "DELETE",
    });
  },

  /**
   * Export transcription as SRT/VTT/TXT
   */
  export: async (fileId: string, format: "srt" | "vtt" | "txt" = "vtt") => {
    const response = await fetch(
      `${getApiBaseUrl()}/files/${fileId}/transcription/export?format=${format}`,
      { credentials: "include" }
    );
    if (!response.ok) {
      throw new ApiError(response.status);
    }
    return response.text();
  },

  /**
   * Get words for a time range
   */
  getWords: async (fileId: string, options?: {
    start_ms?: number;
    end_ms?: number;
  }) => {
    const params = new URLSearchParams();
    if (options?.start_ms !== undefined) {
      params.set("start_ms", String(options.start_ms));
    }
    if (options?.end_ms !== undefined) {
      params.set("end_ms", String(options.end_ms));
    }
    const queryString = params.toString();
    const path = `/files/${fileId}/transcription/words${queryString ? `?${queryString}` : ""}`;
    return apiFetch<{ data: Array<{ id: string; type: "transcript_word"; attributes: TranscriptWordAttributes }> }>(
      path
    );
  },
};

/**
 * Captions API
 */
export const captionsApi = {
  /**
   * List caption tracks for a file
   */
  list: async (fileId: string) => {
    return apiFetch<{ data: Array<{ id: string; type: "caption"; attributes: CaptionAttributes }> }>(
      `/files/${fileId}/captions`
    );
  },

  /**
   * Upload a caption file
   */
  upload: async (fileId: string, data: {
    file: File;
    language: string;
    label?: string;
    format?: "srt" | "vtt";
  }) => {
    const formData = new FormData();
    formData.append("file", data.file);
    formData.append("language", data.language);
    if (data.label) {
      formData.append("label", data.label);
    }
    if (data.format) {
      formData.append("format", data.format);
    }

    const baseUrl = getApiBaseUrl();
    const response = await fetch(`${baseUrl}/files/${fileId}/captions`, {
      method: "POST",
      credentials: "include",
      body: formData,
    });

    if (!response.ok) {
      let errorResponse: JsonApiErrorResponse | undefined;
      try {
        errorResponse = await response.json();
      } catch {
        // Ignore JSON parse errors
      }
      throw new ApiError(response.status, errorResponse);
    }

    return response.json() as Promise<JsonApiSingleResponse<CaptionAttributes>>;
  },

  /**
   * Delete a caption track
   */
  delete: async (fileId: string, captionId: string) => {
    return apiFetch<void>(`/files/${fileId}/captions/${captionId}`, {
      method: "DELETE",
    });
  },
};

// ============================================================================
// Collections Types
// ============================================================================

/**
 * Collection types
 */
export type CollectionType = "team" | "private";

/**
 * Collection default view
 */
export type CollectionDefaultView = "grid" | "list";

/**
 * Collection filter rule for dynamic collections
 */
export interface CollectionFilterRule {
  field: string;
  operator: "eq" | "ne" | "gt" | "lt" | "gte" | "lte" | "contains" | "starts_with";
  value: string | number | boolean;
}

/**
 * Creator info embedded in collection responses
 */
export interface CollectionCreator {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string;
  avatarUrl: string | null;
}

/**
 * Collection attributes from API
 */
export interface CollectionAttributes {
  name: string;
  description: string | null;
  type: CollectionType;
  isDynamic: boolean;
  filterRules: CollectionFilterRule[] | null;
  defaultView: CollectionDefaultView;
  assetCount: number;
  creator: CollectionCreator;
  createdAt: string;
  updatedAt: string;
}

/**
 * Collection asset attributes
 */
export interface CollectionAssetAttributes {
  id: string;
  name: string;
  mimeType: string;
  fileSizeBytes: number;
  status: string;
  addedBy: {
    id: string;
    firstName: string | null;
    lastName: string | null;
  };
  createdAt: string;
}

/**
 * Collection with assets response
 */
export interface CollectionWithAssetsResponse {
  data: {
    id: string;
    type: "collection";
    attributes: CollectionAttributes;
    relationships: {
      assets: {
        data: Array<{ id: string; type: "file" }>;
      };
    };
  };
  included: Array<{
    id: string;
    type: "file";
    attributes: CollectionAssetAttributes;
  }>;
}

// ============================================================================
// Collections API
// ============================================================================

/**
 * Collections API
 */
export const collectionsApi = {
  /**
   * List collections in a project
   */
  list: async (projectId: string, options?: { limit?: number }) => {
    const params = new URLSearchParams();
    if (options?.limit) {
      params.set("limit", String(options.limit));
    }
    const queryString = params.toString();
    const path = `/projects/${projectId}/collections${queryString ? `?${queryString}` : ""}`;
    return apiFetch<JsonApiCollectionResponse<CollectionAttributes>>(path);
  },

  /**
   * Create a new collection
   */
  create: async (projectId: string, data: {
    name: string;
    description?: string;
    type?: CollectionType;
    filter_rules?: CollectionFilterRule[];
    default_view?: CollectionDefaultView;
  }) => {
    return apiFetch<JsonApiSingleResponse<CollectionAttributes>>(
      `/projects/${projectId}/collections`,
      {
        method: "POST",
        body: JSON.stringify(data),
      }
    );
  },

  /**
   * Get a collection by ID with assets
   */
  get: async (collectionId: string, options?: { limit?: number }) => {
    const params = new URLSearchParams();
    if (options?.limit) {
      params.set("limit", String(options.limit));
    }
    const queryString = params.toString();
    const path = `/collections/${collectionId}${queryString ? `?${queryString}` : ""}`;
    return apiFetch<CollectionWithAssetsResponse>(path);
  },

  /**
   * Update a collection
   */
  update: async (collectionId: string, data: {
    name?: string;
    description?: string | null;
    type?: CollectionType;
    filter_rules?: CollectionFilterRule[] | null;
    default_view?: CollectionDefaultView;
  }) => {
    return apiFetch<JsonApiSingleResponse<CollectionAttributes>>(
      `/collections/${collectionId}`,
      {
        method: "PUT",
        body: JSON.stringify(data),
      }
    );
  },

  /**
   * Delete a collection
   */
  delete: async (collectionId: string) => {
    return apiFetch<void>(`/collections/${collectionId}`, {
      method: "DELETE",
    });
  },

  /**
   * Add items to a collection
   */
  addItems: async (collectionId: string, fileIds: string[]) => {
    return apiFetch<{ data: { added: string[]; failed: Array<{ id: string; error: string }> } }>(
      `/collections/${collectionId}/items`,
      {
        method: "POST",
        body: JSON.stringify({ file_ids: fileIds }),
      }
    );
  },

  /**
   * Remove an item from a collection
   */
  removeItem: async (collectionId: string, itemId: string) => {
    return apiFetch<void>(`/collections/${collectionId}/items/${itemId}`, {
      method: "DELETE",
    });
  },
};

/**
 * Extract collection attributes with ID from API response
 */
export function extractCollectionAttributesFromResponse(
  response: JsonApiSingleResponse<CollectionAttributes>
): CollectionAttributes & { id: string } {
  const { id, attributes } = response.data;
  return { id, ...attributes };
}

/**
 * Extract collection collection with IDs from API response
 */
export function extractCollectionList(
  response: JsonApiCollectionResponse<CollectionAttributes>
): Array<CollectionAttributes & { id: string }> {
  return response.data.map((item) => ({
    id: item.id,
    ...item.attributes,
  }));
}
