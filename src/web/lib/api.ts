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
  // In browser, use NEXT_PUBLIC_API_URL if available
  if (typeof window !== "undefined") {
    const publicApiUrl = process.env.NEXT_PUBLIC_API_URL;
    if (publicApiUrl) {
      return publicApiUrl;
    }
    // Fall back to same origin with /v4 prefix (for proxy)
    return `${window.location.origin}/v4`;
  }
  // Server-side fallback
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
