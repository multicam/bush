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

// ============================================================================
// Fetch Wrapper
// ============================================================================

/**
 * Typed fetch wrapper with credentials and error handling
 */
async function apiFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const baseUrl = getApiBaseUrl();
  const url = `${baseUrl}${path}`;

  const response = await fetch(url, {
    ...options,
    credentials: "include", // Include session cookies
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  // Handle non-2xx responses
  if (!response.ok) {
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
  expiresAt: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
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
