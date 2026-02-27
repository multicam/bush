/**
 * Bush Platform - CDN Providers
 *
 * Implementation of CDN providers for Bunny CDN, CloudFront, and Fastly.
 * Uses provider-specific URL signing for secure content delivery.
 * Reference: specs/06-storage.md Section 5
 */
import type {
  ICDNProvider,
  CDNProviderType,
  CDNDeliveryOptions,
  CDNDeliveryResult,
  CDNInvalidationResult,
  CDNConfig,
  CloudFrontCDNConfig,
  FastlyCDNConfig,
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
 * CloudFront CDN provider implementation
 *
 * Uses CloudFront signed URLs with RSA signatures.
 * Requires CloudFront key pair for signing and distribution ID for invalidations.
 * Reference: https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/private-content-signed-urls.html
 */
export class CloudFrontCDNProvider implements ICDNProvider {
  readonly providerType: CDNProviderType = "cloudfront";
  private baseUrl: string;
  private distributionId: string;
  private keyPairId: string;
  private privateKey: string;
  private region: string;
  private storageBucket: string;

  constructor(config: CloudFrontCDNConfig) {
    this.baseUrl = config.baseUrl.replace(/\/$/, "");
    this.distributionId = config.distributionId;
    this.keyPairId = config.keyPairId;
    this.privateKey = config.privateKey;
    this.region = config.region || "us-east-1";
    this.storageBucket = config.storageBucket || "";
  }

  /**
   * Check if the CDN is healthy
   */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await fetch(this.baseUrl, { method: "HEAD" });
      return response.ok || response.status === 404 || response.status === 403;
    } catch {
      return false;
    }
  }

  /**
   * Generate a CloudFront signed URL
   * Uses RSA signature with canned or custom policy
   */
  async getDeliveryUrl(
    storageKey: string,
    options: CDNDeliveryOptions
  ): Promise<CDNDeliveryResult> {
    const ttl = options.expiresIn ?? DEFAULT_CACHE_TTL[options.contentType];
    const shouldSign = options.signed ?? SIGNED_CONTENT_TYPES.includes(options.contentType);

    const urlPath = `/${this.storageBucket}/${storageKey}`;
    const resourceUrl = `${this.baseUrl}${urlPath}`;

    if (!shouldSign || !this.privateKey || !this.keyPairId) {
      return {
        url: resourceUrl,
        isSigned: false,
      };
    }

    // Generate signed URL
    const expiresAt = new Date(Date.now() + ttl * 1000);
    const expirationTime = Math.floor(expiresAt.getTime() / 1000);

    // Create signed URL using CloudFront canned policy
    const signedUrl = this.signUrl(resourceUrl, expirationTime);

    return {
      url: signedUrl,
      expiresAt,
      isSigned: true,
    };
  }

  /**
   * Invalidate a single file from CloudFront cache
   * Uses CloudFront CreateInvalidation API
   */
  async invalidate(storageKey: string): Promise<CDNInvalidationResult> {
    if (!this.distributionId) {
      console.warn("[CDN:CloudFront] Cannot invalidate: distribution ID not configured");
      return { success: false };
    }

    try {
      const urlPath = `/${this.storageBucket}/${storageKey}`;
      const callerReference = `invalidate-${Date.now()}-${crypto.randomBytes(8).toString("hex")}`;

      // CloudFront invalidation API
      // Reference: https://docs.aws.amazon.com/cloudfront/latest/APIReference/API_CreateInvalidation.html
      const response = await this.createInvalidation([urlPath], callerReference);

      if (!response.ok) {
        const errorText = await response.text().catch(() => "Unknown error");
        console.error(`[CDN:CloudFront] Invalidation failed for ${urlPath}: ${response.status} ${errorText}`);
        return { success: false };
      }

      const data = await response.json().catch(() => ({})) as { Invalidation?: { Id?: string } };
      const invalidationId = data?.Invalidation?.Id || callerReference;

      console.log(`[CDN:CloudFront] Invalidated: ${urlPath} (ID: ${invalidationId})`);

      return {
        success: true,
        invalidationId,
        estimatedTime: 60000, // CloudFront invalidations typically take 1-5 minutes
      };
    } catch (error) {
      console.error("[CDN:CloudFront] Invalidation failed:", error);
      return { success: false };
    }
  }

  /**
   * Invalidate all files matching a prefix from CloudFront cache
   * Uses wildcard path for prefix invalidation
   */
  async invalidatePrefix(prefix: string): Promise<CDNInvalidationResult> {
    if (!this.distributionId) {
      console.warn("[CDN:CloudFront] Cannot invalidate prefix: distribution ID not configured");
      return { success: false };
    }

    try {
      const prefixPath = `/${this.storageBucket}/${prefix}*`;
      const callerReference = `invalidate-prefix-${Date.now()}-${crypto.randomBytes(8).toString("hex")}`;

      const response = await this.createInvalidation([prefixPath], callerReference);

      if (!response.ok) {
        const errorText = await response.text().catch(() => "Unknown error");
        console.error(`[CDN:CloudFront] Prefix invalidation failed for ${prefixPath}: ${response.status} ${errorText}`);
        return { success: false };
      }

      const data = await response.json().catch(() => ({})) as { Invalidation?: { Id?: string } };
      const invalidationId = data?.Invalidation?.Id || callerReference;

      console.log(`[CDN:CloudFront] Invalidated prefix: ${prefixPath} (ID: ${invalidationId})`);

      return {
        success: true,
        invalidationId,
        estimatedTime: 120000, // Prefix invalidations may take longer
      };
    } catch (error) {
      console.error("[CDN:CloudFront] Prefix invalidation failed:", error);
      return { success: false };
    }
  }

  /**
   * Sign a CloudFront URL using canned policy
   */
  private signUrl(url: string, expirationTime: number): string {
    // Create the canned policy
    const policy = {
      Statement: [
        {
          Resource: url,
          Condition: {
            DateLessThan: {
              "AWS:EpochTime": expirationTime,
            },
          },
        },
      ],
    };

    const policyJson = JSON.stringify(policy);

    // Sign the policy with RSA-SHA1
    const sign = crypto.createSign("RSA-SHA1");
    sign.update(policyJson);
    const signature = sign.sign(this.privateKey, "base64url");

    // Build the signed URL
    const encodedPolicy = Buffer.from(policyJson).toString("base64url");
    const separator = url.includes("?") ? "&" : "?";

    return `${url}${separator}Policy=${encodedPolicy}&Signature=${signature}&Key-Pair-Id=${this.keyPairId}`;
  }

  /**
   * Make a CloudFront invalidation API request
   */
  private async createInvalidation(
    paths: string[],
    callerReference: string
  ): Promise<Response> {
    const endpoint = `https://cloudfront.amazonaws.com/2020-05-31/distribution/${this.distributionId}/invalidation`;

    const body = JSON.stringify({
      InvalidationBatch: {
        CallerReference: callerReference,
        Paths: {
          Quantity: paths.length,
          Items: paths,
        },
      },
    });

    // Create AWS Signature Version 4 headers
    const headers = await this.createAwsHeaders("POST", "/2020-05-31/distribution/" + this.distributionId + "/invalidation", body);

    return fetch(endpoint, {
      method: "POST",
      headers,
      body,
    });
  }

  /**
   * Create AWS Signature Version 4 headers
   * Note: This is a simplified implementation. For production, use @aws-sdk/client-cloudfront
   */
  private async createAwsHeaders(
    method: string,
    path: string,
    body: string
  ): Promise<Record<string, string>> {
    const accessKeyId = process.env.AWS_ACCESS_KEY_ID || process.env.STORAGE_ACCESS_KEY;
    const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY || process.env.STORAGE_SECRET_KEY;

    if (!accessKeyId || !secretAccessKey) {
      throw new Error("AWS credentials not configured for CloudFront invalidation");
    }

    const service = "cloudfront";
    const region = this.region;
    const amzDate = new Date().toISOString().replace(/[:\-]|\.\d{3}/g, "");
    const dateStamp = amzDate.substring(0, 8);

    // Create canonical request
    const canonicalHeaders = `host:cloudfront.amazonaws.com\nx-amz-date:${amzDate}\n`;
    const signedHeaders = "host;x-amz-date";
    const payloadHash = crypto.createHash("sha256").update(body).digest("hex");

    const canonicalRequest = `${method}\n${path}\n\n${canonicalHeaders}\n${signedHeaders}\n${payloadHash}`;

    // Create string to sign
    const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
    const canonicalRequestHash = crypto.createHash("sha256").update(canonicalRequest).digest("hex");
    const stringToSign = `AWS4-HMAC-SHA256\n${amzDate}\n${credentialScope}\n${canonicalRequestHash}`;

    // Calculate signature
    const kDate = this.hmacSha256(`AWS4${secretAccessKey}`, dateStamp);
    const kRegion = this.hmacSha256(kDate, region);
    const kService = this.hmacSha256(kRegion, service);
    const kSigning = this.hmacSha256(kService, "aws4_request");
    const signature = this.hmacSha256(kSigning, stringToSign, "hex");

    // Build authorization header
    const authorization = `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

    return {
      "Content-Type": "application/json",
      "X-Amz-Date": amzDate,
      "Authorization": authorization,
    };
  }

  /**
   * HMAC-SHA256 helper
   */
  private hmacSha256(key: string | Buffer, data: string, encoding?: crypto.BinaryToTextEncoding): string | Buffer {
    const hmac = crypto.createHmac("sha256", typeof key === "string" ? key : key).update(data);
    return encoding ? hmac.digest(encoding) : hmac.digest();
  }
}

/**
 * Fastly CDN provider implementation
 *
 * Uses Fastly's purge API for cache invalidation.
 * Supports URL authentication via token-based signing.
 * Reference: https://docs.fastly.com/api/
 */
export class FastlyCDNProvider implements ICDNProvider {
  readonly providerType: CDNProviderType = "fastly";
  private baseUrl: string;
  private apiKey: string;
  private serviceId: string;
  private tokenSigningKey: string | null;
  private storageBucket: string;

  constructor(config: FastlyCDNConfig) {
    this.baseUrl = config.baseUrl.replace(/\/$/, "");
    this.apiKey = config.apiKey;
    this.serviceId = config.serviceId;
    this.tokenSigningKey = config.tokenSigningKey || null;
    this.storageBucket = config.storageBucket || "";
  }

  /**
   * Check if the CDN is healthy
   */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await fetch(this.baseUrl, { method: "HEAD" });
      return response.ok || response.status === 404 || response.status === 403;
    } catch {
      return false;
    }
  }

  /**
   * Generate a Fastly delivery URL
   * Optionally signs URLs with token authentication
   */
  async getDeliveryUrl(
    storageKey: string,
    options: CDNDeliveryOptions
  ): Promise<CDNDeliveryResult> {
    const ttl = options.expiresIn ?? DEFAULT_CACHE_TTL[options.contentType];
    const shouldSign = options.signed ?? SIGNED_CONTENT_TYPES.includes(options.contentType);

    const urlPath = `/${this.storageBucket}/${storageKey}`;
    const resourceUrl = `${this.baseUrl}${urlPath}`;

    if (!shouldSign || !this.tokenSigningKey) {
      return {
        url: resourceUrl,
        isSigned: false,
      };
    }

    // Generate signed URL with token
    const expiresAt = new Date(Date.now() + ttl * 1000);
    const expirationTime = Math.floor(expiresAt.getTime() / 1000);
    const token = this.generateToken(urlPath, expirationTime);

    return {
      url: `${resourceUrl}?token=${token}&expires=${expirationTime}`,
      expiresAt,
      isSigned: true,
    };
  }

  /**
   * Invalidate a single file from Fastly cache
   * Uses Fastly's PURGE API
   */
  async invalidate(storageKey: string): Promise<CDNInvalidationResult> {
    if (!this.apiKey) {
      console.warn("[CDN:Fastly] Cannot purge: API key not configured");
      return { success: false };
    }

    try {
      const urlPath = `/${this.storageBucket}/${storageKey}`;
      const purgeUrl = `${this.baseUrl}${urlPath}`;

      // Fastly purge API - single URL purge
      // Reference: https://docs.fastly.com/api/purge#purge_3aa1d59eeb9f13ddbe29b1c9cbbb1af5
      const response = await fetch(purgeUrl, {
        method: "PURGE",
        headers: {
          "Fastly-Key": this.apiKey,
          "Accept": "application/json",
        },
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => "Unknown error");
        console.error(`[CDN:Fastly] Purge failed for ${purgeUrl}: ${response.status} ${errorText}`);
        return { success: false };
      }

      const data = await response.json().catch(() => ({})) as { id?: string };
      console.log(`[CDN:Fastly] Purged: ${purgeUrl}`);

      return {
        success: true,
        invalidationId: data.id || `purge-${Date.now()}`,
        estimatedTime: 1000, // Fastly purges are nearly instant
      };
    } catch (error) {
      console.error("[CDN:Fastly] Invalidation failed:", error);
      return { success: false };
    }
  }

  /**
   * Invalidate all files matching a prefix from Fastly cache
   * Uses surrogate key purging for efficient bulk invalidation
   */
  async invalidatePrefix(prefix: string): Promise<CDNInvalidationResult> {
    if (!this.apiKey || !this.serviceId) {
      console.warn("[CDN:Fastly] Cannot purge prefix: API key or service ID not configured");
      return { success: false };
    }

    try {
      // Fastly soft purge by surrogate key or prefix
      // For prefix purges, we use the purge all with path pattern (wildcard)
      const prefixPath = `/${this.storageBucket}/${prefix}*`;

      // Fastly bulk purge via API
      // Reference: https://docs.fastly.com/api/purge#purge_bee3ed8562e929275a4c4e68c873a0ad
      const response = await fetch("https://api.fastly.com/purge", {
        method: "POST",
        headers: {
          "Fastly-Key": this.apiKey,
          "Accept": "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          service_id: this.serviceId,
          purge_path: prefixPath,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => "Unknown error");
        console.error(`[CDN:Fastly] Prefix purge failed for ${prefixPath}: ${response.status} ${errorText}`);
        return { success: false };
      }

      const data = await response.json().catch(() => ({})) as { id?: string };
      console.log(`[CDN:Fastly] Purged prefix: ${prefixPath}`);

      return {
        success: true,
        invalidationId: data.id || `purge-prefix-${Date.now()}`,
        estimatedTime: 5000, // Fastly bulk purges are fast
      };
    } catch (error) {
      console.error("[CDN:Fastly] Prefix invalidation failed:", error);
      return { success: false };
    }
  }

  /**
   * Generate Fastly authentication token
   * Uses HMAC-SHA256 for token generation
   */
  private generateToken(urlPath: string, expirationTime: number): string {
    if (!this.tokenSigningKey) {
      return "";
    }

    // Fastly token format (simplified)
    // Format: base64url(hmac-sha256(key, path + expiration))
    const stringToSign = `${urlPath}${expirationTime}`;
    const token = crypto
      .createHmac("sha256", this.tokenSigningKey)
      .update(stringToSign)
      .digest("base64url");

    return token;
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
