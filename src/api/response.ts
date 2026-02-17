/**
 * Bush Platform - JSON:API Response Formatter
 *
 * Utilities for formatting responses in JSON:API specification format.
 * Reference: specs/17-api-complete.md Section 3
 */
import type { Context } from "hono";

/**
 * JSON:API Resource Object
 */
export interface JsonApiResource<T = Record<string, unknown>> {
  id: string;
  type: string;
  attributes: T;
  relationships?: Record<string, { data: { id: string; type: string } | Array<{ id: string; type: string }> }>;
  links?: { self: string };
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
 * Pagination cursor (base64 encoded)
 */
export interface PaginationCursor {
  id: string;
  [key: string]: unknown;
}

/**
 * Pagination options
 */
export interface PaginationOptions {
  /** Number of items per page (default 50, max 100) */
  limit?: number;
  /** Cursor for next page */
  cursor?: string;
  /** Base path for generating links */
  basePath: string;
  /** Query params to preserve in links */
  queryParams?: Record<string, string>;
}

/**
 * Encode cursor to base64
 */
export function encodeCursor(cursor: PaginationCursor): string {
  return Buffer.from(JSON.stringify(cursor)).toString("base64url");
}

/**
 * Decode cursor from base64
 */
export function decodeCursor(cursor: string): PaginationCursor | null {
  try {
    return JSON.parse(Buffer.from(cursor, "base64url").toString("utf-8"));
  } catch {
    return null;
  }
}

/**
 * Format a single resource as JSON:API response
 *
 * @example
 * return c.json(singleResponse(file, 'file', { id: file.id, name: file.name }));
 */
export function singleResponse<T>(
  data: T & { id: string },
  type: string,
  options?: {
    relationships?: JsonApiResource["relationships"];
    selfLink?: string;
  }
): JsonApiSingleResponse<T> {
  const { id, ...attributes } = data;

  const resource: JsonApiResource<T> = {
    id,
    type,
    attributes: attributes as T,
  };

  if (options?.relationships) {
    resource.relationships = options.relationships;
  }

  if (options?.selfLink) {
    resource.links = { self: options.selfLink };
  }

  return { data: resource };
}

/**
 * Format a collection of resources as JSON:API response with pagination
 *
 * @example
 * return c.json(collectionResponse(files, 'file', {
 *   basePath: '/v4/projects/abc/files',
 *   limit: 50,
 *   totalCount: 142
 * }));
 */
export function collectionResponse<T extends { id: string }>(
  items: T[],
  type: string,
  options: PaginationOptions & { totalCount?: number }
): JsonApiCollectionResponse<Omit<T, "id">> {
  const limit = Math.min(options.limit ?? 50, 100);
  const totalCount = options.totalCount ?? items.length;
  const hasMore = items.length > limit;

  // Only include items up to limit
  const data: JsonApiResource<Omit<T, "id">>[] = items.slice(0, limit).map((item) => {
    const { id, ...attributes } = item;
    return {
      id,
      type,
      attributes: attributes as Omit<T, "id">,
    };
  });

  // Build links
  const links: JsonApiLinks = {
    self: buildUrl(options.basePath, options.queryParams),
  };

  // Add next link if there are more items
  if (hasMore && data.length > 0) {
    const lastItem = data[data.length - 1];
    const attrs = lastItem.attributes as Record<string, unknown>;
    const cursor = encodeCursor({
      id: lastItem.id,
      ...(attrs.createdAt ? { createdAt: attrs.createdAt } : {}),
    });
    links.next = buildUrl(options.basePath, { ...options.queryParams, cursor });
  }

  const response: JsonApiCollectionResponse<Omit<T, "id">> = {
    data,
    links,
    meta: {
      total_count: totalCount,
      page_size: limit,
      has_more: hasMore,
    },
  };

  return response;
}

/**
 * Build URL with query parameters
 */
function buildUrl(basePath: string, params?: Record<string, string | undefined>): string {
  if (!params) return basePath;

  const searchParams = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) {
      searchParams.set(key, value);
    }
  }

  const queryString = searchParams.toString();
  return queryString ? `${basePath}?${queryString}` : basePath;
}

/**
 * Helper to send a single resource response
 */
export function sendSingle<T extends { id: string }>(
  c: Context,
  data: T,
  type: string,
  options?: Parameters<typeof singleResponse<T>>[2]
) {
  return c.json(singleResponse(data, type, options));
}

/**
 * Helper to send a collection response
 */
export function sendCollection<T extends { id: string }>(
  c: Context,
  items: T[],
  type: string,
  options: Parameters<typeof collectionResponse<T>>[2]
) {
  return c.json(collectionResponse(items, type, options));
}

/**
 * Helper to send a no-content response (for DELETE operations)
 */
export function sendNoContent(c: Context) {
  return c.body(null, 204);
}

/**
 * Helper to send an accepted response (for async operations)
 */
export function sendAccepted(c: Context, message?: string) {
  return c.json({ message: message ?? "Request accepted for processing" }, 202);
}

/**
 * Convert database record dates to ISO strings for JSON output
 */
export function formatDates<T extends Record<string, unknown>>(
  record: T,
  dateFields: (keyof T)[] = ["createdAt", "updatedAt", "deletedAt", "expiresAt", "archivedAt"] as (keyof T)[]
): T {
  const result = { ...record };
  for (const field of dateFields) {
    const value = result[field];
    if (value instanceof Date) {
      (result as Record<string, unknown>)[field as string] = value.toISOString();
    } else if (typeof value === "number") {
      // SQLite stores dates as Unix timestamps (seconds or milliseconds)
      (result as Record<string, unknown>)[field as string] = new Date(value).toISOString();
    }
  }
  return result;
}

/**
 * Resource type constants
 */
export const RESOURCE_TYPES = {
  ACCOUNT: "account",
  USER: "user",
  WORKSPACE: "workspace",
  PROJECT: "project",
  FOLDER: "folder",
  FILE: "file",
  VERSION_STACK: "version_stack",
  COMMENT: "comment",
  SHARE: "share",
  NOTIFICATION: "notification",
  CUSTOM_FIELD: "custom_field",
} as const;
