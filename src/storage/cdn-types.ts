/**
 * Bush Platform - CDN Provider Types
 *
 * Provider-agnostic types for CDN operations.
 * Supports Bunny CDN (preferred), CloudFront, Fastly, or any pull-based CDN.
 * Reference: specs/06-storage.md Section 5
 */

/**
 * Supported CDN providers
 */
export type CDNProviderType = "none" | "bunny" | "cloudfront" | "fastly";

/**
 * Content types for delivery URL generation
 * Used to determine cache TTL and signing strategy
 */
export type CDNContentType =
  | "thumbnail"
  | "filmstrip"
  | "proxy"
  | "hls-playlist"
  | "hls-segment"
  | "waveform"
  | "original";

/**
 * Options for generating CDN delivery URLs
 */
export interface CDNDeliveryOptions {
  /** Content type - determines cache TTL and signing strategy */
  contentType: CDNContentType;
  /** URL expiration time in seconds (default varies by content type) */
  expiresIn?: number;
  /** Whether to bind token to client IP (optional security feature) */
  bindToIp?: string;
  /** Whether the URL should be signed (default: true for most content) */
  signed?: boolean;
}

/**
 * Result of generating a CDN delivery URL
 */
export interface CDNDeliveryResult {
  /** The full CDN URL */
  url: string;
  /** When the URL expires (if signed) */
  expiresAt?: Date;
  /** Whether the URL is signed */
  isSigned: boolean;
}

/**
 * Result of a cache invalidation operation
 */
export interface CDNInvalidationResult {
  /** Whether the invalidation was successful */
  success: boolean;
  /** Invalidation ID (for tracking async operations) */
  invalidationId?: string;
  /** Estimated time for invalidation to complete (ms) */
  estimatedTime?: number;
}

/**
 * CDN provider interface
 * All CDN operations go through this abstraction.
 */
export interface ICDNProvider {
  /**
   * Provider type identifier
   */
  readonly providerType: CDNProviderType;

  /**
   * Check if the provider is healthy and reachable
   */
  healthCheck(): Promise<boolean>;

  /**
   * Generate a CDN delivery URL for a storage key
   * Returns signed URL with appropriate TTL based on content type
   */
  getDeliveryUrl(
    storageKey: string,
    options: CDNDeliveryOptions
  ): Promise<CDNDeliveryResult>;

  /**
   * Invalidate a single file from CDN cache
   */
  invalidate(storageKey: string): Promise<CDNInvalidationResult>;

  /**
   * Invalidate all files matching a prefix from CDN cache
   * Used for bulk invalidation (e.g., all derivatives for an asset)
   */
  invalidatePrefix(prefix: string): Promise<CDNInvalidationResult>;
}

/**
 * CDN provider configuration
 */
export interface CDNConfig {
  /** Provider type */
  provider: CDNProviderType;
  /** Base URL for CDN (e.g., https://cdn.bush.app) */
  baseUrl: string;
  /** Signing key for generating signed URLs */
  signingKey?: string;
  /** API key for purge operations (separate from signing key) */
  apiKey?: string;
  /** Storage bucket name (for constructing origin URLs) */
  storageBucket?: string;
}

/**
 * Default cache TTL by content type (in seconds)
 */
export const DEFAULT_CACHE_TTL: Record<CDNContentType, number> = {
  thumbnail: 30 * 24 * 60 * 60, // 30 days
  filmstrip: 30 * 24 * 60 * 60, // 30 days
  proxy: 7 * 24 * 60 * 60, // 7 days
  "hls-playlist": 5 * 60, // 5 minutes
  "hls-segment": 7 * 24 * 60 * 60, // 7 days
  waveform: 30 * 24 * 60 * 60, // 30 days
  original: 0, // No CDN for originals
};

/**
 * Content types that should always be signed
 */
export const SIGNED_CONTENT_TYPES: CDNContentType[] = [
  "thumbnail",
  "filmstrip",
  "proxy",
  "hls-playlist",
  "hls-segment",
  "waveform",
];
