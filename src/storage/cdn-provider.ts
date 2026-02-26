/**
 * Bush Platform - Bunny CDN Provider
 *
 * Implementation of CDN provider for Bunny CDN.
 * Uses Bunny's token-based URL signing for secure content delivery.
 * Reference: specs/06-storage.md Section 5
 */
import type {
  ICDNProvider,
  CDNProviderType,
  CDNDeliveryOptions,
  CDNDeliveryResult,
  CDNInvalidationResult,
  CDNConfig,
} from "./cdn-types.js";
import { DEFAULT_CACHE_TTL, SIGNED_CONTENT_TYPES } from "./cdn-types.js";
import crypto from "crypto";

/**
 * Bunny CDN provider implementation
 *
 * Uses pull zones configured to pull from object storage origin.
 * Signed URLs use Bunny's token authentication format.
 * Purge API uses Bunny's REST API endpoint.
 */
export class BunnyCDNProvider implements ICDNProvider {
  readonly providerType: CDNProviderType = "bunny";
  private baseUrl: string;
  private hostname: string;
  private signingKey: string | null;
  private apiKey: string | null;
  private storageBucket: string;

  constructor(config: CDNConfig) {
    this.baseUrl = config.baseUrl.replace(/\/$/, ""); // Remove trailing slash
    // Extract hostname from URL (e.g., "https://cdn.bush.app" -> "cdn.bush.app")
    try {
      const url = new URL(this.baseUrl);
      this.hostname = url.hostname;
    } catch {
      // If baseUrl is invalid, use as-is
      this.hostname = this.baseUrl.replace(/^https?:\/\//, "").split("/")[0];
    }
    this.signingKey = config.signingKey || null;
    this.apiKey = config.apiKey || null;
    this.storageBucket = config.storageBucket || "";
  }

  /**
   * Check if the CDN is healthy
   */
  async healthCheck(): Promise<boolean> {
    try {
      // Simple HEAD request to base URL to verify CDN is reachable
      const response = await fetch(this.baseUrl, { method: "HEAD" });
      return response.ok || response.status === 404; // 404 is OK, means CDN is responding
    } catch {
      return false;
    }
  }

  /**
   * Generate a CDN delivery URL
   * For Bunny CDN, uses token-based authentication
   */
  async getDeliveryUrl(
    storageKey: string,
    options: CDNDeliveryOptions
  ): Promise<CDNDeliveryResult> {
    const ttl = options.expiresIn ?? DEFAULT_CACHE_TTL[options.contentType];
    const shouldSign = options.signed ?? SIGNED_CONTENT_TYPES.includes(options.contentType);

    // Build the CDN URL
    const urlPath = `/${this.storageBucket}/${storageKey}`;
    const baseUrl = `${this.baseUrl}${urlPath}`;

    if (!shouldSign || !this.signingKey) {
      // Return unsigned URL
      return {
        url: baseUrl,
        isSigned: false,
      };
    }

    // Generate signed URL
    const expiresAt = new Date(Date.now() + ttl * 1000);
    const expirationTime = Math.floor(expiresAt.getTime() / 1000);

    // Bunny CDN token format
    // Token = base64url(sha256(key + path + expiration))
    const token = this.generateToken(urlPath, expirationTime);

    // Build signed URL with token parameter
    const signedUrl = `${baseUrl}?token=${token}&expires=${expirationTime}`;

    return {
      url: signedUrl,
      expiresAt,
      isSigned: true,
    };
  }

  /**
   * Invalidate a single file from CDN cache
   * Uses Bunny CDN's purge API: POST https://api.bunny.net/purge
   */
  async invalidate(storageKey: string): Promise<CDNInvalidationResult> {
    if (!this.apiKey) {
      console.warn("[CDN] Cannot purge: CDN_API_KEY not configured");
      return {
        success: false,
      };
    }

    try {
      const urlPath = `/${this.storageBucket}/${storageKey}`;

      // Bunny CDN purge API
      // Reference: https://docs.bunny.net/reference/purge_get
      const response = await fetch("https://api.bunny.net/purge", {
        method: "POST",
        headers: {
          "AccessKey": this.apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          hostname: this.hostname,
          purgePath: urlPath,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => "Unknown error");
        console.error(`[CDN] Purge failed for ${urlPath}: ${response.status} ${errorText}`);
        return {
          success: false,
        };
      }

      console.log(`[CDN] Purged: ${this.hostname}${urlPath}`);

      return {
        success: true,
        invalidationId: `purge-${Date.now()}`,
        estimatedTime: 5000, // ~5 seconds for Bunny CDN purge
      };
    } catch (error) {
      console.error("[CDN] Invalidation failed:", error);
      return {
        success: false,
      };
    }
  }

  /**
   * Invalidate all files matching a prefix from CDN cache
   * Uses Bunny CDN's purge API with prefix option
   */
  async invalidatePrefix(prefix: string): Promise<CDNInvalidationResult> {
    if (!this.apiKey) {
      console.warn("[CDN] Cannot purge prefix: CDN_API_KEY not configured");
      return {
        success: false,
      };
    }

    try {
      const prefixPath = `/${this.storageBucket}/${prefix}`;

      // Bunny CDN purge API with prefix
      // Reference: https://docs.bunny.net/reference/purge_get
      const response = await fetch("https://api.bunny.net/purge", {
        method: "POST",
        headers: {
          "AccessKey": this.apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          hostname: this.hostname,
          purgePath: prefixPath,
          async: true, // Async prefix purge is recommended for large batches
        }),
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => "Unknown error");
        console.error(`[CDN] Prefix purge failed for ${prefixPath}: ${response.status} ${errorText}`);
        return {
          success: false,
        };
      }

      console.log(`[CDN] Purged prefix: ${this.hostname}${prefixPath}`);

      return {
        success: true,
        invalidationId: `purge-prefix-${Date.now()}`,
        estimatedTime: 30000, // ~30 seconds for prefix purge
      };
    } catch (error) {
      console.error("[CDN] Prefix invalidation failed:", error);
      return {
        success: false,
      };
    }
  }

  /**
   * Generate Bunny CDN authentication token
   * Token format: base64url(sha256(key + path + expiration))
   */
  private generateToken(urlPath: string, expirationTime: number): string {
    if (!this.signingKey) {
      return "";
    }

    // Bunny CDN token format
    // The signing key is used as a hex string
    const keyHex = this.signingKey;

    // Create the string to hash: key + path + expiration
    const stringToHash = `${keyHex}${urlPath}${expirationTime}`;

    // Generate SHA-256 hash
    const hash = crypto
      .createHash("sha256")
      .update(stringToHash)
      .digest("base64url");

    return hash;
  }
}

/**
 * No-op CDN provider for when CDN is disabled
 */
export class NoCDNProvider implements ICDNProvider {
  readonly providerType: CDNProviderType = "none";

  async healthCheck(): Promise<boolean> {
    return true;
  }

  async getDeliveryUrl(
    storageKey: string,
    _options: CDNDeliveryOptions
  ): Promise<CDNDeliveryResult> {
    // Return a placeholder URL - actual URLs should come from storage provider
    return {
      url: `#no-cdn/${storageKey}`,
      isSigned: false,
    };
  }

  async invalidate(_storageKey: string): Promise<CDNInvalidationResult> {
    return {
      success: true,
    };
  }

  async invalidatePrefix(_prefix: string): Promise<CDNInvalidationResult> {
    return {
      success: true,
    };
  }
}
